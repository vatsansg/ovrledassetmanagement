import fs from 'node:fs';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

export function getOrCreateJwtSecret() {
  if (fs.existsSync(env.jwtSecretPath)) {
    return fs.readFileSync(env.jwtSecretPath, 'utf8').trim();
  }
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(env.jwtSecretPath, secret, { mode: 0o600 });
  return secret;
}
