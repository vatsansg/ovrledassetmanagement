import { v4 as uuid } from 'uuid';
import { getDb } from '../db/index.js';

/**
 * Minimal RFC4180-ish CSV parser: handles quoted fields containing commas
 * (e.g. the description column). No external dependency needed for a file
 * this small and well-formed.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const chars = text.replace(/\r\n/g, '\n');

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (inQuotes) {
      if (c === '"') {
        if (chars[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

const FALLBACK_PATTERN = /\b(?:use|reuse)\s+(?:a copy of\s+)?([\w.\- ]+\.(?:png|mp4))\b/i;
const PERSISTENT_PATTERN = /keep this file (?:in|on) the av boards/i;

/**
 * Category A source filenames (e.g. "Champions_Montpellier - LED1.mp4")
 * share no text with their canonical name - the only reliable signal
 * observed in the real sample is the source subfolder. Seeded as an
 * editable suggestion on first import only (never overwritten by a
 * re-import - see the ON CONFLICT clause below), since a different event
 * could use a different folder layout and an admin may need to correct it.
 */
const DEFAULT_FOLDER_HINTS = {
  'HOME_Look.png': '2_Home_Look',
  'Home Look.mp4': '2_Home_Look',
  'TO.mp4': '3_Time_Out',
  'gamebreak.mp4': '4_Ganten_Water_Break',
  'GM_POINT.mp4': '5_Game_Point',
  'MATCH_POINT.mp4': '6_Match_Point',
  'CHMP_POINT.mp4': '7_Championship_Point',
  'winner.mp4': '8_Gen_Winning_Moment'
  // all-adv.png deliberately has no folder hint: it lives alongside sponsor
  // ads in 1_Sponsor_Ads with no distinguishing subfolder, so a folder-hint
  // match would wrongly claim every sponsor file in that folder. It's only
  // matched via the exact-canonical-filename path in FileDiscoveryService.
};

/**
 * Two CSV rows ("SJF Winning Moment", "Ganten Waterbreak") have no literal
 * filename in the filename column - see plan §D.1. This resolves both from
 * real confirmed sample data rather than inventing a mapping:
 *   - "Ganten Waterbreak" (actiontype=gamebreak) -> gamebreak.mp4
 *   - "SJF Winning Moment" is the same conceptual asset as the very next
 *     row, winner.mp4 - skipped as a duplicate, not imported as its own row.
 */
function resolveCanonicalFilename(rawFilename, actionType) {
  const trimmed = rawFilename.trim();
  if (/\.\w+$/.test(trimmed)) return trimmed;
  if (/^ganten waterbreak$/i.test(trimmed) && actionType) return `${actionType}.mp4`;
  if (/^sjf winning moment$/i.test(trimmed)) return null; // duplicate of winner.mp4, skip
  return null; // unrecognized non-literal row - surfaced as skipped, never guessed
}

function deriveRequirement(rawRow) {
  const [filename, actionType, description] = rawRow;
  const canonicalFilename = resolveCanonicalFilename(filename, actionType?.trim());
  if (!canonicalFilename) return null;

  const fallbackMatch = description?.match(FALLBACK_PATTERN);
  const fallbackFilename = fallbackMatch ? fallbackMatch[1].trim() : null;

  return {
    filename: filename.trim(),
    actionType: actionType?.trim() || null,
    description: description?.trim() || null,
    canonicalFilename,
    requiredOrOptional: fallbackFilename ? 'OPTIONAL' : 'REQUIRED',
    fallbackFilename,
    isPersistentAsset: PERSISTENT_PATTERN.test(description || '') ? 1 : 0,
    sourceFolderHintSuggestion: DEFAULT_FOLDER_HINTS[canonicalFilename] || null
  };
}

export function parseAndDeriveCsv(csvText) {
  const rows = parseCsv(csvText);
  const [header, ...dataRows] = rows;
  if (!header || header.map((h) => h.trim().toLowerCase()).join(',') !== 'filename,actiontype,description') {
    const err = new Error('CSV header must be exactly: filename,actiontype,description');
    err.status = 400;
    throw err;
  }

  const derived = [];
  const skipped = [];
  for (const raw of dataRows) {
    const requirement = deriveRequirement(raw);
    if (requirement) derived.push(requirement);
    else skipped.push(raw[0]);
  }
  return { derived, skipped };
}

function fieldsEqual(existing, incoming) {
  return (
    existing.Description === incoming.description &&
    existing.ActionType === incoming.actionType &&
    existing.RequiredOrOptional === incoming.requiredOrOptional &&
    existing.FallbackFilename === incoming.fallbackFilename &&
    !!existing.IsPersistentAsset === !!incoming.isPersistentAsset &&
    !!existing.IsActive
  );
}

export function diffImport(derived) {
  const db = getDb();
  const existingRows = db.prepare('SELECT * FROM LED_File_Requirements').all();
  const existingByName = new Map(existingRows.map((r) => [r.CanonicalFilename, r]));
  const incomingNames = new Set(derived.map((d) => d.canonicalFilename));

  const toAdd = [];
  const toUpdate = [];
  const unchanged = [];

  for (const incoming of derived) {
    const existing = existingByName.get(incoming.canonicalFilename);
    if (!existing) {
      toAdd.push(incoming);
    } else if (!fieldsEqual(existing, incoming)) {
      toUpdate.push({
        canonicalFilename: incoming.canonicalFilename,
        before: {
          description: existing.Description,
          actionType: existing.ActionType,
          requiredOrOptional: existing.RequiredOrOptional,
          fallbackFilename: existing.FallbackFilename,
          isPersistentAsset: !!existing.IsPersistentAsset,
          isActive: !!existing.IsActive
        },
        after: incoming
      });
    } else {
      unchanged.push(incoming.canonicalFilename);
    }
  }

  const toDeactivate = existingRows
    .filter((r) => r.IsActive && !incomingNames.has(r.CanonicalFilename))
    .map((r) => r.CanonicalFilename);

  return { toAdd, toUpdate, toDeactivate, unchanged };
}

export function applyImport(derived, userId) {
  const db = getDb();
  const batchId = uuid();
  const now = new Date().toISOString();

  const upsert = db.prepare(`
    INSERT INTO LED_File_Requirements
      (Filename, ActionType, Description, CanonicalFilename, RequiredOrOptional, FallbackFilename, IsPersistentAsset, IsActive, ImportBatchId, ImportedAt, SourceFolderHint)
    VALUES (@filename, @actionType, @description, @canonicalFilename, @requiredOrOptional, @fallbackFilename, @isPersistentAsset, 1, @batchId, @now, @sourceFolderHintSuggestion)
    ON CONFLICT (CanonicalFilename) DO UPDATE SET
      Filename = excluded.Filename,
      ActionType = excluded.ActionType,
      Description = excluded.Description,
      RequiredOrOptional = excluded.RequiredOrOptional,
      FallbackFilename = excluded.FallbackFilename,
      IsPersistentAsset = excluded.IsPersistentAsset,
      IsActive = 1,
      ImportBatchId = excluded.ImportBatchId,
      ImportedAt = excluded.ImportedAt
  `);

  const deactivate = db.prepare('UPDATE LED_File_Requirements SET IsActive = 0 WHERE CanonicalFilename = ?');

  const { toDeactivate } = diffImport(derived);

  const run = db.transaction(() => {
    for (const req of derived) {
      upsert.run({ ...req, batchId, now });
    }
    for (const canonicalFilename of toDeactivate) {
      deactivate.run(canonicalFilename);
    }
    db.prepare('INSERT INTO AuditLog (UserId, EventType, Message, DetailJson) VALUES (?, ?, ?, ?)').run(
      userId,
      'led_requirements.imported',
      `Imported ${derived.length} requirement(s), deactivated ${toDeactivate.length}`,
      JSON.stringify({ batchId, count: derived.length, deactivated: toDeactivate })
    );
  });
  run();

  return { batchId, imported: derived.length, deactivated: toDeactivate.length };
}
