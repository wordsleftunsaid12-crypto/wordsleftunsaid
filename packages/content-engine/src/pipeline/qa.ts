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

  const info = JSON.parse(stdout) as {
    streams: Array<{
      codec_type: string;
      codec_name: string;
      width: number;
      height: number;
      r_frame_rate: string;
    }>;
    format: { duration: string; size: string };
  };

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

function runMetadataChecks(metadata: VideoMetadata, template: string): QACheck[] {
  const isVertical = template.includes('Vertical');
  const expectedWidth = 1080;
  const expectedHeight = isVertical ? 1920 : 1080;

  return [
    {
      name: 'resolution',
      passed: metadata.width === expectedWidth && metadata.height === expectedHeight,
      expected: `${expectedWidth}x${expectedHeight}`,
      actual: `${metadata.width}x${metadata.height}`,
    },
    {
      name: 'duration',
      passed: metadata.durationSec >= 7.0 && metadata.durationSec <= 9.0,
      expected: '7.0-9.0s',
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
      passed: metadata.fileSizeBytes >= 1_000_000 && metadata.fileSizeBytes <= 100_000_000,
      expected: '1MB-100MB',
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

// ─── Main QA Functions ───────────────────────────────────────────────────────

export async function runQA(
  videoPath: string,
  content: string,
  template: string = 'CinematicVertical',
): Promise<QAReport> {
  const absolutePath = path.resolve(videoPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Video file not found: ${absolutePath}`);
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

      // Cross-video duplicate background check
      if (report.passed && pendingItems.length > 1) {
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
