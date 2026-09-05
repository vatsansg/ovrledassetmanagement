import fs from 'node:fs';
import path from 'node:path';
import { computeSha256 } from './fileHashService.js';
import { testDeviceConnection } from './ledConnectionService.js';
import { getDb } from '../db/index.js';

async function distributeOne({ runId, deviceKey, filename, sourcePath, targetPath }) {
  const db = getDb();
  const destPath = path.join(targetPath, filename);
  const info = db
    .prepare(
      `INSERT INTO DistributionResults (RunId, DeviceKey, Filename, SourcePath, DestinationPath, Status, StartedAt)
       VALUES (?, ?, ?, ?, ?, 'COPYING', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
    )
    .run(runId, deviceKey, filename, sourcePath, destPath);
  const distributionId = info.lastInsertRowid;

  try {
    const tmpPath = `${destPath}.tmp`;
    fs.copyFileSync(sourcePath, tmpPath);
    const [sourceHash, destHash] = await Promise.all([computeSha256(sourcePath), computeSha256(tmpPath)]);
    if (sourceHash !== destHash) {
      fs.unlinkSync(tmpPath);
      throw new Error('Copy verification failed (hash mismatch)');
    }
    fs.renameSync(tmpPath, destPath);
    const sizeBytes = fs.statSync(destPath).size;

    db.prepare(
      `UPDATE DistributionResults SET Status = 'VERIFIED', SizeBytes = ?, ContentHash = ?, CompletedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE Id = ?`
    ).run(sizeBytes, destHash, distributionId);
    return { status: 'VERIFIED', destPath };
  } catch (err) {
    db.prepare(
      `UPDATE DistributionResults SET Status = 'FAILED', ErrorMessage = ?, CompletedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE Id = ?`
    ).run(err.message, distributionId);
    throw err;
  }
}

/**
 * `assets`: [{ deviceKey, filename, sourcePath }]. Re-checks connectivity
 * immediately before copying to each device rather than trusting a
 * previously-cached Test Connection result, per the user's explicit
 * instruction. Only enabled devices are targeted; a disabled device is
 * silently skipped (not an error - the operator chose not to distribute
 * there).
 */
export async function distributeRun(runId, assets) {
  const db = getDb();
  const devices = db.prepare('SELECT * FROM LEDDevices WHERE Enabled = 1').all();
  const deviceByKey = Object.fromEntries(devices.map((d) => [d.DeviceKey, d]));
  const results = [];

  for (const asset of assets) {
    const device = deviceByKey[asset.deviceKey];
    if (!device) continue;

    const preflight = testDeviceConnection(device.TargetPath);
    if (preflight.result !== 'PASS') {
      db.prepare(
        `INSERT INTO DistributionResults (RunId, DeviceKey, Filename, SourcePath, Status, ErrorMessage)
         VALUES (?, ?, ?, ?, 'FAILED', ?)`
      ).run(runId, asset.deviceKey, asset.filename, asset.sourcePath, `Pre-flight connectivity check failed: ${preflight.message}`);
      results.push({ ...asset, status: 'FAILED', error: preflight.message });
      continue;
    }

    try {
      const outcome = await distributeOne({
        runId,
        deviceKey: asset.deviceKey,
        filename: asset.filename,
        sourcePath: asset.sourcePath,
        targetPath: device.TargetPath
      });
      results.push({ ...asset, status: outcome.status });
    } catch (err) {
      results.push({ ...asset, status: 'FAILED', error: err.message });
    }
  }

  return results;
}
