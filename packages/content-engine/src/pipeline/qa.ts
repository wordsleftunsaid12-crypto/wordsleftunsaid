import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const QA_OUTPUT_DIR = path.resolve(__dirname, '../../output/qa');

// ─── Types ───────────────────────────────────────────────────────────────────

interface VideoMetadata {
  width: number;
  height: number;
  durationSec: number;
  codec: string;
  fileSizeBytes: number;
  fps: number;
}

interface QACheck {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

interface FrameCapture {
  label: string;
  frameNumber: number;
  timestampSec: number;
  path: string;
}

export interface QAReport {
  videoPath: string;
  timestamp: string;
  metadata: VideoMetadata;
  checks: QACheck[];
  frameScreenshots: FrameCapture[];
  contactSheetPath?: string;
  passed: boolean;
}

interface TimingParams {
  fromDelay: number;
  fromFullyVisible: number;
  contentFadeOutStart: number;
  ctaStart: number;
  fps: number;
}

// ─── Video Metadata ──────────────────────────────────────────────────────────

async function getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    videoPath,
  ]);

  let info: {
    streams: Array<{
      codec_type: string;
      codec_name: string;
      width: number;
      height: number;
      r_frame_rate: string;
    }>;
    format: { duration: string; size: string };
  };

  try {
    info = JSON.parse(stdout);
  } catch {
    throw new Error(`Failed to parse ffprobe output: ${stdout.slice(0, 200)}`);
  }

  const videoStream = info.streams.find((s) => s.codec_type === 'video');
  if (!videoStream) throw new Error('No video stream found');

  // Parse frame rate (e.g., "30/1" → 30)
  const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
  const fps = den ? num / den : num;

  return {
    width: videoStream.width,
    height: videoStream.height,
    durationSec: parseFloat(info.format.duration),
    codec: videoStream.codec_name,
    fileSizeBytes: parseInt(info.format.size, 10),
    fps: Math.round(fps),
  };
}

// ─── Timing Computation (mirrors cinematic.tsx logic) ────────────────────────

export function computeTimingParams(content: string, durationInFrames: number = 240): TimingParams {
  const words = content.split(' ');
  const contentDelay = 15;

  // Mirrors adaptive timing from cinematic.tsx
  const FROM_GAP = 10;
  const FROM_FADE_IN = 15;
  const FADE_OUT = 18;
  const CTA_RESERVE = 30;
  const fixedOverhead = FROM_GAP + FROM_FADE_IN + FADE_OUT + CTA_RESERVE;

  const budget = durationInFrames - contentDelay - fixedOverhead;
  const idealWordReveal = Math.max(words.length * 5, 50);
  const idealFromVisible = 50;
  const idealTotal = idealWordReveal + idealFromVisible;

  let wordRevealDuration: number;
  let fromVisibleDuration: number;
  if (idealTotal > budget) {
    const ratio = budget / idealTotal;
    wordRevealDuration = Math.max(Math.floor(idealWordReveal * ratio), 40);
    fromVisibleDuration = Math.max(Math.floor(idealFromVisible * ratio), 20);
  } else {
    wordRevealDuration = idealWordReveal;
    fromVisibleDuration = idealFromVisible;
  }

  const fromDelay = contentDelay + wordRevealDuration + FROM_GAP;
  const fromFullyVisible = fromDelay + FROM_FADE_IN;
  const contentFadeOutStart = fromFullyVisible + fromVisibleDuration;
  const ctaStart = contentFadeOutStart + FADE_OUT;

  return { fromDelay, fromFullyVisible, contentFadeOutStart, ctaStart, fps: 30 };
}

// ─── Frame Extraction ────────────────────────────────────────────────────────

async function extractFrame(
  videoPath: string,
  timestampSec: number,
  outputPath: string,
): Promise<string> {
  await execFileAsync('ffmpeg', [
    '-y',
    '-ss', String(Math.max(0, timestampSec)),
    '-i', videoPath,
    '-frames:v', '1',
    '-q:v', '2',
    outputPath,
  ]);
  return outputPath;
}

async function extractKeyFrames(
  videoPath: string,
  timing: TimingParams,
  outputDir: string,
  videoDurationSec: number,
): Promise<FrameCapture[]> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const frames: Array<{ label: string; frameNumber: number }> = [
    { label: 'hook-text', frameNumber: 0 },
    { label: 'message-peak', frameNumber: timing.contentFadeOutStart - 30 },
    { label: 'from-visible', frameNumber: timing.fromDelay + 20 },
    { label: 'cta-visible', frameNumber: timing.ctaStart + 10 },
  ];

  const captures: FrameCapture[] = [];

  for (const f of frames) {
    // Clamp to video duration (with 0.5s safety margin from the end)
    const rawTimestamp = f.frameNumber / timing.fps;
    const timestampSec = Math.min(rawTimestamp, videoDurationSec - 0.5);
    const outputPath = path.join(outputDir, `${f.label}.png`);

    try {
      await extractFrame(videoPath, timestampSec, outputPath);

      if (fs.existsSync(outputPath)) {
        captures.push({
          label: f.label,
          frameNumber: f.frameNumber,
          timestampSec,
          path: outputPath,
        });
      } else {
        console.warn(`[qa]   Frame ${f.label} not extracted (timestamp ${timestampSec.toFixed(1)}s may be out of range)`);
      }
    } catch (err) {
      console.warn(`[qa]   Failed to extract ${f.label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return captures;
}

// ─── Metadata Checks ─────────────────────────────────────────────────────────

/** Per-template expected duration ranges (seconds). */
function getDurationRange(template: string): { min: number; max: number } {
  // Static image templates have no duration (handled separately in runStaticImageQA)
  if (template.startsWith('QuoteCard') || template.startsWith('RawText')) return { min: 0, max: 1 };
  // DeletedText has typing + hold + delete + replace + send + CTA animations
  if (template.startsWith('DeletedText')) return { min: 6, max: 16 };
  // SplitScreen has word reveal + attribution + CTA with extended visibility
  if (template.startsWith('SplitScreen')) return { min: 4, max: 14 };
  // All other templates use adaptive duration (calculateDurationFrames: 5-8s)
  return { min: 4, max: 10 };
}

function runMetadataChecks(metadata: VideoMetadata, template: string): QACheck[] {
  const isVertical = template.includes('Vertical');
  const expectedWidth = 1080;
  // QuoteCard is 1350px tall, RawText is 1080x1080, others follow vertical/square
  let expectedHeight: number;
  if (template.startsWith('QuoteCard')) {
    expectedHeight = 1350;
  } else {
    expectedHeight = isVertical ? 1920 : 1080;
  }
  // CSS-only templates (no background video) produce smaller files
  const cssOnlyTemplates = ['DeletedText', 'SplitScreen'];
  const isCssOnly = cssOnlyTemplates.some((t) => template.startsWith(t));
  const minFileSize = isCssOnly ? 300_000 : 1_000_000;
  const minLabel = isCssOnly ? '0.3MB' : '1MB';
  const durationRange = getDurationRange(template);

  return [
    {
      name: 'resolution',
      passed: metadata.width === expectedWidth && metadata.height === expectedHeight,
      expected: `${expectedWidth}x${expectedHeight}`,
      actual: `${metadata.width}x${metadata.height}`,
    },
    {
      name: 'duration',
      passed: metadata.durationSec >= durationRange.min && metadata.durationSec <= durationRange.max,
      expected: `${durationRange.min}-${durationRange.max}s`,
      actual: `${metadata.durationSec.toFixed(1)}s`,
    },
    {
      name: 'codec',
      passed: metadata.codec === 'h264',
      expected: 'h264',
      actual: metadata.codec,
    },
    {
      name: 'fileSize',
      passed: metadata.fileSizeBytes >= minFileSize && metadata.fileSizeBytes <= 100_000_000,
      expected: `${minLabel}-100MB`,
      actual: `${(metadata.fileSizeBytes / 1_000_000).toFixed(1)}MB`,
    },
    {
      name: 'fps',
      passed: metadata.fps === 30,
      expected: '30',
      actual: String(metadata.fps),
    },
  ];
}

// ─── Contact Sheet ──────────────────────────────────────────────────────────

/**
 * Generate a contact sheet (6-frame grid PNG) from a video.
 * Extracts 6 evenly-spaced frames and tiles them into a 3x2 grid.
 * Useful for visual review of rendered videos.
 */
export async function generateContactSheet(
  videoPath: string,
  outputPath: string,
  columns = 3,
  rows = 2,
): Promise<string> {
  const totalFrames = columns * rows;
  const absoluteVideo = path.resolve(videoPath);
  const absoluteOutput = path.resolve(outputPath);

  // Ensure output directory exists
  const outputDir = path.dirname(absoluteOutput);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Get video duration to calculate evenly-spaced timestamps
  const metadata = await getVideoMetadata(absoluteVideo);
  const interval = metadata.durationSec / (totalFrames + 1);
  // Build select expression: pick one frame at each interval timestamp
  const selectParts: string[] = [];
  for (let i = 1; i <= totalFrames; i++) {
    const t = (interval * i).toFixed(3);
    selectParts.push(`gte(t\\,${t})*lt(t\\,${(interval * i + 0.04).toFixed(3)})`);
  }
  const selectExpr = selectParts.join('+');

  await execFileAsync('ffmpeg', [
    '-y',
    '-i', absoluteVideo,
    '-vf', `select='${selectExpr}',scale=360:-1,tile=${columns}x${rows}`,
    '-vsync', 'vfr',
    '-frames:v', '1',
    '-q:v', '3',
    absoluteOutput,
  ]);

  return absoluteOutput;
}

// ─── Main QA Functions ───────────────────────────────────────────────────────

/**
 * Run QA checks on a static image (QuoteCard, RawText).
 * Checks dimensions and file size — no video-specific checks.
 */
async function runStaticImageQA(
  imagePath: string,
  content: string,
  template: string,
): Promise<QAReport> {
  const absolutePath = path.resolve(imagePath);
  const basename = path.basename(absolutePath, '.png');
  const outputDir = path.join(QA_OUTPUT_DIR, basename);

  console.log(`[qa] Running static image QA on ${basename}...`);

  const stats = fs.statSync(absolutePath);
  const fileSizeBytes = stats.size;

  // Get image dimensions via ffprobe (works for PNG)
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_streams',
    absolutePath,
  ]);
  const info = JSON.parse(stdout);
  const stream = info.streams?.[0];
  const width = stream?.width ?? 0;
  const height = stream?.height ?? 0;

  console.log(`[qa]   Resolution: ${width}x${height}`);
  console.log(`[qa]   Size: ${(fileSizeBytes / 1_000_000).toFixed(2)}MB`);

  // Expected dimensions by template
  const expectedDims = template.startsWith('QuoteCard')
    ? { w: 1080, h: 1350 }
    : { w: 1080, h: 1080 }; // RawText

  const checks: QACheck[] = [
    {
      name: 'resolution',
      passed: width === expectedDims.w && height === expectedDims.h,
      expected: `${expectedDims.w}x${expectedDims.h}`,
      actual: `${width}x${height}`,
    },
    {
      name: 'fileSize',
      passed: fileSizeBytes >= 10_000 && fileSizeBytes <= 20_000_000,
      expected: '10KB-20MB',
      actual: `${(fileSizeBytes / 1_000_000).toFixed(2)}MB`,
    },
  ];

  // Content length check
  if (content) {
    const { MAX_CONTENT_LENGTH } = await import('@wlu/shared');
    const maxLen = MAX_CONTENT_LENGTH[template] ?? 160;
    checks.push({
      name: 'content-length',
      passed: content.length <= maxLen,
      expected: `<=${maxLen} chars`,
      actual: `${content.length} chars`,
    });
  }

  const passed = checks.every((c) => c.passed);

  for (const check of checks) {
    const icon = check.passed ? 'PASS' : 'FAIL';
    console.log(`[qa]   [${icon}] ${check.name}: ${check.actual} (expected: ${check.expected})`);
  }

  const metadata: VideoMetadata = {
    width,
    height,
    durationSec: 0,
    codec: 'png',
    fileSizeBytes,
    fps: 0,
  };

  const report: QAReport = {
    videoPath: absolutePath,
    timestamp: new Date().toISOString(),
    metadata,
    checks,
    frameScreenshots: [],
    passed,
  };

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(outputDir, 'report.json'),
    JSON.stringify(report, null, 2),
  );

  return report;
}

export async function runQA(
  videoPath: string,
  content: string,
  template: string = 'CinematicVertical',
): Promise<QAReport> {
  const absolutePath = path.resolve(videoPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  // Static image templates — use image QA instead of video QA
  if (absolutePath.endsWith('.png') || template.startsWith('QuoteCard') || template.startsWith('RawText')) {
    return runStaticImageQA(absolutePath, content, template);
  }

  // Determine output directory for this video's QA frames
  const videoBasename = path.basename(absolutePath, '.mp4');
  const outputDir = path.join(QA_OUTPUT_DIR, videoBasename);

  console.log(`[qa] Running QA on ${videoBasename}...`);

  // Get metadata
  const metadata = await getVideoMetadata(absolutePath);
  console.log(`[qa]   Resolution: ${metadata.width}x${metadata.height}`);
  console.log(`[qa]   Duration: ${metadata.durationSec.toFixed(1)}s`);
  console.log(`[qa]   Codec: ${metadata.codec}, FPS: ${metadata.fps}`);
  console.log(`[qa]   Size: ${(metadata.fileSizeBytes / 1_000_000).toFixed(1)}MB`);

  // Run metadata checks
  const checks = runMetadataChecks(metadata, template);

  // Content length check — catch messages too long for their template
  if (content) {
    const { MAX_CONTENT_LENGTH } = await import('@wlu/shared');
    const maxLen = MAX_CONTENT_LENGTH[template] ?? 160;
    checks.push({
      name: 'content-length',
      passed: content.length <= maxLen,
      expected: `<=${maxLen} chars`,
      actual: `${content.length} chars`,
    });
  }

  // Extract key frames (only if content is provided for timing computation)
  let frameScreenshots: FrameCapture[] = [];
  if (content) {
    const timing = computeTimingParams(content);
    console.log(`[qa]   Timing: fromDelay=${timing.fromDelay}, fadeOut=${timing.contentFadeOutStart}, cta=${timing.ctaStart}`);
    frameScreenshots = await extractKeyFrames(absolutePath, timing, outputDir, metadata.durationSec);
    console.log(`[qa]   Extracted ${frameScreenshots.length} key frames to ${outputDir}`);
  } else {
    console.log('[qa]   No content provided — skipping frame extraction');
  }

  const passed = checks.every((c) => c.passed);

  // Log results
  for (const check of checks) {
    const icon = check.passed ? 'PASS' : 'FAIL';
    console.log(`[qa]   [${icon}] ${check.name}: ${check.actual} (expected: ${check.expected})`);
  }

  const report: QAReport = {
    videoPath: absolutePath,
    timestamp: new Date().toISOString(),
    metadata,
    checks,
    frameScreenshots,
    passed,
  };

  // Save report JSON
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(outputDir, 'report.json'),
    JSON.stringify(report, null, 2),
  );

  return report;
}

export async function runQAForPendingItems(): Promise<{
  total: number;
  passed: number;
  failed: number;
}> {
  const { getContentQueue, updateContentQueueStatus, getMessageById } = await import('@wlu/shared');

  const pendingItems = await getContentQueue({ status: 'pending' });

  if (pendingItems.length === 0) {
    console.log('[qa] No pending items to QA');
    return { total: 0, passed: 0, failed: 0 };
  }

  console.log(`[qa] Found ${pendingItems.length} pending item(s) to QA\n`);

  // Cross-video uniqueness: track video file sizes to detect duplicate backgrounds
  // Videos with the same background produce similar file sizes (within 5% tolerance)
  const passedVideoSizes: Array<{ id: string; size: number }> = [];

  let passed = 0;
  let failed = 0;

  for (const item of pendingItems) {
    try {
      // Get the message content for timing computation
      let content = '';
      if (item.messageIds.length > 0) {
        const msg = await getMessageById(item.messageIds[0]);
        if (msg) content = msg.content;
      }

      const report = await runQA(item.videoPath, content, item.template);

      // Cross-video duplicate background check (only for templates with video backgrounds)
      const hasBgVideo = item.template?.startsWith('Cinematic') || item.template?.startsWith('TextOnGradient')
        || item.template?.startsWith('HandwritingSVG');
      if (report.passed && pendingItems.length > 1 && hasBgVideo) {
        const currentSize = report.metadata.fileSizeBytes;
        const duplicate = passedVideoSizes.find((prev) => {
          const ratio = currentSize / prev.size;
          return ratio > 0.95 && ratio < 1.05;
        });

        if (duplicate) {
          report.passed = false;
          report.checks.push({
            name: 'unique-background',
            passed: false,
            expected: 'unique background across batch',
            actual: `similar file size to ${duplicate.id.slice(0, 8)} (likely same background)`,
          });
          console.log(`[qa]   [FAIL] unique-background: too similar to ${duplicate.id.slice(0, 8)}`);
        } else {
          passedVideoSizes.push({ id: item.id, size: currentSize });
        }
      }

      if (report.passed) {
        await updateContentQueueStatus(item.id, 'qa_passed');
        console.log(`[qa] ${item.id.slice(0, 8)} → QA PASSED\n`);
        passed++;
      } else {
        const failedChecks = report.checks.filter((c) => !c.passed).map((c) => c.name);
        await updateContentQueueStatus(item.id, 'failed', {
          errorMessage: `QA failed: ${failedChecks.join(', ')}`,
        });
        console.log(`[qa] ${item.id.slice(0, 8)} → QA FAILED (${failedChecks.join(', ')})\n`);
        failed++;
      }
    } catch (err) {
      console.error(`[qa] Error processing ${item.id.slice(0, 8)}:`, err);
      await updateContentQueueStatus(item.id, 'failed', {
        errorMessage: `QA error: ${err instanceof Error ? err.message : String(err)}`,
      });
      failed++;
    }
  }

  return { total: pendingItems.length, passed, failed };
}
