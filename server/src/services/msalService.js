import { PublicClientApplication } from '@azure/msal-node';
import { PersistenceCreator, PersistenceCachePlugin, DataProtectionScope } from '@azure/msal-node-extensions';
import { exec } from 'node:child_process';
import path from 'node:path';
import { env } from '../config/env.js';
import { getDb } from '../db/index.js';
import { logger } from '../utils/logger.js';

// Sites.Read.All + Files.Read.All (delegated) rather than Sites.Selected: the
// operator signs in as themselves and can reach whatever SharePoint site/folder
// their own account can see, so a different event's source folder can be
// configured on the same laptop without a new admin consent step each time.
const SCOPES = ['Sites.Read.All', 'Files.Read.All'];

let cachedApp = null;
let cachedKey = null;

function openSystemBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) logger.error('Failed to open system browser for Microsoft 365 sign-in', { error: err.message });
  });
}

async function buildCachePlugin() {
  const cachePath = path.join(env.dataDir, 'msal-token-cache.json');
  const persistence = await PersistenceCreator.createPersistence({
    cachePath,
    dataProtectionScope: DataProtectionScope.CurrentUser,
    serviceName: 'OVRLedAssetManagement',
    accountName: 'msal-token-cache',
    usePlaintextFileOnLinux: false
  });
  return new PersistenceCachePlugin(persistence);
}

function readAzureAdConfig() {
  const db = getDb();
  const rows = db
    .prepare("SELECT SettingName, Value FROM EventSettings WHERE SettingName IN ('AzureAdTenantId','AzureAdClientId')")
    .all();
  const map = Object.fromEntries(rows.map((r) => [r.SettingName, r.Value]));
  return { tenantId: map.AzureAdTenantId, clientId: map.AzureAdClientId };
}

function configError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

export async function getMsalApp() {
  const { tenantId, clientId } = readAzureAdConfig();
  if (!tenantId || !clientId) {
    throw configError('AzureAdTenantId and AzureAdClientId must be configured in Settings before signing in');
  }

  const key = `${tenantId}:${clientId}`;
  if (cachedApp && cachedKey === key) return cachedApp;

  const cachePlugin = await buildCachePlugin();
  cachedApp = new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`
    },
    cache: { cachePlugin }
  });
  cachedKey = key;
  return cachedApp;
}

export async function getSignedInAccount() {
  const app = await getMsalApp();
  const accounts = await app.getTokenCache().getAllAccounts();
  return accounts[0] || null;
}

export async function signInInteractive() {
  const app = await getMsalApp();
  const result = await app.acquireTokenInteractive({
    scopes: SCOPES,
    openBrowser: async (url) => openSystemBrowser(url),
    successTemplate:
      '<h1>Signed in</h1><p>You can close this window and return to LED Asset Manager.</p>',
    errorTemplate:
      '<h1>Sign-in failed</h1><p>You can close this window and return to LED Asset Manager and try again.</p>'
  });
  return result.account;
}

export async function acquireTokenSilent() {
  const app = await getMsalApp();
  const account = await getSignedInAccount();
  if (!account) {
    const err = new Error('Not signed in to Microsoft 365');
    err.status = 401;
    throw err;
  }
  return app.acquireTokenSilent({ account, scopes: SCOPES });
}

export async function signOut() {
  const app = await getMsalApp();
  const accounts = await app.getTokenCache().getAllAccounts();
  for (const account of accounts) {
    await app.getTokenCache().removeAccount(account);
  }
}
