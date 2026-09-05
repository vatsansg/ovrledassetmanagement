import { getDb } from '../db/index.js';

/**
 * Category A fallback resolution only - Category B (sponsor ad) fallback is
 * a different mechanism (missing sponsor -> all-adv.png -> default.png,
 * tied to running-order slots) handled in sequenceGenerator instead.
 *
 * `presentThisRun` is a Set of "<DeviceKey>:<CanonicalFilename>" keys that
 * were validated successfully during this run's classification pass.
 *
 * Device applicability for a Category A asset isn't a static rule (e.g.
 * HOME_Look.png only ever applied to LED3 in the real sample, never
 * LED1/LED2) - so a (device, asset) pair with no current file AND no prior
 * successful precedent is treated as not-yet-established rather than
 * blocked, to avoid wrongly blocking a combination that may simply not
 * apply to that device. This is a deliberate, documented judgment call
 * (plan follow-up), not a spec-confirmed rule.
 */
export function resolveCategoryAFallbacks(presentThisRun) {
  const db = getDb();
  const requirements = db.prepare('SELECT * FROM LED_File_Requirements WHERE IsActive = 1').all();
  const enabledDevices = db.prepare('SELECT * FROM LEDDevices WHERE Enabled = 1').all();

  const outcomes = [];

  for (const device of enabledDevices) {
    for (const req of requirements) {
      const key = `${device.DeviceKey}:${req.CanonicalFilename}`;
      if (presentThisRun.has(key)) {
        outcomes.push({ deviceKey: device.DeviceKey, canonicalFilename: req.CanonicalFilename, outcome: 'PRESENT' });
        continue;
      }

      const historical = db
        .prepare('SELECT 1 FROM RenamedAssets WHERE DeviceKey = ? AND CanonicalFilename = ? LIMIT 1')
        .get(device.DeviceKey, req.CanonicalFilename);
      if (!historical) continue; // no precedent this pair ever applied - not reported

      if (req.FallbackFilename) {
        outcomes.push({
          deviceKey: device.DeviceKey,
          canonicalFilename: req.CanonicalFilename,
          outcome: 'FALLBACK',
          fallbackFilename: req.FallbackFilename
        });
      } else if (req.IsPersistentAsset) {
        outcomes.push({
          deviceKey: device.DeviceKey,
          canonicalFilename: req.CanonicalFilename,
          outcome: 'PERSISTENT_ASSUMED_PRESENT'
        });
      } else {
        outcomes.push({
          deviceKey: device.DeviceKey,
          canonicalFilename: req.CanonicalFilename,
          outcome: 'BLOCKED',
          reason: `Required asset ${req.CanonicalFilename} missing for ${device.DeviceKey} with no fallback and no persistent-asset exemption`
        });
      }
    }
  }

  return outcomes;
}
