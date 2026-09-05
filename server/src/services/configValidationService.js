import { getDb } from '../db/index.js';

/**
 * Computes honest configuration status: which required settings are missing,
 * whether at least one LED device is enabled with a target path, and an
 * overall ready-to-run flag. Nothing here is fabricated - every field reflects
 * an actual row in EventSettings / LEDDevices.
 */
export function getConfigurationStatus() {
  const db = getDb();

  const settings = db.prepare('SELECT * FROM EventSettings ORDER BY SettingName').all();
  const missingRequired = settings.filter((s) => s.IsRequired && (s.Value === null || s.Value === ''));

  const devices = db.prepare('SELECT * FROM LEDDevices ORDER BY DeviceKey').all();
  const enabledDevices = devices.filter((d) => d.Enabled);
  const enabledWithoutTargetPath = enabledDevices.filter((d) => !d.TargetPath);

  const ledRequirementsCount = db.prepare('SELECT COUNT(*) AS n FROM LED_File_Requirements').get().n;

  const isReady =
    missingRequired.length === 0 &&
    enabledDevices.length >= 1 &&
    enabledWithoutTargetPath.length === 0 &&
    ledRequirementsCount > 0;

  return {
    settings: settings.map((s) => ({
      settingName: s.SettingName,
      value: s.IsSensitive ? (s.Value ? '••••••••' : null) : s.Value,
      description: s.Description,
      dataType: s.DataType,
      isRequired: !!s.IsRequired,
      isSensitive: !!s.IsSensitive,
      isMissing: !!s.IsRequired && (s.Value === null || s.Value === ''),
      updatedAt: s.UpdatedAt
    })),
    devices: devices.map((d) => ({
      deviceKey: d.DeviceKey,
      displayLabel: d.DisplayLabel,
      resolutionWidth: d.ResolutionWidth,
      resolutionHeight: d.ResolutionHeight,
      targetPath: d.TargetPath,
      enabled: !!d.Enabled,
      lastConnectionTestAt: d.LastConnectionTestAt,
      lastConnectionStatus: d.LastConnectionStatus,
      lastConnectionMessage: d.LastConnectionMessage
    })),
    ledRequirementsImported: ledRequirementsCount > 0,
    ledRequirementsCount,
    missingRequiredSettings: missingRequired.map((s) => s.SettingName),
    enabledDeviceCount: enabledDevices.length,
    isReady
  };
}
