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
}

/** Tracks recently used clip paths within a session to avoid repeats */
const recentlyUsedClips: string[] = [];
const recentlyUsedTracks: string[] = [];

/**
 * Select a random background video clip matching the given mood.
 * Avoids repeating recently used clips within the same session.
 * Falls back to any available clip if no mood-specific clips exist.
 */
export function selectBackgroundVideo(mood: MessageMood): string {
  const moodDir = path.join(ASSETS_DIR, mood);

  let clips: string[] = [];

  if (fs.existsSync(moodDir)) {
    clips = fs
      .readdirSync(moodDir)
      .filter((f) => f.endsWith('.mp4'))
      .map((f) => path.join(moodDir, f));
  }

  // Fallback: pick from any mood directory
  if (clips.length === 0) {
    const allMoods = fs.readdirSync(ASSETS_DIR).filter((d) => {
      const full = path.join(ASSETS_DIR, d);
      return fs.statSync(full).isDirectory();
    });

    for (const m of allMoods) {
      const dir = path.join(ASSETS_DIR, m);
      const found = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.mp4'))
        .map((f) => path.join(dir, f));
      clips.push(...found);
    }
  }

  if (clips.length === 0) {
    throw new Error(`No background video clips found in ${ASSETS_DIR}`);
  }

  // Filter out recently used clips to avoid repeats in a batch
  const available = clips.filter((c) => !recentlyUsedClips.includes(c));
  // If all clips have been used, reset history and allow any
  const pool = available.length > 0 ? available : clips;

  const selected = pool[Math.floor(Math.random() * pool.length)];
  recentlyUsedClips.push(selected);

  return selected;
}

/**
 * Select a random background music track matching the given mood.
 * Mirrors selectBackgroundVideo() — avoids repeats within a batch.
 * Falls back to any mood directory if no mood-specific tracks exist.
 */
export function selectBackgroundMusic(mood: MessageMood): string | null {
  const moodDir = path.join(MUSIC_DIR, mood);

  let tracks: string[] = [];

  if (fs.existsSync(moodDir)) {
    tracks = fs
      .readdirSync(moodDir)
      .filter((f) => f.endsWith('.mp3'))
      .map((f) => path.join(moodDir, f));
  }

  // Fallback: pick from any mood directory
  if (tracks.length === 0) {
    if (!fs.existsSync(MUSIC_DIR)) return null;
    const allMoods = fs.readdirSync(MUSIC_DIR).filter((d) => {
      const full = path.join(MUSIC_DIR, d);
      return fs.statSync(full).isDirectory();
    });

    for (const m of allMoods) {
      const dir = path.join(MUSIC_DIR, m);
      const found = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.mp3'))
        .map((f) => path.join(dir, f));
      tracks.push(...found);
    }
  }

  if (tracks.length === 0) return null;

  const available = tracks.filter((t) => !recentlyUsedTracks.includes(t));
  const pool = available.length > 0 ? available : tracks;

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
  const { width, height, durationSec, musicPath } = options;

  // Use blend-mode interpolation to convert any source fps to 30fps.
  // Blend mode crossfades between adjacent frames — produces smooth output
  // with ZERO edge artifacts (unlike MCI which glitches at start/end).
  // For slow ambient background footage, blend is visually identical to MCI.
  // Output is 2s longer than the composition needs so Remotion's <Video>
  // component never reaches the last frame of the background.
  const outputDuration = durationSec + 2;
  const videoFilters = [
    'minterpolate=fps=30:mi_mode=blend',
    `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${width}:${height}`,
    'eq=saturation=0.45:brightness=0.02',
    'colorbalance=rs=0.08:gs=0.04:bs=-0.04',
  ].join(',');

  const hasMusic = musicPath && fs.existsSync(musicPath);

  // Fade-out starts 2s before end; volume at 30% so text stays focus
  const fadeOutStart = Math.max(0, outputDuration - 2);
  const audioFilter = `afade=t=in:d=2,afade=t=out:st=${fadeOutStart}:d=2,volume=0.3`;

  // -g 1 forces every frame to be a keyframe (all-intra).
  // This is critical because Remotion seeks frame-by-frame when rendering;
  // without all-intra, the h264 decoder produces artifacts at non-keyframe positions.
  const args = hasMusic
    ? [
        '-y',
        '-i', inputPath,
        '-i', musicPath,
        '-t', String(outputDuration),
        '-vf', videoFilters,
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
        '-i', inputPath,
        '-t', String(outputDuration),
        '-vf', videoFilters,
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-crf', '12',
        '-g', '1',
        '-pix_fmt', 'yuv420p',
        '-an',
        '-r', '30',
        outputPath,
      ];

  console.log(`  Processing background: ${path.basename(inputPath)}`);
  console.log(`    → ${width}x${height}, ${durationSec}s, blend interpolation${hasMusic ? ', + music' : ''}`);

  await execFileAsync('ffmpeg', args);

  return outputPath;
}

/**
 * Select and process a background video for a cinematic render.
 * Always processes a fresh random clip to ensure visual variety across videos.
 */
export async function prepareBackgroundVideo(
  mood: MessageMood,
  width: number,
  height: number,
): Promise<string> {
  const outputDir = path.resolve(__dirname, '../../output/processed');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const rawClip = selectBackgroundVideo(mood);
  const musicTrack = selectBackgroundMusic(mood);
  const outputPath = path.join(
    outputDir,
    `bg-${mood}-${width}x${height}-${Date.now()}.mp4`,
  );

  if (musicTrack) {
    console.log(`  Music track: ${path.basename(musicTrack)}`);
  }

  await processBackgroundVideo(rawClip, outputPath, {
    width,
    height,
    durationSec: 8, // 240 frames at 30fps
    musicPath: musicTrack ?? undefined,
  });

  return outputPath;
}
