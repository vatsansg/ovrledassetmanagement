import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDb } from '../db/index.js';

/**
 * Targets are local/mapped-drive paths the operator has already connected
 * (e.g. L:\), not SMB/UNC construction or SFTP - per the user's explicit
 * answer. A real path-exists + directory + write-probe check, not a
 * simulated result (plan §68).
 */
export function testDeviceConnection(targetPath) {
  if (!targetPath) {
    return { result: 'FAIL', message: 'No target path configured' };
  }

  try {
    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return { result: 'FAIL', message: `${targetPath} exists but is not a directory` };
    }
  } catch (err) {
    return { result: 'FAIL', message: `Path not reachable: ${err.message}` };
  }

  const marker = path.join(targetPath, `.ledassetmanager-write-test-${crypto.randomBytes(4).toString('hex')}`);
  try {
    fs.writeFileSync(marker, 'write test');
    fs.unlinkSync(marker);
  } catch (err) {
    return { result: 'FAIL', message: `Path is not writable: ${err.message}` };
  }

  return { result: 'PASS', message: 'Path is reachable and writable' };
}

export function testAndRecordDeviceConnection(deviceKey) {
  const db = getDb();
  const device = db.prepare('SELECT * FROM LEDDevices WHERE DeviceKey = ?').get(deviceKey);
  if (!device) {
    const err = new Error(`Unknown device: ${deviceKey}`);
    err.status = 404;
    throw err;
  }

  const outcome = testDeviceConnection(device.TargetPath);
  db.prepare(
    `UPDATE LEDDevices SET LastConnectionTestAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), LastConnectionStatus = ?, LastConnectionMessage = ? WHERE DeviceKey = ?`
  ).run(outcome.result, outcome.message, deviceKey);

  return outcome;
}
