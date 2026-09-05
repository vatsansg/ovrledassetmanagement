import Database from 'better-sqlite3';
import { env } from '../config/env.js';
import { runMigrations } from './migrate.js';
import { runSeed } from './seed.js';
import { logger } from '../utils/logger.js';

let db;

export function getDb() {
  if (db) return db;

  db = new Database(env.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  runSeed(db);

  logger.info(`Database ready at ${env.dbPath}`);
  return db;
}
