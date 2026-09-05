import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/index.js';
import { getSetting } from './settingsService.js';
import { getConfigurationStatus } from './configValidationService.js';
import { getSignedInAccount } from './msalService.js';
import { discoverSourceFiles, downloadFile } from './sharePointService.js';
import { classifyFile } from './fileDiscoveryService.js';
import { determineFileStatus } from './fileStatusService.js';
import { validateAsset, overallStatus } from './validationService.js';
import { computeSha256 } from './fileHashService.js';
import { renameAsset } from './renamingService.js';
import { resolveCategoryAFallbacks } from './fallbackService.js';
import { parseRunningOrder, resolveSponsorAliases } from './runningOrderService.js';
import { buildSequenceEntries, persistSequenceEntries, generateSequenceCsv } from './sequenceGenerator.js';
import { distributeRun } from './distributionService.js';
import { logger } from '../utils/logger.js';
import { broadcast } from '../utils/wsHub.js';

function progress(runId, step, detail) {
  broadcast('run.progress', { runId, step, detail });
  logger.info(`Run ${runId}: ${step}`, detail ? { detail } : undefined);
}

function isRunningOrderCandidate(name) {
  return /\.xlsx$/i.test(name) && !name.startsWith('~$');
}

/**
 * Preconditions per plan §30: never start a run without valid config, a
 * signed-in SharePoint session, a resolved source folder, and at least one
 * enabled LED device.
 */
export async function checkRunPreconditions() {
  const status = getConfigurationStatus();
  const problems = [];
  if (!status.isReady) problems.push(`Configuration incomplete: ${status.missingRequiredSettings.join(', ') || 'see Settings'}`);

  try {
    const account = await getSignedInAccount();
    if (!account) problems.push('Not signed in to Microsoft 365');
  } catch (err) {
    problems.push(err.message);
  }

  if (!getSetting('SharePointDriveId') || !getSetting('SharePointFolderId')) {
    problems.push('SharePoint source folder not resolved - run Test Connection first');
  }

  return { ready: problems.length === 0, problems };
}

async function processOneAsset({ runId, sourceFile, classification, folders }) {
  const db = getDb();
  const ext = sourceFile.name.split('.').pop().toLowerCase();
  const { status: fileStatus, previous } = determineFileStatus(classification.deviceKey, classification.canonicalFilename, sourceFile);

  const reuseExisting = fileStatus === 'NO_CHANGE' && previous?.LocalRenamedPath && fs.existsSync(previous.LocalRenamedPath);

  let localDownloadPath = previous?.LocalDownloadPath || null;
  let localRenamedPath = reuseExisting ? previous.LocalRenamedPath : null;
  let validationResults = [];
  let validationStatus = reuseExisting ? 'VALID' : null;
  let contentHash = reuseExisting ? previous.ContentHash : null;

  if (!reuseExisting) {
    localDownloadPath = path.join(folders.localDownloadFolder, classification.deviceKey, sourceFile.relativePath.replace(/\//g, '_'));
    await downloadFile(sourceFile.id, localDownloadPath);
    contentHash = await computeSha256(localDownloadPath);

    const { results } = await validateAsset(localDownloadPath, ext, classification.deviceKey);
    validationResults = results;
    validationStatus = overallStatus(results);

    if (validationStatus === 'VALID') {
      const { destPath } = await renameAsset({
        sourcePath: localDownloadPath,
        deviceKey: classification.deviceKey,
        canonicalFilename: classification.canonicalFilename,
        renamedAssetsFolder: folders.renamedAssetsFolder
      });
      localRenamedPath = destPath;
    }
  }

  const insertFile = db.prepare(`
    INSERT INTO ProcessingFiles
      (RunId, SourceRelativePath, SourceFilename, DetectedDeviceToken, AssetCategory, ContentHash,
       GraphETag, GraphQuickXorHash, GraphLastModified, FileStatus, ValidationStatus,
       RenamedFilename, LocalDownloadPath, LocalRenamedPath)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = insertFile.run(
    runId,
    sourceFile.relativePath,
    sourceFile.name,
    classification.deviceKey,
    classification.assetCategory,
    contentHash,
    sourceFile.eTag,
    sourceFile.quickXorHash,
    sourceFile.lastModifiedDateTime,
    fileStatus,
    validationStatus,
    classification.canonicalFilename,
    localDownloadPath,
    localRenamedPath
  );

  if (validationResults.length) {
    const insertResult = db.prepare(`
      INSERT INTO ValidationResults (ProcessingFileId, RuleName, ExpectedValue, ActualValue, Result, FailureReason, Severity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of validationResults) {
      insertResult.run(info.lastInsertRowid, r.ruleName, r.expectedValue, r.actualValue, r.result, r.failureReason, r.severity);
    }
  }

  if (localRenamedPath && validationStatus === 'VALID') {
    db.prepare(`
      INSERT INTO RenamedAssets (ProcessingFileId, RunId, DeviceKey, CanonicalFilename, SourcePath, RenamedPath, IsFallbackUsed, ContentHash, VerifiedAt)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    `).run(info.lastInsertRowid, runId, classification.deviceKey, classification.canonicalFilename, localDownloadPath, localRenamedPath, contentHash);
  }

  return { fileStatus, validationStatus, ...classification };
}

async function copyFallbackAsset({ runId, deviceKey, canonicalFilename, fallbackFilename, defaultAssetFolder, renamedAssetsFolder }) {
  const sourcePath = path.join(defaultAssetFolder, deviceKey, fallbackFilename);
  if (!fs.existsSync(sourcePath)) {
    return { copied: false, reason: `Fallback source ${sourcePath} not found in DefaultAssetFolder` };
  }
  const { destPath, contentHash } = await renameAsset({
    sourcePath,
    deviceKey,
    canonicalFilename,
    renamedAssetsFolder
  });
  const db = getDb();
  db.prepare(`
    INSERT INTO RenamedAssets (RunId, DeviceKey, CanonicalFilename, SourcePath, RenamedPath, IsFallbackUsed, FallbackReason, ContentHash, VerifiedAt)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `).run(runId, deviceKey, canonicalFilename, sourcePath, destPath, `Missing required source; substituted ${fallbackFilename}`, contentHash);
  return { copied: true, destPath };
}

export async function executeRun(userId) {
  const precheck = await checkRunPreconditions();
  if (!precheck.ready) {
    const err = new Error(`Cannot start run: ${precheck.problems.join('; ')}`);
    err.status = 400;
    throw err;
  }

  const db = getDb();
  const runId = uuid();
  const eventId = getSetting('EventId');
  const folders = {
    localDownloadFolder: getSetting('LocalDownloadFolder'),
    renamedAssetsFolder: getSetting('RenamedAssetsFolder'),
    defaultAssetFolder: getSetting('DefaultAssetFolder')
  };
  for (const dir of Object.values(folders)) fs.mkdirSync(dir, { recursive: true });

  db.prepare('INSERT INTO ProcessingRuns (RunId, EventId, StartedByUserId, Status) VALUES (?, ?, ?, ?)').run(
    runId,
    eventId,
    userId,
    'DISCOVERING'
  );

  const summary = {
    runId,
    discovered: 0,
    unmatched: [],
    valid: 0,
    invalid: 0,
    new: 0,
    modified: 0,
    noChange: 0,
    fallbacksUsed: [],
    blocked: [],
    distribution: []
  };

  try {
    progress(runId, 'DISCOVERING');
    const rawFiles = await discoverSourceFiles();
    summary.discovered = rawFiles.length;

    const runningOrderFileOverride = getSetting('RunningOrderFile');
    const candidates = rawFiles.filter((f) => isRunningOrderCandidate(f.name));
    const runningOrderFile = runningOrderFileOverride
      ? candidates.find((f) => f.name === runningOrderFileOverride)
      : candidates.length === 1
        ? candidates[0]
        : null;
    if (!runningOrderFile) {
      throw Object.assign(
        new Error(
          candidates.length === 0
            ? 'No running-order .xlsx file found in the source folder'
            : `Multiple .xlsx files found (${candidates.map((c) => c.name).join(', ')}) - set RunningOrderFile in Settings to disambiguate`
        ),
        { status: 400 }
      );
    }

    const runningOrderLocalPath = path.join(folders.localDownloadFolder, '_running_order.xlsx');
    await downloadFile(runningOrderFile.id, runningOrderLocalPath);
    const { slots, allLogoNoteFound } = await parseRunningOrder(runningOrderLocalPath);

    db.prepare("UPDATE ProcessingRuns SET Status = 'VALIDATING' WHERE RunId = ?").run(runId);
    progress(runId, 'VALIDATING', { discovered: rawFiles.length });

    const requirements = db.prepare('SELECT * FROM LED_File_Requirements').all();
    const assetFiles = rawFiles.filter((f) => f !== runningOrderFile);
    const presentThisRun = new Set(); // "<DeviceKey>:<CanonicalFilename>" for Category A
    const presentCategoryB = new Map(); // "<DeviceKey>:<stem>" -> canonicalFilename

    // Classify everything first (cheap, no I/O) so sponsor aliases can be
    // resolved before deciding what to actually download/validate/rename.
    // A Category B file whose sponsor isn't referenced anywhere in the
    // running order (the real GPMP-style orphan case, plan §11/§23) must
    // never be renamed or distributed - only classifying it, then checking
    // membership afterward, would silently process it anyway.
    const classified = assetFiles.map((sourceFile) => ({ sourceFile, classification: classifyFile(sourceFile, requirements) }));
    const categoryBStems = classified.filter((c) => c.classification.assetCategory === 'B').map((c) => c.classification.sponsorStem);
    const aliasResolution = resolveSponsorAliases(slots, categoryBStems, eventId);
    const referencedStems = new Set([...aliasResolution.values()].filter((v) => v.stem).map((v) => v.stem));

    const recordUnmatched = db.prepare(`
      INSERT INTO ProcessingFiles (RunId, SourceRelativePath, SourceFilename, DetectedDeviceToken, AssetCategory, FileStatus, ValidationStatus)
      VALUES (?, ?, ?, ?, 'UNMATCHED', 'UNMATCHED', 'NOT_APPLICABLE')
    `);

    for (const { sourceFile, classification } of classified) {
      if (classification.assetCategory === 'UNMATCHED') {
        summary.unmatched.push({ file: sourceFile.relativePath, reason: classification.reason });
        recordUnmatched.run(runId, sourceFile.relativePath, sourceFile.name, classification.deviceKey);
        continue;
      }
      if (classification.assetCategory === 'B' && !referencedStems.has(classification.sponsorStem)) {
        const reason = `Sponsor "${classification.sponsorStem}" is not referenced anywhere in the running order`;
        summary.unmatched.push({ file: sourceFile.relativePath, reason });
        recordUnmatched.run(runId, sourceFile.relativePath, sourceFile.name, classification.deviceKey);
        continue;
      }

      const outcome = await processOneAsset({ runId, sourceFile, classification, folders });

      if (outcome.validationStatus === 'VALID') {
        summary.valid += 1;
        if (classification.assetCategory === 'A') {
          presentThisRun.add(`${classification.deviceKey}:${classification.canonicalFilename}`);
        } else {
          presentCategoryB.set(`${classification.deviceKey}:${classification.sponsorStem}`, classification.canonicalFilename);
        }
      } else {
        summary.invalid += 1;
      }
      if (outcome.fileStatus === 'NEW') summary.new += 1;
      else if (outcome.fileStatus === 'MODIFIED') summary.modified += 1;
      else if (outcome.fileStatus === 'NO_CHANGE') summary.noChange += 1;
    }

    db.prepare("UPDATE ProcessingRuns SET Status = 'RENAMING' WHERE RunId = ?").run(runId);
    progress(runId, 'RENAMING');

    const fallbackOutcomes = resolveCategoryAFallbacks(presentThisRun);
    for (const outcome of fallbackOutcomes) {
      if (outcome.outcome === 'FALLBACK') {
        const result = await copyFallbackAsset({
          runId,
          deviceKey: outcome.deviceKey,
          canonicalFilename: outcome.canonicalFilename,
          fallbackFilename: outcome.fallbackFilename,
          defaultAssetFolder: folders.defaultAssetFolder,
          renamedAssetsFolder: folders.renamedAssetsFolder
        });
        summary.fallbacksUsed.push({ ...outcome, ...result });
      } else if (outcome.outcome === 'BLOCKED') {
        summary.blocked.push(outcome);
      }
    }

    if (summary.blocked.length > 0) {
      db.prepare("UPDATE ProcessingRuns SET Status = 'FAILED', EndTime = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ErrorSummary = ? WHERE RunId = ?").run(
        `Blocked: ${summary.blocked.map((b) => b.reason).join('; ')}`,
        runId
      );
      progress(runId, 'FAILED', { blocked: summary.blocked });
      return summary;
    }

    db.prepare("UPDATE ProcessingRuns SET Status = 'RUNNING_ORDER' WHERE RunId = ?").run(runId);
    progress(runId, 'RUNNING_ORDER', { totalSlots: slots.length, allLogoNoteFound });

    const allAdvAvailable =
      presentThisRun.has('LED1:all-adv.png') || fs.existsSync(path.join(folders.renamedAssetsFolder, 'LED1', 'all-adv.png'));
    const defaultPngAvailable = fs.existsSync(path.join(folders.defaultAssetFolder, 'LED1', 'default.png'));

    const { entries, substitutions } = buildSequenceEntries({
      slots,
      aliasResolution,
      presentCategoryB,
      allAdvAvailable,
      defaultPngAvailable,
      allLogoNoteFound
    });
    summary.fallbacksUsed.push(...substitutions.map((s) => ({ outcome: 'SEQUENCE_SUBSTITUTION', ...s })));

    persistSequenceEntries(runId, entries);
    const csv = generateSequenceCsv(eventId, entries);
    fs.writeFileSync(path.join(folders.renamedAssetsFolder, `sequence_${runId}.csv`), csv);

    db.prepare("UPDATE ProcessingRuns SET Status = 'DISTRIBUTING' WHERE RunId = ?").run(runId);
    progress(runId, 'DISTRIBUTING');

    // Every valid asset this run - freshly renamed, NO_CHANGE-reused, or
    // fallback-substituted - gets its own RenamedAssets row against this
    // RunId (see processOneAsset/copyFallbackAsset), so this alone captures
    // everything that needs distributing.
    const renamedRows = db
      .prepare('SELECT DeviceKey, CanonicalFilename, RenamedPath FROM RenamedAssets WHERE RunId = ?')
      .all(runId);
    const distributionAssets = renamedRows.map((r) => ({
      deviceKey: r.DeviceKey,
      filename: r.CanonicalFilename,
      sourcePath: r.RenamedPath
    }));
    // Also distribute the generated sequence CSV to LED1/LED2 (Category B's targets only)
    for (const deviceKey of ['LED1', 'LED2']) {
      distributionAssets.push({
        deviceKey,
        filename: 'sequence.csv',
        sourcePath: path.join(folders.renamedAssetsFolder, `sequence_${runId}.csv`)
      });
    }

    summary.distribution = await distributeRun(runId, distributionAssets);

    const hasFailures = summary.distribution.some((d) => d.status === 'FAILED') || summary.invalid > 0;
    db.prepare(
      "UPDATE ProcessingRuns SET Status = ?, EndTime = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE RunId = ?"
    ).run(hasFailures ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED', runId);
    progress(runId, hasFailures ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED', summary);

    return summary;
  } catch (err) {
    db.prepare(
      "UPDATE ProcessingRuns SET Status = 'FAILED', EndTime = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ErrorSummary = ? WHERE RunId = ?"
    ).run(err.message, runId);
    progress(runId, 'FAILED', { error: err.message });
    throw err;
  }
}
