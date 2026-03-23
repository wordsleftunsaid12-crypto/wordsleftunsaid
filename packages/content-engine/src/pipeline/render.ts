import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type CompositionId =
  | 'CinematicVertical'
  | 'CinematicSquare'
  | 'TextOnGradientVertical'
  | 'DeletedTextVertical'
  | 'QuoteCardVertical'
  | 'SplitScreenVertical'
  | 'HandwritingSVGVertical'
  | 'RawTextVertical';

export interface RenderOptions {
  compositionId: CompositionId;
  props: {
    from: string;
    to: string;
    content: string;
    backgroundVideo?: string;
    /** Background image filename (relative to public/) for static templates */
    backgroundImage?: string;
    /** Music filename (relative to public/) for templates using <Audio> */
    musicFile?: string;
    ctaLine1?: string;
    ctaLine2?: string;
    mood?: string;
  };
  outputPath: string;
}

export function isCinematic(compositionId: CompositionId): boolean {
  return compositionId.startsWith('Cinematic');
}

export function needsBackgroundVideo(compositionId: CompositionId): boolean {
  return compositionId.startsWith('Cinematic')
    || compositionId.startsWith('TextOnGradient')
    || compositionId.startsWith('HandwritingSVG')
    || compositionId.startsWith('SplitScreen');
}

export function needsMusicFile(compositionId: CompositionId): boolean {
  return !compositionId.startsWith('Cinematic')
    && !compositionId.startsWith('QuoteCard')
    && !compositionId.startsWith('RawText');
}

export function needsBackgroundImage(compositionId: CompositionId): boolean {
  return compositionId.startsWith('QuoteCard') || compositionId.startsWith('RawText');
}

/**
 * Extract a single frame from a video as a JPEG image.
 * Used for static templates that need a background image (not video).
 */
export async function extractFrameFromVideo(
  videoPath: string,
  outputPath: string,
  timeSec = 2,
): Promise<string> {
  await execFileAsync('ffmpeg', [
    '-y',
    '-ss', String(timeSec),
    '-i', videoPath,
    '-vframes', '1',
    '-q:v', '2',
    outputPath,
  ]);
  return outputPath;
}

export function isStaticTemplate(compositionId: CompositionId): boolean {
  return compositionId.startsWith('QuoteCard') || compositionId.startsWith('RawText');
}

/**
 * Get the best frame number for cover/thumbnail extraction.
 * All templates use useLoopFade() which fades from black over 15 frames,
 * so frame 0 is completely black. We pick a frame where content is visible.
 */
export function getCoverFrame(compositionId: CompositionId): number {
  // Static templates: single frame
  if (isStaticTemplate(compositionId)) return 0;
  // Phone UI templates: show the UI chrome + early typing
  if (compositionId.startsWith('DeletedText')) return 30;
  // SplitScreen: both halves visible
  if (compositionId.startsWith('SplitScreen')) return 70;
  // HandwritingSVG: mid-writing
  if (compositionId.startsWith('HandwritingSVG')) return 90;
  // All other templates: frame 20
  return 20;
}

/** Cached bundle URL — avoids re-bundling for every video in a batch */
let cachedBundleUrl: string | null = null;
/** In-flight bundling promise — serializes concurrent calls */
let bundlingPromise: Promise<string> | null = null;

/**
 * Bundle the Remotion project once. Reuses the cached bundle for subsequent calls.
 * Serializes concurrent calls so only one bundling operation runs at a time.
 */
export async function ensureBundle(): Promise<string> {
  if (cachedBundleUrl) return cachedBundleUrl;
  if (bundlingPromise) return bundlingPromise;

  const entryPoint = path.resolve(__dirname, '../compositions/Root.tsx');

  console.log('Bundling Remotion project (one-time)...');
  bundlingPromise = bundle({
    entryPoint,
    onProgress: (progress) => {
      if (progress % 25 === 0) console.log(`  Bundle progress: ${progress}%`);
    },
  });

  cachedBundleUrl = await bundlingPromise;
  bundlingPromise = null;
  return cachedBundleUrl;
}

/**
 * Copy a file into the cached bundle's public directory so Remotion can serve it.
 * Must be called after ensureBundle() and before renderVideo() for dynamic assets.
 */
export function copyToBundle(srcPath: string, filename: string): void {
  if (!cachedBundleUrl) return;
  const dest = path.join(cachedBundleUrl, 'public', filename);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(srcPath, dest);
}

export async function renderVideo(options: RenderOptions): Promise<string> {
  const { compositionId, props, outputPath } = options;

  const bundled = await ensureBundle();

  console.log('Selecting composition...');
  const composition = await selectComposition({
    serveUrl: bundled,
    id: compositionId,
    inputProps: props,
  });

  console.log(`Rendering ${composition.width}x${composition.height} @ ${composition.fps}fps...`);
  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: props,
    onProgress: ({ progress }) => {
      if (Math.round(progress * 100) % 20 === 0) {
        console.log(`  Render progress: ${Math.round(progress * 100)}%`);
      }
    },
  });

  console.log(`Video saved to: ${outputPath}`);
  return outputPath;
}

/**
 * Render a static image (PNG) for templates that don't produce video.
 * Used by QuoteCard (Pinterest) and RawText (social preview) templates.
 */
export async function renderStaticImage(options: RenderOptions): Promise<string> {
  const { compositionId, props, outputPath } = options;

  const bundled = await ensureBundle();

  console.log('Selecting composition...');
  const composition = await selectComposition({
    serveUrl: bundled,
    id: compositionId,
    inputProps: props,
  });

  const pngPath = outputPath.replace(/\.mp4$/, '.png');
  console.log(`Rendering static image ${composition.width}x${composition.height}...`);
  await renderStill({
    composition,
    serveUrl: bundled,
    output: pngPath,
    frame: 0,
    inputProps: props,
    imageFormat: 'png',
  });

  console.log(`Static image saved to: ${pngPath}`);
  return pngPath;
}

/**
 * Extract a cover frame directly from a rendered MP4 using FFmpeg.
 * This guarantees the cover matches the video pixel-for-pixel (no separate
 * Remotion render that could have different Video component seeking behavior).
 */
export async function extractCoverFromVideo(
  videoPath: string,
  outputPath: string,
  frame = 0,
): Promise<string> {
  const fps = 30;
  const timestamp = frame / fps;

  console.log(`Extracting cover frame ${frame} from rendered video...`);
  await execFileAsync('ffmpeg', [
    '-y',
    '-ss', String(timestamp),
    '-i', videoPath,
    '-vframes', '1',
    '-q:v', '1',
    outputPath,
  ]);

  console.log(`Cover frame saved to: ${outputPath}`);
  return outputPath;
}

/**
 * Render a single frame as a PNG cover image via Remotion.
 * Used as fallback when the video hasn't been rendered yet (e.g., QA frame extraction).
 * Prefer extractCoverFromVideo() for production covers.
 */
export async function renderCoverFrame(options: {
  compositionId: CompositionId;
  props: Record<string, unknown>;
  outputPath: string;
  frame?: number;
}): Promise<string> {
  const bundled = await ensureBundle();

  const composition = await selectComposition({
    serveUrl: bundled,
    id: options.compositionId,
    inputProps: options.props,
  });

  console.log(`Rendering cover frame ${options.frame ?? 0}...`);
  await renderStill({
    composition,
    serveUrl: bundled,
    output: options.outputPath,
    frame: options.frame ?? 0,
    inputProps: options.props,
    imageFormat: 'png',
  });

  console.log(`Cover frame saved to: ${options.outputPath}`);
  return options.outputPath;
}
