import { jitteredInterval, INTERVALS } from './timing.js';
import { scheduleCaptionedItems, getQueueStatus } from './queue.js';
import { captionPendingItems } from '../captions/generate.js';
import { ingestNewVideos } from '../ingest.js';
import { publishNextScheduled } from './publish-job.js';
import { runCommentResponder } from '../engagement/comment-responder.js';

interface SchedulerOptions {
  dryRun?: boolean;
  platform?: 'instagram' | 'tiktok';
}

/**
 * Start the main scheduler loop. Runs all pipeline jobs on jittered intervals.
 * This is the long-running process started by `npm run schedule`.
 */
export async function startScheduler(options: SchedulerOptions = {}): Promise<void> {
  const { dryRun = false, platform = 'instagram' } = options;

  console.log('[scheduler] Starting social media engine...');
  if (dryRun) console.log('[scheduler] DRY RUN mode — no posts will be published');

  // Print initial queue status
  const status = await getQueueStatus(platform);
  console.log('[scheduler] Queue status:', JSON.stringify(status));

  // Define all scheduled jobs
  const jobs = [
    {
      name: 'ingest',
      baseInterval: INTERVALS.INGEST,
      fn: () => ingestNewVideos({ platform, dryRun }),
    },
    {
      name: 'caption',
      baseInterval: INTERVALS.CAPTION,
      fn: () => captionPendingItems({ platform, dryRun }),
    },
    {
      name: 'schedule',
      baseInterval: INTERVALS.SCHEDULE,
      fn: () => scheduleCaptionedItems({ platform, dryRun }),
    },
    {
      name: 'publish',
      baseInterval: INTERVALS.PUBLISH,
      fn: () => publishNextScheduled({ platform, dryRun }),
    },
    {
      name: 'comment-reply',
      baseInterval: INTERVALS.COMMENT_REPLY,
      fn: () => runCommentResponder({ dryRun }),
    },
  ];

  // Run each job on its own jittered interval loop
  const controllers: AbortController[] = [];

  for (const job of jobs) {
    const controller = new AbortController();
    controllers.push(controller);
    runJobLoop(job.name, job.fn, job.baseInterval, controller.signal);
  }

  // Run initial pass immediately for all jobs
  console.log('[scheduler] Running initial pass...');
  for (const job of jobs) {
    try {
      await job.fn();
    } catch (err) {
      console.error(`[scheduler] Initial ${job.name} failed:`, err);
    }
  }

  console.log('[scheduler] All jobs running. Press Ctrl+C to stop.');

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[scheduler] Shutting down...');
    for (const c of controllers) c.abort();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[scheduler] Shutting down...');
    for (const c of controllers) c.abort();
    process.exit(0);
  });

  // Keep the process alive
  await new Promise(() => {});
}

/**
 * Run a single job in a loop with jittered intervals.
 */
async function runJobLoop(
  name: string,
  fn: () => Promise<unknown>,
  baseInterval: number,
  signal: AbortSignal,
): Promise<void> {
  while (!signal.aborted) {
    const interval = jitteredInterval(baseInterval);
    const minutes = Math.round(interval / 60000);
    console.log(`[scheduler] Next ${name} in ~${minutes} min`);

    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, interval);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });

    if (signal.aborted) break;

    try {
      await fn();
    } catch (err) {
      console.error(`[scheduler] ${name} error:`, err);
    }
  }
}
