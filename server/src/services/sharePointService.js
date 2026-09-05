import { Client } from '@microsoft/microsoft-graph-client';
import { getDb } from '../db/index.js';
import { acquireTokenSilent, getSignedInAccount } from './msalService.js';

function getSetting(name) {
  const db = getDb();
  return db.prepare('SELECT Value FROM EventSettings WHERE SettingName = ?').get(name)?.Value || null;
}

function setSetting(name, value) {
  const db = getDb();
  db.prepare(
    `UPDATE EventSettings SET Value = ?, UpdatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE SettingName = ?`
  ).run(value, name);
}

/**
 * Deliberately does not depend on SharePoint's UI query parameters (viewid,
 * newTargetListUrl, Forms/AllItems.aspx) beyond reading `id` when present,
 * since that's the one parameter that reliably carries the true
 * server-relative path - master prompt §10.10. Falls back to parsing the
 * pathname directly when `id` is absent.
 */
export function parseSharePointUrl(sourceUrl) {
  let url;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw badRequest('Not a valid URL');
  }

  const idParam = url.searchParams.get('id');
  const serverRelativePath = decodeURIComponent(idParam || url.pathname).replace(/\/Forms\/.*$/i, '');
  const segments = serverRelativePath.split('/').filter(Boolean);

  const siteIdx = segments.findIndex((s) => s.toLowerCase() === 'sites' || s.toLowerCase() === 'teams');
  if (siteIdx === -1) throw badRequest('Could not find a /sites/ or /teams/ segment in this URL');

  const sitePath = segments.slice(siteIdx, siteIdx + 2).join('/');
  const remaining = segments.slice(siteIdx + 2);
  if (remaining.length === 0) throw badRequest('Could not determine the document library from this URL');

  return {
    hostname: url.hostname,
    sitePath,
    libraryName: remaining[0],
    folderPath: remaining.slice(1).join('/')
  };
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function describeGraphError(err) {
  if (err.body) {
    try {
      const parsed = JSON.parse(err.body);
      return parsed.error?.message || err.message;
    } catch {
      // fall through
    }
  }
  return err.message || 'Unknown Graph API error';
}

function getGraphClient() {
  return Client.init({
    authProvider: async (done) => {
      try {
        const result = await acquireTokenSilent();
        done(null, result.accessToken);
      } catch (err) {
        done(err, null);
      }
    }
  });
}

function pass(message) {
  return { result: 'PASS', message };
}
function fail(message) {
  return { result: 'FAIL', message };
}

/**
 * Walks Tenant -> Site -> Document Library -> Folder -> file listing exactly
 * as master prompt §10.6 requires, reporting each step individually rather
 * than collapsing to a single connected/not-connected flag.
 */
export async function testConnection() {
  const steps = {};
  const sourceUrl = getSetting('SharePointSourceLocation');
  if (!sourceUrl) {
    steps.authentication = fail('SharePointSourceLocation is not configured');
    return { steps, overall: 'FAIL' };
  }

  const account = await getSignedInAccount();
  if (!account) {
    steps.authentication = fail('Not signed in to Microsoft 365');
    return { steps, overall: 'FAIL' };
  }
  steps.authentication = pass(`Signed in as ${account.username}`);

  let parsed;
  try {
    parsed = parseSharePointUrl(sourceUrl);
  } catch (err) {
    steps.site = fail(err.message);
    return { steps, overall: 'FAIL' };
  }

  const client = getGraphClient();
  let siteId;
  let driveId;
  let folderId;

  try {
    const site = await client.api(`/sites/${parsed.hostname}:/${parsed.sitePath}`).get();
    siteId = site.id;
    steps.site = pass(`Resolved site: ${site.displayName || parsed.sitePath}`);
  } catch (err) {
    steps.site = fail(describeGraphError(err));
    return { steps, overall: 'FAIL' };
  }

  try {
    const drives = await client.api(`/sites/${siteId}/drives`).get();
    const drive = drives.value.find((d) => d.name === parsed.libraryName);
    if (!drive) throw new Error(`Document library "${parsed.libraryName}" not found on this site`);
    driveId = drive.id;
    steps.library = pass(`Resolved document library: ${drive.name}`);
  } catch (err) {
    steps.library = fail(describeGraphError(err));
    return { steps, overall: 'FAIL' };
  }

  try {
    const encodedPath = parsed.folderPath.split('/').map(encodeURIComponent).join('/');
    const folderApiPath = encodedPath ? `/drives/${driveId}/root:/${encodedPath}` : `/drives/${driveId}/root`;
    const folder = await client.api(folderApiPath).get();
    folderId = folder.id;
    steps.folder = pass(`Resolved folder: ${parsed.folderPath || '(library root)'}`);
  } catch (err) {
    steps.folder = fail(describeGraphError(err));
    return { steps, overall: 'FAIL' };
  }

  try {
    const children = await client.api(`/drives/${driveId}/items/${folderId}/children`).get();
    steps.fileListing = pass(`Listed ${children.value.length} item(s) in the source folder`);
  } catch (err) {
    steps.fileListing = fail(describeGraphError(err));
    return { steps, overall: 'FAIL' };
  }

  setSetting('SharePointSiteId', siteId);
  setSetting('SharePointDriveId', driveId);
  setSetting('SharePointFolderId', folderId);

  return { steps, overall: 'PASS' };
}

/**
 * Recursive listing of every file under the resolved source folder. Category
 * classification (LED-device token, Category A/B) happens in FileDiscoveryService,
 * not here - this is the raw Graph-derived file list only.
 */
export async function discoverSourceFiles() {
  const driveId = getSetting('SharePointDriveId');
  const folderId = getSetting('SharePointFolderId');
  if (!driveId || !folderId) {
    throw badRequest('Run Test Connection first to resolve the SharePoint source folder');
  }

  const client = getGraphClient();
  const files = [];

  async function walk(itemId, relativePath) {
    let page = client
      .api(`/drives/${driveId}/items/${itemId}/children`)
      .select('id,name,size,eTag,cTag,lastModifiedDateTime,file,folder');
    let response = await page.get();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      for (const item of response.value) {
        const itemRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name;
        if (item.folder) {
          await walk(item.id, itemRelativePath);
        } else {
          files.push({
            id: item.id,
            name: item.name,
            relativePath: itemRelativePath,
            size: item.size,
            eTag: item.eTag,
            cTag: item.cTag,
            lastModifiedDateTime: item.lastModifiedDateTime,
            quickXorHash: item.file?.hashes?.quickXorHash || null
          });
        }
      }
      if (!response['@odata.nextLink']) break;
      response = await client.api(response['@odata.nextLink']).get();
    }
  }

  await walk(folderId, '');
  return files;
}
