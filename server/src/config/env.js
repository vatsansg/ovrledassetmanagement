import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';

const dataDir = path.resolve(process.env.DATA_DIR || './data');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(path.join(dataDir, 'logs'), { recursive: true });
fs.mkdirSync(path.join(dataDir, 'downloads'), { recursive: true });
fs.mkdirSync(path.join(dataDir, 'renamed'), { recursive: true });
fs.mkdirSync(path.join(dataDir, 'defaults'), { recursive: true });

export const env = {
  port: Number(process.env.PORT) || 4000,
  dataDir,
  dbPath: path.join(dataDir, 'ledassetmanagement.db'),
  logsDir: path.join(dataDir, 'logs'),
  jwtSecretPath: path.join(dataDir, 'jwt.secret')
};
