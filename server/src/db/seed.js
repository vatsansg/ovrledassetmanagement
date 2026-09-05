import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.js';

const REQUIRED_SETTINGS_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../config/required-settings.json'
);

const DEFAULT_LED_DEVICES = [
  { deviceKey: 'LED1', displayLabel: 'Inner', width: 1920, height: 1080 },
  { deviceKey: 'LED2', displayLabel: 'Outer', width: 1920, height: 1080 },
  { deviceKey: 'LED3', displayLabel: 'Main', width: 3840, height: 2160 }
];

function seedEventSettingsDefinitions(db) {
  const definitions = JSON.parse(fs.readFileSync(REQUIRED_SETTINGS_PATH, 'utf8'));
  const upsertMetadata = db.prepare(`
    INSERT INTO EventSettings (SettingName, Description, DataType, IsRequired, IsSensitive)
    VALUES (@settingName, @description, @dataType, @isRequired, @isSensitive)
    ON CONFLICT (SettingName) DO UPDATE SET
      Description = excluded.Description,
      DataType = excluded.DataType,
      IsRequired = excluded.IsRequired,
      IsSensitive = excluded.IsSensitive
  `);
  const seed = db.transaction((rows) => {
    for (const row of rows) {
      upsertMetadata.run({
        settingName: row.settingName,
        description: row.description,
        dataType: row.dataType,
        isRequired: row.isRequired ? 1 : 0,
        isSensitive: row.isSensitive ? 1 : 0
      });
    }
  });
  seed(definitions);
}

function seedDefaultSuperAdmin(db) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM Users').get().n;
  if (count > 0) return;

  const passwordHash = bcrypt.hashSync('Admin@123', 10);
  db.prepare(
    `INSERT INTO Users (Username, PasswordHash, Role, IsActive, MustChangePassword) VALUES (?, ?, 'SuperAdmin', 1, 1)`
  ).run('admin', passwordHash);
  logger.info('Seeded default SuperAdmin user "admin" (password must be changed on first login)');
}

function seedLedDevices(db) {
  const insertIfMissing = db.prepare(`
    INSERT INTO LEDDevices (DeviceKey, DisplayLabel, ResolutionWidth, ResolutionHeight, Enabled, LastConnectionStatus)
    VALUES (?, ?, ?, ?, 0, 'UNTESTED')
    ON CONFLICT (DeviceKey) DO NOTHING
  `);
  const seed = db.transaction((devices) => {
    for (const d of devices) {
      insertIfMissing.run(d.deviceKey, d.displayLabel, d.width, d.height);
    }
  });
  seed(DEFAULT_LED_DEVICES);
}

export function runSeed(db) {
  seedEventSettingsDefinitions(db);
  seedDefaultSuperAdmin(db);
  seedLedDevices(db);
}
