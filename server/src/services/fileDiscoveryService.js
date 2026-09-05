/**
 * Classifies raw discovered files (from SharePointService.discoverSourceFiles,
 * or any source producing the same {name, relativePath, ...} shape) into
 * Category A (fixed/template, CSV-driven) or Category B (per-event sponsor
 * ads), per plan §4A/§G. Never assumes a file is a deliverable just because
 * it sits in a particular folder - the LED-device token in the filename is
 * the deciding signal (plan §11), the folder is only used afterward to
 * resolve *which* Category A asset a match is.
 */

const DEVICE_TOKEN_PATTERNS = [
  { deviceKey: 'LED3', pattern: /led\s*3|\bovr\b/i },
  { deviceKey: 'LED1', pattern: /led\s*1\b/i },
  { deviceKey: 'LED2', pattern: /led\s*2\b/i }
];

export function detectDeviceToken(filename) {
  for (const { deviceKey, pattern } of DEVICE_TOKEN_PATTERNS) {
    if (pattern.test(filename)) return deviceKey;
  }
  return null;
}

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Strips the LED-device token (with one adjacent separator) and any "STILL"
 * marker, leaving the descriptive stem - used as the sponsor name for
 * Category B, and as a fallback exact-match candidate for Category A.
 */
// \b doesn't help before "led"/"ovr" here: filenames use "_" as a separator,
// and "_" counts as a word character in regex, so "_LED1" has no boundary
// between "_" and "L". Using explicit lookaround for "preceded/followed by
// a letter" instead, which underscore correctly fails.
const DEVICE_TOKEN_STRIP_PATTERN = /[\s_-]*(?<![a-zA-Z])(?:led\s*[123](?![a-zA-Z])|ovr(?![a-zA-Z]))[\s_-]*/gi;

export function stripDeviceTokenAndExtension(filename) {
  const withoutExt = filename.replace(/\.[^.]+$/, '');
  return withoutExt
    .replace(DEVICE_TOKEN_STRIP_PATTERN, ' ')
    .replace(/\bstill\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

/**
 * Category A resolution: exact canonical-filename match first (covers a
 * literal re-upload of e.g. default.png), otherwise match the file's source
 * subfolder against each active requirement's SourceFolderHint. See plan's
 * Stage 6 note on why folder-based matching is necessary here (source
 * filenames like "Champions_Montpellier - LED1.mp4" share no text with
 * their canonical name "Home Look.mp4").
 */
export function matchCategoryA(sourceFile, requirements) {
  const ext = getExtension(sourceFile.name);
  const stem = stripDeviceTokenAndExtension(sourceFile.name);
  const active = requirements.filter((r) => r.IsActive);

  const exact = active.find((r) => normalize(r.CanonicalFilename) === normalize(`${stem}.${ext}`));
  if (exact) return exact;

  const topFolder = sourceFile.relativePath.includes('/') ? sourceFile.relativePath.split('/')[0] : null;
  if (!topFolder) return null;

  const byFolder = active.filter((r) => r.SourceFolderHint && r.SourceFolderHint.toLowerCase() === topFolder.toLowerCase());
  if (byFolder.length === 1) return byFolder[0];
  if (byFolder.length > 1) {
    return byFolder.find((r) => r.CanonicalFilename.toLowerCase().endsWith(`.${ext}`)) || null;
  }
  return null;
}

/**
 * Classifies one discovered source file. Category B files are only
 * provisionally matched here - whether a given sponsor stem is actually
 * part of the current event's running order (and therefore kept, rather
 * than reported as an unreferenced orphan) is resolved in RunningOrderService.
 */
const OUT_OF_SCOPE_FOLDER_PATTERN = /led.?mapping/i;

export function classifyFile(sourceFile, requirements) {
  const topFolder = sourceFile.relativePath.includes('/') ? sourceFile.relativePath.split('/')[0] : null;
  if (topFolder && OUT_OF_SCOPE_FOLDER_PATTERN.test(topFolder)) {
    return {
      assetCategory: 'UNMATCHED',
      deviceKey: null,
      reason: 'Venue LED-mapping diagram - out of scope (plan §63A), not a deliverable asset'
    };
  }

  const ext = getExtension(sourceFile.name);
  if (ext !== 'png' && ext !== 'mp4') {
    return { assetCategory: 'UNMATCHED', deviceKey: null, reason: 'Unsupported file extension' };
  }

  const deviceKey = detectDeviceToken(sourceFile.name);
  if (!deviceKey) {
    return { assetCategory: 'UNMATCHED', deviceKey: null, reason: 'No LED-device token (LED1/LED2/LED3/OVR) found in filename' };
  }

  const requirement = matchCategoryA(sourceFile, requirements);
  if (requirement) {
    return {
      assetCategory: 'A',
      deviceKey,
      requirementId: requirement.Id,
      canonicalFilename: requirement.CanonicalFilename
    };
  }

  if (deviceKey === 'LED3') {
    return {
      assetCategory: 'UNMATCHED',
      deviceKey,
      reason: 'No Category A match, and sponsor ads (Category B) never target LED3/Main'
    };
  }

  const stem = stripDeviceTokenAndExtension(sourceFile.name);
  return {
    assetCategory: 'B',
    deviceKey,
    sponsorStem: stem,
    canonicalFilename: `${stem}.${ext}`
  };
}
