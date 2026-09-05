import fs from 'node:fs';
import path from 'node:path';
import { computeSha256 } from './fileHashService.js';

/**
 * Copies a validated, already-downloaded source file into the canonical
 * per-device output structure (RenamedAssetsFolder/<DeviceKey>/<CanonicalFilename>),
 * verifying the copy by hash before committing it - the original downloaded
 * file is never touched even if the copy fails (plan §20).
 */
export async function renameAsset({ sourcePath, deviceKey, canonicalFilename, renamedAssetsFolder }) {
  const destDir = path.join(renamedAssetsFolder, deviceKey);
  fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, canonicalFilename);
  const tmpPath = `${destPath}.tmp`;

  fs.copyFileSync(sourcePath, tmpPath);
  const [sourceHash, destHash] = await Promise.all([computeSha256(sourcePath), computeSha256(tmpPath)]);

  if (sourceHash !== destHash) {
    fs.unlinkSync(tmpPath);
    const err = new Error(`Copy verification failed for ${canonicalFilename} on ${deviceKey}`);
    err.status = 500;
    throw err;
  }

  fs.renameSync(tmpPath, destPath);
  return { destPath, contentHash: destHash };
}
