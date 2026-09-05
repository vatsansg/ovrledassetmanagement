import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import ffprobeStatic from 'ffprobe-static';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

const DEPTH_TO_BITS = {
  uchar: 8,
  char: 8,
  ushort: 16,
  short: 16,
  uint: 32,
  int: 32,
  float: 32,
  complex: 64,
  double: 64,
  dpcomplex: 128
};

/**
 * ffprobe (bundled via ffprobe-static, not present on this dev machine or any
 * end-user machine by default - must ship in the Windows installer, plan §O).
 */
export async function inspectVideo(filePath) {
  const { stdout } = await execFileAsync(ffprobeStatic.path, [
    '-v',
    'quiet',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath
  ]);
  const data = JSON.parse(stdout);
  const videoStream = data.streams?.find((s) => s.codec_type === 'video');
  const audioStream = data.streams?.find((s) => s.codec_type === 'audio');
  if (!videoStream) {
    const err = new Error('No video stream found in file');
    err.status = 400;
    throw err;
  }

  const [num, den] = (videoStream.r_frame_rate || '0/1').split('/').map(Number);
  const frameRate = den ? num / den : num;

  const sizeBytes = Number(data.format?.size) || fs.statSync(filePath).size;
  const durationSeconds = Number(data.format?.duration || videoStream.duration || 0);
  let bitrateBps = Number(data.format?.bit_rate);
  if (!bitrateBps && durationSeconds > 0) {
    bitrateBps = (sizeBytes * 8) / durationSeconds;
  }

  return {
    containerFormats: (data.format?.format_name || '').split(','),
    width: videoStream.width,
    height: videoStream.height,
    frameRate,
    bitrateMbps: bitrateBps / 1_000_000,
    sizeBytes,
    durationSeconds,
    hasAudio: !!audioStream
  };
}

export async function inspectImage(filePath) {
  const metadata = await sharp(filePath).metadata();
  const sizeBytes = fs.statSync(filePath).size;
  const bitsPerChannel = DEPTH_TO_BITS[metadata.depth] || null;

  return {
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    channels: metadata.channels,
    hasAlpha: metadata.hasAlpha,
    bitDepth: bitsPerChannel && metadata.channels ? bitsPerChannel * metadata.channels : null,
    sizeBytes
  };
}
