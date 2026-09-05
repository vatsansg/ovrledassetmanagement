import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { executeRun, checkRunPreconditions } from '../services/runService.js';
import { getSetting } from '../services/settingsService.js';

export const runRoutes = Router();

runRoutes.use(requireAuth);

runRoutes.get('/preconditions', async (req, res, next) => {
  try {
    res.json(await checkRunPreconditions());
  } catch (err) {
    next(err);
  }
});

runRoutes.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM ProcessingRuns ORDER BY StartTime DESC LIMIT 50').all());
});

runRoutes.get('/:runId', (req, res) => {
  const db = getDb();
  const run = db.prepare('SELECT * FROM ProcessingRuns WHERE RunId = ?').get(req.params.runId);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  const files = db.prepare('SELECT * FROM ProcessingFiles WHERE RunId = ? ORDER BY Id').all(req.params.runId);
  const validationResults = db
    .prepare(
      `SELECT vr.* FROM ValidationResults vr JOIN ProcessingFiles pf ON vr.ProcessingFileId = pf.Id WHERE pf.RunId = ?`
    )
    .all(req.params.runId);
  const renamedAssets = db.prepare('SELECT * FROM RenamedAssets WHERE RunId = ?').all(req.params.runId);
  const sequenceEntries = db
    .prepare('SELECT * FROM SequenceEntries WHERE RunId = ? ORDER BY DeviceKey, Sequence')
    .all(req.params.runId);
  const distributionResults = db.prepare('SELECT * FROM DistributionResults WHERE RunId = ?').all(req.params.runId);

  res.json({ run, files, validationResults, renamedAssets, sequenceEntries, distributionResults });
});

runRoutes.get('/:runId/sequence-csv', (req, res) => {
  const db = getDb();
  const run = db.prepare('SELECT * FROM ProcessingRuns WHERE RunId = ?').get(req.params.runId);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  const csvPath = path.join(getSetting('RenamedAssetsFolder') || '', `sequence_${req.params.runId}.csv`);
  if (!fs.existsSync(csvPath)) return res.status(404).json({ error: 'Sequence CSV not found for this run' });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="sequence_${req.params.runId}.csv"`);
  fs.createReadStream(csvPath).pipe(res);
});

runRoutes.post('/', async (req, res, next) => {
  try {
    const summary = await executeRun(req.user.sub);
    res.status(201).json(summary);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});
