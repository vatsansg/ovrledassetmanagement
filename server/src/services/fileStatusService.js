import { getDb } from '../db/index.js';

/**
 * Keyed by (DeviceKey + CanonicalFilename) - the logical "slot" identity -
 * rather than raw source path, so an upstream filename change doesn't
 * register as a new logical asset (plan §H). Fast path: compare Graph
 * metadata (quickXorHash, falling back to eTag) against the last time this
 * logical asset was processed, without needing to download first.
 */
export function determineFileStatus(deviceKey, canonicalFilename, sourceFile) {
  const db = getDb();
  const previous = db
    .prepare(
      `SELECT * FROM ProcessingFiles
       WHERE DetectedDeviceToken = ? AND RenamedFilename = ? AND ValidationStatus = 'VALID'
       ORDER BY CreatedAt DESC LIMIT 1`
    )
    .get(deviceKey, canonicalFilename);

  if (!previous) {
    return { status: 'NEW', previous: null };
  }

  const sameByHash =
    sourceFile.quickXorHash && previous.GraphQuickXorHash && sourceFile.quickXorHash === previous.GraphQuickXorHash;
  const sameByETag = sourceFile.eTag && previous.GraphETag && sourceFile.eTag === previous.GraphETag;

  if (sameByHash || sameByETag) {
    return { status: 'NO_CHANGE', previous };
  }
  return { status: 'MODIFIED', previous };
}
