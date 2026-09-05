import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { signInInteractive, getSignedInAccount, signOut } from '../services/msalService.js';
import { testConnection, discoverSourceFiles } from '../services/sharePointService.js';
import { broadcast } from '../utils/wsHub.js';
import { logger } from '../utils/logger.js';
import { getDb } from '../db/index.js';

export const sharePointRoutes = Router();

sharePointRoutes.use(requireAuth);

sharePointRoutes.get('/status', async (req, res, next) => {
  try {
    const account = await getSignedInAccount();
    res.json({ signedIn: !!account, username: account?.username || null });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

sharePointRoutes.post('/signin', (req, res) => {
  // Interactive sign-in opens the system browser and can take a while for the
  // operator to complete, so this responds immediately and reports the
  // outcome over the WebSocket rather than holding the HTTP request open.
  res.json({ status: 'started' });

  signInInteractive()
    .then((account) => {
      broadcast('sharepoint.signin.result', { status: 'success', username: account.username });
      getDb()
        .prepare('INSERT INTO AuditLog (UserId, EventType, Message) VALUES (?, ?, ?)')
        .run(req.user.sub, 'sharepoint.signin', `${req.user.username} signed in as ${account.username}`);
    })
    .catch((err) => {
      logger.error('SharePoint sign-in failed', { error: err.message });
      broadcast('sharepoint.signin.result', { status: 'error', message: err.message });
    });
});

sharePointRoutes.post('/signout', async (req, res, next) => {
  try {
    await signOut();
    getDb()
      .prepare('INSERT INTO AuditLog (UserId, EventType, Message) VALUES (?, ?, ?)')
      .run(req.user.sub, 'sharepoint.signout', `${req.user.username} signed out of Microsoft 365`);
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

sharePointRoutes.post('/test-connection', async (req, res, next) => {
  try {
    const result = await testConnection();
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

sharePointRoutes.get('/discover', async (req, res, next) => {
  try {
    const files = await discoverSourceFiles();
    res.json({ count: files.length, files });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});
