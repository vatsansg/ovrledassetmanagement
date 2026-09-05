import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { getDb } from '../db/index.js';
import { verifyCredentials, issueToken, changePassword, AuthError } from '../services/authService.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const authRoutes = Router();

authRoutes.post(
  '/login',
  body('username').isString().trim().notEmpty(),
  body('password').isString().notEmpty(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
      const user = verifyCredentials(req.body.username, req.body.password);
      const token = issueToken(user);
      res.json({
        token,
        user: {
          id: user.Id,
          username: user.Username,
          role: user.Role,
          mustChangePassword: !!user.MustChangePassword
        }
      });
    } catch (err) {
      if (err instanceof AuthError) return res.status(401).json({ error: err.publicMessage });
      next(err);
    }
  }
);

authRoutes.get('/me', requireAuth, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT Id, Username, Role, MustChangePassword FROM Users WHERE Id = ?').get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    id: user.Id,
    username: user.Username,
    role: user.Role,
    mustChangePassword: !!user.MustChangePassword
  });
});

authRoutes.post(
  '/change-password',
  requireAuth,
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isString().isLength({ min: 8 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    try {
      changePassword(req.user.sub, req.body.currentPassword, req.body.newPassword);
      res.json({ status: 'ok' });
    } catch (err) {
      if (err instanceof AuthError) return res.status(401).json({ error: err.publicMessage });
      next(err);
    }
  }
);
