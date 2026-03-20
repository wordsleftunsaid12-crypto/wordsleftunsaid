import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type { MessageMood } from '@wlu/shared';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ASSETS_DIR = path.resolve(__dirname, '../../assets/backgrounds');
const MUSIC_DIR = path.resolve(__dirname, '../../assets/music');

interface ProcessOptions {
  width: number;
  height: number;
  durationSec: number;
  /** Path to background music track to mix in (optional) */
  musicPath?: string;
  /** Start offset in seconds into the source clip (for variety) */
  startOffset?: number;
  /** Whether to mirror the clip horizontally */
  hflip?: boolean;
  /** Color grade variation: saturation multiplier (default ~0.45) */
  saturation?: number;
  /** Color grade variation: brightness offset (default ~0.02) */
  brightness?: number;
  /** Color balance shift: red shadows (default ~0.08) */
  colorRs?: number;
}

/** Tracks recently used clip paths within a session to avoid repeats */
const recentlyUsedClips: string[] = [];
const recentlyUsedTracks: string[] = [];

/**
 * Collect all clips from a specific mood directory.
 */
function getClipsForMood(mood: MessageMood): string[] {
  const moodDir = path.join(ASSETS_DIR, mood);
  if (!fs.existsSync(moodDir)) return [];
  return fs
    .readdirSync(moodDir)
    .filter((f) => f.endsWith('.mp4'))
    .map((f) => path.join(moodDir, f));
}

/**
 * Collect all clips across all mood directories.
 */
function getAllClips(): string[] {
  if (!fs.existsSync(ASSETS_DIR)) return [];
  const allClips: string[] = [];
  const dirs = fs.readdirSync(ASSETS_DIR).filter((d) => {
    const full = path.join(ASSETS_DIR, d);
    try { return fs.statSync(full).isDirectory(); } catch { return false; }
  });
  for (const d of dirs) {
    allClips.push(...getClipsForMood(d as MessageMood));
  }
  return allClips;
}

/**
 * Select a background video clip matching the given mood.
 * Prefers clips from the mood-specific directory, falls back to all clips.
 */
export function selectBackgroundVideo(mood: MessageMood): string {
  // Try mood-specific clips first
  let pool = getClipsForMood(mood).filter((c) => !recentlyUsedClips.includes(c));

  // Fall back to all clips if mood dir is exhausted
  if (pool.length === 0) {
    pool = getAllClips().filter((c) => !recentlyUsedClips.includes(c));
  }

  // Last resort: reset and use everything
  if (pool.length === 0) {
    pool = getAllClips();
  }

  if (pool.length === 0) {
    throw new Error(`No background video clips found in ${ASSETS_DIR}`);
  }

  const selected = pool[Math.floor(Math.random() * pool.length)];
  recentlyUsedClips.push(selected);

  return selected;
}

/**
 * Select a background music track matching the given mood.
 * Prefers tracks from the mood-specific directory, falls back to all tracks.
 */
export function selectBackgroundMusic(mood: MessageMood): string | null {
  if (!fs.existsSync(MUSIC_DIR)) return null;

  const getTracksForMood = (m: string): string[] => {
    const moodDir = path.join(MUSIC_DIR, m);
    if (!fs.existsSync(moodDir)) return [];
    return fs
      .readdirSync(moodDir)
      .filter((f) => f.endsWith('.mp3'))
      .map((f) => path.join(moodDir, f));
  };

  const getAllTracks = (): string[] => {
    if (!fs.existsSync(MUSIC_DIR)) return [];
    const all: string[] = [];
    const dirs = fs.readdirSync(MUSIC_DIR).filter((d) => {
      const full = path.join(MUSIC_DIR, d);
      try { return fs.statSync(full).isDirectory(); } catch { return false; }
    });
    for (const d of dirs) {
      all.push(...getTracksForMood(d));
    }
    return all;
  };

  // Try mood-specific tracks first
  let pool = getTracksForMood(mood).filter((t) => !recentlyUsedTracks.includes(t));

  if (pool.length === 0) {
    pool = getAllTracks().filter((t) => !recentlyUsedTracks.includes(t));
  }

  if (pool.length === 0) {
    pool = getAllTracks();
  }

  if (pool.length === 0) return null;

  const selected = pool[Math.floor(Math.random() * pool.length)];
  recentlyUsedTracks.push(selected);

  return selected;
}

/**
 * Process a raw background video clip:
 * - Motion-interpolate to 30fps (MCI — smooth, no ghosting or judder)
 * - Center-crop to target aspect ratio with lanczos scaling
 * - Apply warm desaturated color grade
 * - Trim to exact duration
 * - Mix in background music (fade in/out, low volume)
 */
export async function processBackgroundVideo(
  inputPath: string,
  outputPath: string,
  options: ProcessOptions,
): Promise<string> {
  const {
    width, height, durationSec, musicPath,
    startOffset = 0,
    hflip = false,
    saturation = 0.45,
    brightness = 0.02,
    colorRs = 0.08,
  } = options;

  // Use blend-mode interpolation to convert any source fps to 30fps.
  // Blend mode crossfades between adjacent frames — produces smooth output
  // with ZERO edge artifacts (unlike MCI which glitches at start/end).
  // For slow ambient background footage, blend is visually identical to MCI.
  // Output is 2s longer than the composition needs so Remotion's <Video>
  // component never reaches the last frame of the background.
  const outputDuration = durationSec + 2;
  const filterChain = [
    'minterpolate=fps=30:mi_mode=blend',
    `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${width}:${height}`,
    ...(hflip ? ['hflip'] : []),
    `eq=saturation=${saturation.toFixed(2)}:brightness=${brightness.toFixed(3)}`,
    `colorbalance=rs=${colorRs.toFixed(3)}:gs=0.04:bs=-0.04`,
  ].join(',');

  const hasMusic = musicPath && fs.existsSync(musicPath);

  // Fade-out starts 2s before end; volume at 30% so text stays focus
  const fadeOutStart = Math.max(0, outputDuration - 2);
  const audioFilter = `afade=t=in:d=2,afade=t=out:st=${fadeOutStart}:d=2,volume=0.3`;

  // -g 1 forces every frame to be a keyframe (all-intra).
  // This is critical because Remotion seeks frame-by-frame when rendering;
  // without all-intra, the h264 decoder produces artifacts at non-keyframe positions.
  const seekArgs = startOffset > 0 ? ['-ss', String(startOffset)] : [];

  const args = hasMusic
    ? [
        '-y',
        ...seekArgs,
        '-i', inputPath,
        '-i', musicPath,
        '-t', String(outputDuration),
        '-vf', filterChain,
        '-filter_complex', `[1:a]${audioFilter}[a]`,
        '-map', '0:v',
        '-map', '[a]',
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-crf', '12',
        '-g', '1',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-r', '30',
        '-shortest',
        outputPath,
      ]
    : [
        '-y',
        ...seekArgs,
        '-i', inputPath,
        '-t', String(outputDuration),
        '-vf', filterChain,
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-crf', '12',
        '-g', '1',
        '-pix_fmt', 'yuv420p',
        '-an',
        '-r', '30',
        outputPath,
      ];

  const flipLabel = hflip ? ', flipped' : '';
  const offsetLabel = startOffset > 0 ? `, offset ${startOffset.toFixed(1)}s` : '';
  console.log(`  Processing background: ${path.basename(inputPath)}`);
  console.log(`    → ${width}x${height}, ${durationSec}s, blend${flipLabel}${offsetLabel}${hasMusic ? ', + music' : ''}`);

  await execFileAsync('ffmpeg', args);

  return outputPath;
}

/**
 * Get the duration of a video file in seconds via ffprobe.
 */
async function getClipDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'quiet',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    filePath,
  ]);
  return parseFloat(stdout.trim()) || 0;
}

/**
 * Generate random visual transformations for a background clip.
 * Ensures each render looks distinct even when using the same source clip.
 */
function randomTransformations(clipDuration: number, neededDuration: number): {
  startOffset: number;
  hflip: boolean;
  saturation: number;
  brightness: number;
  colorRs: number;
} {
  // Random start offset: use any part of the clip that leaves enough room
  const maxOffset = Math.max(0, clipDuration - neededDuration - 2);
  const startOffset = maxOffset > 1 ? Math.random() * maxOffset : 0;

  // 50% chance of horizontal flip
  const hflip = Math.random() < 0.5;

  // Subtle color grade variation (keeps the cinematic look but feels different)
  const saturation = 0.35 + Math.random() * 0.2;   // 0.35 – 0.55
  const brightness = Math.random() * 0.04;           // 0.00 – 0.04
  const colorRs = 0.04 + Math.random() * 0.08;       // 0.04 – 0.12

  return { startOffset, hflip, saturation, brightness, colorRs };
}

/**
 * Select and process a background video for a cinematic render.
 * Applies random transformations (offset, flip, color jitter) so the same
 * source clip produces visually distinct backgrounds each time.
 */
export async function prepareBackgroundVideo(
  mood: MessageMood,
  width: number,
  height: number,
  durationSec = 8,
  withMusic = true,
): Promise<string> {
  const outputDir = path.resolve(__dirname, '../../output/processed');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const rawClip = selectBackgroundVideo(mood);
  const musicTrack = withMusic ? selectBackgroundMusic(mood) : null;
  const outputPath = path.join(
    outputDir,
    `bg-${mood}-${width}x${height}-${Date.now()}.mp4`,
  );

  if (musicTrack) {
    console.log(`  Music track: ${path.basename(musicTrack)}`);
  }

  // Probe clip duration and generate random visual transformations
  const clipDuration = await getClipDuration(rawClip);
  const transforms = randomTransformations(clipDuration, durationSec);

  console.log(`  Transforms: offset=${transforms.startOffset.toFixed(1)}s, flip=${transforms.hflip}, sat=${transforms.saturation.toFixed(2)}`);

  await processBackgroundVideo(rawClip, outputPath, {
    width,
    height,
    durationSec,
    musicPath: musicTrack ?? undefined,
    ...transforms,
  });

  return outputPath;
}
