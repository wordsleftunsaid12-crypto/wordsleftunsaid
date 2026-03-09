import { jitteredInterval, INTERVALS } from './timing.js';
import { scheduleCaptionedItems, getQueueStatus } from './queue.js';
import { captionPendingItems } from '../captions/generate.js';
import { ingestNewVideos } from '../ingest.js';
import { publishNextScheduled } from './publish-job.js';
import { runCommentResponder } from '../engagement/comment-responder.js';
import { collectAllFollowerSnapshots } from '../collectors/followers.js';
import { seedDailyMessages } from '../content/message-seeder.js';

/** All supported platforms for publishing. */
const ALL_PLATFORMS = [
  'instagram', 'tiktok', 'youtube',
  'reddit', 'pinterest', 'twitter', 'threads',
] as const;

/** Platforms with outbound engagement modules. */
const OUTBOUND_PLATFORMS = ['instagram', 'tiktok', 'youtube', 'reddit', 'twitter', 'threads'] as const;

type Platform = (typeof ALL_PLATFORMS)[number];

interface SchedulerOptions {
  dryRun?: boolean;
  platform?: Platform;
}

/**
 * Publish across all platforms (or a single one if specified).
 * Iterates through each platform and publishes the next due item.
 */
async function publishAllPlatforms(options: { dryRun?: boolean; platform?: Platform }): Promise<void> {
  const platforms = options.platform ? [options.platform] : [...ALL_PLATFORMS];
  for (const p of platforms) {
    try {
      await publishNextScheduled({ platform: p, dryRun: options.dryRun });
    } catch (err) {
      console.error(`[scheduler] publish ${p} failed:`, err instanceof Error ? err.message : err);
    }
  }
}

/**
 * Run outbound engagement across all platforms (one random platform per cycle).
 * Picks a random platform each time to spread engagement naturally.
 */
async function runOutboundEngagement(options: { dryRun?: boolean }): Promise<void> {
  const { dryRun = false } = options;
  // Pick a random platform each cycle to avoid running all browsers at once
  const platform = OUTBOUND_PLATFORMS[Math.floor(Math.random() * OUTBOUND_PLATFORMS.length)];
  console.log(`[scheduler] Outbound engagement on ${platform}...`);

  try {
    switch (platform) {
      case 'instagram': {
        const { runOutboundSession } = await import('../engagement/outbound.js');
        await runOutboundSession({ dryRun });
        break;
      }
      case 'tiktok': {
        const { runTikTokOutboundSession } = await import('../engagement/outbound-tiktok.js');
        await runTikTokOutboundSession({ dryRun });
        break;
      }
      case 'youtube': {
        const { runYouTubeOutboundSession } = await import('../engagement/outbound-youtube.js');
        await runYouTubeOutboundSession({ dryRun });
        break;
      }
      case 'reddit': {
        const { runRedditOutboundSession } = await import('../engagement/outbound-reddit.js');
        await runRedditOutboundSession({ dryRun });
        break;
      }
      case 'twitter': {
        const { runTwitterOutboundSession } = await import('../engagement/outbound-twitter.js');
        await runTwitterOutboundSession({ dryRun });
        break;
      }
      case 'threads': {
        const { runThreadsOutboundSession } = await import('../engagement/outbound-threads.js');
        await runThreadsOutboundSession({ dryRun });
        break;
      }
    }
  } catch (err) {
    console.error(`[scheduler] outbound ${platform} failed:`, err instanceof Error ? err.message : err);
  }
}

/**
 * Start the main scheduler loop. Runs all pipeline jobs on jittered intervals.
 * This is the long-running process started by `npm run schedule`.
 */
export async function startScheduler(options: SchedulerOptions = {}): Promise<void> {
  const { dryRun = false, platform } = options;

  console.log('[scheduler] Starting social media engine...');
  console.log(`[scheduler] Platforms: ${platform ?? 'ALL (' + ALL_PLATFORMS.join(', ') + ')'}`);
  if (dryRun) console.log('[scheduler] DRY RUN mode — no posts will be published');

  // Print initial queue status (for primary platform or instagram)
  const status = await getQueueStatus(platform ?? 'instagram');
  console.log('[scheduler] Queue status:', JSON.stringify(status));

  // Define all scheduled jobs
  const jobs = [
    {
      name: 'ingest',
      baseInterval: INTERVALS.INGEST,
      fn: () => ingestNewVideos({ platform: platform ?? 'instagram', dryRun }),
    },
    {
      name: 'caption',
      baseInterval: INTERVALS.CAPTION,
      fn: () => captionPendingItems({ platform: platform ?? 'instagram', dryRun }),
    },
    {
      name: 'schedule',
      baseInterval: INTERVALS.SCHEDULE,
      fn: () => scheduleCaptionedItems({ platform: platform ?? 'instagram', dryRun }),
    },
    {
      name: 'publish',
      baseInterval: INTERVALS.PUBLISH,
      fn: () => publishAllPlatforms({ platform, dryRun }),
    },
    {
      name: 'comment-reply',
      baseInterval: INTERVALS.COMMENT_REPLY,
      fn: () => runCommentResponder({ dryRun }),
    },
    {
      name: 'follower-snapshot',
      baseInterval: INTERVALS.METRICS,
      fn: () => collectAllFollowerSnapshots(),
    },
    {
      name: 'outbound-engagement',
      baseInterval: INTERVALS.OUTBOUND,
      fn: () => runOutboundEngagement({ dryRun }),
    },
    {
      name: 'seed-messages',
      baseInterval: INTERVALS.LEARN,
      fn: () => seedDailyMessages({ dryRun }),
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
