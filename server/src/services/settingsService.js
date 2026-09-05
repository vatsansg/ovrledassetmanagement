import { getDb } from '../db/index.js';

export function getSetting(name) {
  const db = getDb();
  return db.prepare('SELECT Value FROM EventSettings WHERE SettingName = ?').get(name)?.Value || null;
}

export function setSetting(name, value) {
  const db = getDb();
  db.prepare(
    `UPDATE EventSettings SET Value = ?, UpdatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE SettingName = ?`
  ).run(value, name);
}

export function getAllSettingsMap() {
  const db = getDb();
  const rows = db.prepare('SELECT SettingName, Value FROM EventSettings').all();
  return Object.fromEntries(rows.map((r) => [r.SettingName, r.Value]));
}
