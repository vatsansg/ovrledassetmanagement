import { getDb } from '../db/index.js';

/**
 * Resolves what Category B file (if any) should play in a given running-
 * order slot for one device. Missing-individual-sponsor fallback chain per
 * plan §21-22: substitute all-adv.png, then default.png if that's also
 * missing - always reported, never silent.
 */
export function resolveCategoryBSlotFilename({ deviceKey, label, aliasResolution, presentCategoryB, allAdvAvailable, defaultPngAvailable }) {
  const alias = aliasResolution.get(label);
  if (alias?.stem) {
    const key = `${deviceKey}:${alias.stem}`;
    if (presentCategoryB.has(key)) {
      return { filename: presentCategoryB.get(key), usedFallback: false };
    }
  }

  const reason = alias?.stem ? `Sponsor file for "${label}" not supplied this run` : `Running-order label "${label}" could not be resolved to any supplied file`;

  if (allAdvAvailable) {
    return { filename: 'all-adv.png', usedFallback: true, fallbackReason: reason };
  }
  if (defaultPngAvailable) {
    return { filename: 'default.png', usedFallback: true, fallbackReason: `${reason}; all-adv.png also unavailable` };
  }
  return { filename: null, usedFallback: true, fallbackReason: `${reason}; no fallback asset available either` };
}

/**
 * Builds the per-device LED1/LED2 sequence (restarting numbering per
 * device) plus the single confirmed Sequence=999 all-adv.png row when the
 * running order's "All Logo" note is present - see plan §24. Sequence CSV
 * covers Category B rows and that one sentinel row only: Category A assets
 * (Home Look, match-event clips) are distributed directly, outside the
 * sequencing mechanism entirely.
 */
export function buildSequenceEntries({ slots, aliasResolution, presentCategoryB, allAdvAvailable, defaultPngAvailable, allLogoNoteFound }) {
  const entries = [];
  const substitutions = [];

  for (const deviceKey of ['LED1', 'LED2']) {
    for (const { slot, label } of slots) {
      const { filename, usedFallback, fallbackReason } = resolveCategoryBSlotFilename({
        deviceKey,
        label,
        aliasResolution,
        presentCategoryB,
        allAdvAvailable,
        defaultPngAvailable
      });
      if (usedFallback) substitutions.push({ deviceKey, slot, label, filename, reason: fallbackReason });
      if (filename) entries.push({ deviceKey, sequence: slot, filename });
    }

    if (allLogoNoteFound) {
      if (allAdvAvailable) {
        entries.push({ deviceKey, sequence: 999, filename: 'all-adv.png' });
      } else if (defaultPngAvailable) {
        entries.push({ deviceKey, sequence: 999, filename: 'default.png' });
        substitutions.push({
          deviceKey,
          slot: 999,
          label: 'All Logo (gamepoint, match point)',
          filename: 'default.png',
          reason: 'all-adv.png unavailable for the 999 sentinel row; fell back to default.png'
        });
      } else {
        substitutions.push({
          deviceKey,
          slot: 999,
          label: 'All Logo (gamepoint, match point)',
          filename: null,
          reason: 'all-adv.png unavailable for the 999 sentinel row, and default.png also unavailable'
        });
      }
    }
  }

  return { entries, substitutions };
}

export function persistSequenceEntries(runId, entries) {
  const db = getDb();
  const insert = db.prepare('INSERT INTO SequenceEntries (RunId, DeviceKey, Sequence, Filename) VALUES (?, ?, ?, ?)');
  const run = db.transaction(() => {
    for (const e of entries) insert.run(runId, e.deviceKey, e.sequence, e.filename);
  });
  run();
}

function csvEscape(value) {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function generateSequenceCsv(eventId, entries) {
  const header = 'EventId,Filename,Target,Sequence';
  const rows = entries
    .slice()
    .sort((a, b) => (a.deviceKey === b.deviceKey ? a.sequence - b.sequence : a.deviceKey.localeCompare(b.deviceKey)))
    .map((e) => [eventId, e.filename, e.deviceKey, e.sequence].map(csvEscape).join(','));
  return [header, ...rows].join('\n') + '\n';
}
