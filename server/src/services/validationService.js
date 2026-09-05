import { inspectVideo, inspectImage } from './mediaInspectionService.js';

/**
 * Every rule here is sourced directly from the two-page PDF spec (plan §G) -
 * nothing invented. LED1/LED2 = "Surrounds" profile, LED3 = "Main" profile,
 * per the confirmed device-resolution mapping.
 */
const DEVICE_PROFILES = {
  LED1: { width: 1920, height: 1080 },
  LED2: { width: 1920, height: 1080 },
  LED3: { width: 3840, height: 2160 }
};

const VIDEO_FRAME_RATE = 25; // PDF p.1
const VIDEO_MAX_BITRATE_MBPS = 80; // PDF p.1 - labeled "Max File Size" but the unit is Mbps, a bitrate ceiling
const PNG_BIT_DEPTH = 32; // PDF p.2
const PNG_MAX_SIZE_BYTES = 4 * 1024 * 1024; // PDF p.2 - a literal file-size cap, not a bitrate

// No duration or audio-presence rule exists anywhere in the PDF, and none is
// implemented here - confirmed project-owner decision (plan §70B items 2-3).

function rule(ruleName, expectedValue, actualValue, passed, failureReason) {
  return {
    ruleName,
    expectedValue: String(expectedValue),
    actualValue: String(actualValue),
    result: passed ? 'PASS' : 'FAIL',
    failureReason: passed ? null : failureReason,
    severity: 'ERROR'
  };
}

export async function validateVideo(filePath, deviceKey) {
  const profile = DEVICE_PROFILES[deviceKey];
  const meta = await inspectVideo(filePath);
  const results = [];

  const isMp4 = meta.containerFormats.includes('mp4');
  results.push(
    rule('Format', 'MP4', isMp4 ? 'MP4' : meta.containerFormats.join('/'), isMp4, 'File is not a valid MP4 container (PDF p.1)')
  );

  const resolutionOk = meta.width === profile.width && meta.height === profile.height;
  results.push(
    rule(
      'Resolution',
      `${profile.width}x${profile.height}`,
      `${meta.width}x${meta.height}`,
      resolutionOk,
      `Resolution ${meta.width}x${meta.height} does not match ${deviceKey}'s required ${profile.width}x${profile.height} (PDF p.1)`
    )
  );

  results.push(
    rule(
      'Frame rate',
      `${VIDEO_FRAME_RATE} fps`,
      `${meta.frameRate} fps`,
      meta.frameRate === VIDEO_FRAME_RATE,
      `Frame rate ${meta.frameRate} fps does not match the required ${VIDEO_FRAME_RATE} fps (PDF p.1)`
    )
  );

  results.push(
    rule(
      'Max bitrate',
      `<= ${VIDEO_MAX_BITRATE_MBPS} Mbps`,
      `${meta.bitrateMbps.toFixed(2)} Mbps`,
      meta.bitrateMbps <= VIDEO_MAX_BITRATE_MBPS,
      `Bitrate ${meta.bitrateMbps.toFixed(2)} Mbps exceeds the ${VIDEO_MAX_BITRATE_MBPS} Mbps ceiling (PDF p.1)`
    )
  );

  return { results, metadata: meta };
}

export async function validateImage(filePath, deviceKey) {
  const profile = DEVICE_PROFILES[deviceKey];
  const meta = await inspectImage(filePath);
  const results = [];

  results.push(
    rule('Format', 'PNG', (meta.format || 'unknown').toUpperCase(), meta.format === 'png', 'File is not a valid PNG (PDF p.2)')
  );

  const resolutionOk = meta.width === profile.width && meta.height === profile.height;
  results.push(
    rule(
      'Resolution',
      `${profile.width}x${profile.height}`,
      `${meta.width}x${meta.height}`,
      resolutionOk,
      `Resolution ${meta.width}x${meta.height} does not match ${deviceKey}'s required ${profile.width}x${profile.height} (PDF p.2)`
    )
  );

  results.push(
    rule(
      'Bit depth',
      `${PNG_BIT_DEPTH}-bit`,
      meta.bitDepth ? `${meta.bitDepth}-bit` : 'unknown',
      meta.bitDepth === PNG_BIT_DEPTH,
      `Bit depth ${meta.bitDepth ?? 'unknown'} does not match the required ${PNG_BIT_DEPTH}-bit (PDF p.2)`
    )
  );

  const sizeMb = meta.sizeBytes / (1024 * 1024);
  results.push(
    rule(
      'Max file size',
      '<= 4 MB',
      `${sizeMb.toFixed(2)} MB`,
      meta.sizeBytes <= PNG_MAX_SIZE_BYTES,
      `File size ${sizeMb.toFixed(2)} MB exceeds the 4 MB ceiling (PDF p.2)`
    )
  );

  return { results, metadata: meta };
}

export async function validateAsset(filePath, extension, deviceKey) {
  if (!DEVICE_PROFILES[deviceKey]) {
    const err = new Error(`Unknown device key: ${deviceKey}`);
    err.status = 400;
    throw err;
  }
  if (extension === 'mp4') return validateVideo(filePath, deviceKey);
  if (extension === 'png') return validateImage(filePath, deviceKey);

  const err = new Error(`Unsupported extension for validation: ${extension}`);
  err.status = 400;
  throw err;
}

export function overallStatus(results) {
  return results.every((r) => r.result === 'PASS') ? 'VALID' : 'INVALID';
}
