import fs from 'node:fs';
import crypto from 'node:crypto';

/**
 * Streamed so large video files never load fully into memory - plan §H.
 */
export function computeSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
