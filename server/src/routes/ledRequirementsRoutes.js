import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { getDb } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { parseAndDeriveCsv, diffImport, applyImport } from '../services/ledRequirementsService.js';

export const ledRequirementsRoutes = Router();

ledRequirementsRoutes.use(requireAuth);

ledRequirementsRoutes.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM LED_File_Requirements ORDER BY IsActive DESC, CanonicalFilename').all());
});

ledRequirementsRoutes.post(
  '/preview-import',
  requireRole('SuperAdmin'),
  body('csvContent').isString().notEmpty(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'csvContent is required' });
    try {
      const { derived, skipped } = parseAndDeriveCsv(req.body.csvContent);
      const diff = diffImport(derived);
      res.json({ ...diff, skipped, totalRows: derived.length });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  }
);

ledRequirementsRoutes.post(
  '/apply-import',
  requireRole('SuperAdmin'),
  body('csvContent').isString().notEmpty(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'csvContent is required' });
    try {
      const { derived, skipped } = parseAndDeriveCsv(req.body.csvContent);
      const result = applyImport(derived, req.user.sub);
      res.json({ ...result, skipped });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  }
);
