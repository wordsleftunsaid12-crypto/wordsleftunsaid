import { readdir, stat } from 'node:fs/promises';
import { join, basename, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createContentQueueItem,
  getContentQueueItemByVideoPath,
  getLatestStrategyBrief,
} from '@wlu/shared';
import type { Platform, StrategyBrief } from '@wlu/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_ENGINE_OUTPUT = resolve(__dirname, '../../content-engine/output');

/**
 * Filename pattern from content-engine: {Template}-{timestamp}.mp4
 * Example: ClassicVertical-1708765432000.mp4
 */
const VIDEO_FILENAME_PATTERN = /^(\w+)-(\d+)\.mp4$/;

interface IngestResult {
  total: number;
  newItems: number;
  skipped: number;
}

/**
 * Scan the content-engine output directory for new videos
 * and add them to the content queue as 'pending'.
 */
export async function ingestNewVideos(
  options: {
    outputDir?: string;
    platform?: Platform;
    dryRun?: boolean;
  } = {},
): Promise<IngestResult> {
  const {
    outputDir = CONTENT_ENGINE_OUTPUT,
    platform = 'instagram',
    dryRun = false,
  } = options;

  let files: string[];
  try {
    files = await readdir(outputDir);
  } catch {
    console.log(`[ingest] Output directory not found: ${outputDir}`);
    return { total: 0, newItems: 0, skipped: 0 };
  }

  const mp4Files = files.filter((f) => f.endsWith('.mp4'));
  let newItems = 0;
  let skipped = 0;

  // Determine if this item should be exploration (A/B testing)
  const explorationRate = await getExplorationRate();

  for (const file of mp4Files) {
    const filePath = join(outputDir, file);

    // Check if already in queue
    const existing = await getContentQueueItemByVideoPath(filePath);
    if (existing) {
      skipped++;
      continue;
    }

    // Parse template and timestamp from filename
    const match = file.match(VIDEO_FILENAME_PATTERN);
    const template = match ? match[1] : 'Unknown';

    // Check file exists and is a real file
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      skipped++;
      continue;
    }

    // A/B testing: 20% of posts are exploration
    const isExploration = Math.random() < explorationRate;

    if (dryRun) {
      console.log(
        `[ingest] [DRY RUN] Would queue: ${file} (template: ${template}, exploration: ${isExploration})`,
      );
    } else {
      await createContentQueueItem({
        videoPath: filePath,
        messageIds: [], // Will be populated later if we can parse from metadata
        template,
        platform,
        isExploration,
      });
      console.log(`[ingest] Queued: ${file}`);
    }

    newItems++;
  }

  console.log(
    `[ingest] Scanned ${mp4Files.length} files: ${newItems} new, ${skipped} skipped`,
  );
  return { total: mp4Files.length, newItems, skipped };
}

/**
 * Get the exploration rate from strategy brief, defaulting to 20%.
 */
async function getExplorationRate(): Promise<number> {
  try {
    const briefRecord = await getLatestStrategyBrief();
    if (briefRecord) {
      const brief = briefRecord.brief as unknown as StrategyBrief;
      // If we have a strong strategy, explore less. Otherwise explore more.
      if (brief.preferredMoods && brief.preferredMoods.length > 0) {
        return 0.2; // Standard 80/20 split
      }
    }
  } catch {
    // Ignore errors
  }
  return 0.3; // Higher exploration when no strategy exists yet
}
