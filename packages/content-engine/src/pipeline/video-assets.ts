import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type { MessageMood } from '@wlu/shared';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ASSETS_DIR = path.resolve(__dirname, '../../assets/backgrounds');

interface ProcessOptions {
  width: number;
  height: number;
  durationSec: number;
  /** Playback speed multiplier (0.5 = half speed) */
  speed?: number;
}

/** Tracks recently used clip paths within a session to avoid repeats */
const recentlyUsedClips: string[] = [];

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
 * Process a raw background video clip:
 * - Center-crop to target aspect ratio
 * - Resize to target dimensions
 * - Apply warm desaturated color grade
 * - Slow down for cinematic feel
 * - Trim to exact duration
 */
export async function processBackgroundVideo(
  inputPath: string,
  outputPath: string,
  options: ProcessOptions,
): Promise<string> {
  const { width, height, durationSec, speed = 0.5 } = options;

  // Build FFmpeg filter chain:
  // 1. Slow down (setpts for video speed)
  // 2. Scale + center crop to target aspect ratio
  // 3. Warm desaturation color grade
  const filters = [
    // Slow down the video
    `setpts=${(1 / speed).toFixed(2)}*PTS`,
    // Scale to cover the target dimensions, then center-crop
    `scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
    // Warm desaturated color grade (heavy desaturation + warm tint)
    'eq=saturation=0.25:brightness=0.02',
    'colorbalance=rs=0.08:gs=0.04:bs=-0.04',
  ].join(',');

  const args = [
    '-y',
    '-i', inputPath,
    '-t', String(durationSec / speed), // Account for slowdown in source duration
    '-vf', filters,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-an', // No audio
    '-r', '30',
    outputPath,
  ];

  console.log(`  Processing background: ${path.basename(inputPath)}`);
  console.log(`    → ${width}x${height}, ${durationSec}s, ${speed}x speed`);

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
  const outputPath = path.join(
    outputDir,
    `bg-${mood}-${width}x${height}-${Date.now()}.mp4`,
  );

  await processBackgroundVideo(rawClip, outputPath, {
    width,
    height,
    durationSec: 10, // 300 frames at 30fps
    speed: 0.5,
  });

  return outputPath;
}
