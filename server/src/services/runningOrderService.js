import ExcelJS from 'exceljs';
import { getDb } from '../db/index.js';

const ALL_LOGO_PATTERN = /all logo/i;

/**
 * The real sample workbook (plan §A/§23) has no header row naming its
 * columns and no per-device "Target" column - just a flat table of (slot
 * number, sponsor label) pairs, laid out as two side-by-side column blocks
 * for print purposes, plus a loose text note. Rather than hardcode the
 * exact row/column this was observed at, this scans for the first row whose
 * first cell is the integer 1 and reads forward while the slot number keeps
 * incrementing by 1 - general enough to survive the table starting at a
 * different row, while still not inventing a structure that isn't there.
 */
export async function parseRunningOrder(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    const err = new Error('Running order workbook has no sheets');
    err.status = 400;
    throw err;
  }

  const slots = [];
  let allLogoNoteFound = false;

  const columnPairs = [
    [1, 2],
    [3, 4]
  ];

  // Each column-pair is an independent continuing sequence (e.g. col A/B
  // covers slots 1-20, col C/D covers slots 21-40 in the same rows) - a
  // shared counter would only ever match the first pair.
  const expectedNext = columnPairs.map(() => null);
  let inTable = false;

  sheet.eachRow((row) => {
    columnPairs.forEach(([slotCol, labelCol], idx) => {
      const slotValue = row.getCell(slotCol).value;
      const labelValue = row.getCell(labelCol).value;
      if (typeof slotValue !== 'number' || !labelValue) return;

      const expected = expectedNext[idx] ?? slotValue; // first hit in this column seeds the sequence
      if (slotValue === expected) {
        slots.push({ slot: slotValue, label: String(labelValue).trim() });
        expectedNext[idx] = slotValue + 1;
        inTable = true;
      }
    });

    row.eachCell((cell) => {
      if (typeof cell.value === 'string' && ALL_LOGO_PATTERN.test(cell.value)) {
        allLogoNoteFound = true;
      }
    });
  });

  if (slots.length === 0) {
    const err = new Error(
      'Could not find a running-order slot table (expected a column starting at 1 and incrementing by 1)'
    );
    err.status = 400;
    throw err;
  }

  return { slots, allLogoNoteFound, totalSlots: slots.length, tableDetected: inTable };
}

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Resolves each running-order sponsor label to a discovered Category B file
 * stem. Every label in the real sample either matches a stem exactly or is
 * an unambiguous case-insensitive prefix of exactly one stem (plan §G) -
 * zero or multiple candidate matches are reported as unresolved rather than
 * guessed, with a manual-override path via RunningOrderSponsorAliases.
 */
export function resolveSponsorAliases(slots, categoryBStems, eventId) {
  const db = getDb();
  const uniqueLabels = [...new Set(slots.map((s) => s.label))];
  const uniqueStems = [...new Set(categoryBStems)];
  const resolved = new Map();

  const upsert = db.prepare(`
    INSERT INTO RunningOrderSponsorAliases (EventId, RunningOrderLabel, ResolvedFileStem, MatchMethod)
    VALUES (@eventId, @label, @stem, @method)
    ON CONFLICT (EventId, RunningOrderLabel) DO UPDATE SET
      ResolvedFileStem = excluded.ResolvedFileStem,
      MatchMethod = excluded.MatchMethod
  `);

  for (const label of uniqueLabels) {
    const normalizedLabel = normalize(label);
    const exact = uniqueStems.find((stem) => normalize(stem) === normalizedLabel);
    if (exact) {
      resolved.set(label, { stem: exact, method: 'exact' });
      upsert.run({ eventId, label, stem: exact, method: 'exact' });
      continue;
    }

    const prefixMatches = uniqueStems.filter((stem) => normalize(stem).startsWith(normalizedLabel));
    if (prefixMatches.length === 1) {
      resolved.set(label, { stem: prefixMatches[0], method: 'prefix' });
      upsert.run({ eventId, label, stem: prefixMatches[0], method: 'prefix' });
      continue;
    }

    resolved.set(label, { stem: null, method: 'unresolved', candidateCount: prefixMatches.length });
    upsert.run({ eventId, label, stem: null, method: 'unresolved' });
  }

  return resolved;
}
