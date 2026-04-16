import { resolve } from 'node:path';
import { jitteredInterval, INTERVALS } from './timing.js';
import { scheduleCaptionedItems, getQueueStatus, catchUpMissedSlots } from './queue.js';
import { captionPendingItems } from '../captions/generate.js';
import { publishNextScheduled } from './publish-job.js';
import { runCommentResponder } from '../engagement/comment-responder.js';
import { collectFollowerSnapshot } from '../collectors/followers.js';
import { seedDailyMessages } from '../content/message-seeder.js';
import { saveLastRun, getSecondsSinceLastRun, installTimestampLogger } from './state.js';
import { withBrowserLock, cleanStaleSingletons } from '../platforms/browser-lock.js';
import { getContentQueue, withRetry, pathWithHomebrew } from '@wlu/shared';

/** All supported platforms for publishing. Threads disabled — requires selfie verification. */
const ALL_PLATFORMS = [
  'instagram', 'tiktok', 'youtube',
  'reddit', 'pinterest', 'twitter',
] as const;

/** Map platform → browser session directory for lock coordination. */
const SESSION_DIRS: Record<string, string> = {
  instagram: resolve(process.env.HOME ?? '.', '.wlu-instagram-session'),
  tiktok: resolve(process.env.HOME ?? '.', '.wlu-tiktok-session'),
  youtube: resolve(process.env.HOME ?? '.', '.wlu-youtube-session'),
  reddit: resolve(process.env.HOME ?? '.', '.wlu-reddit-session'),
  pinterest: resolve(process.env.HOME ?? '.', '.wlu-pinterest-session'),
  twitter: resolve(process.env.HOME ?? '.', '.wlu-twitter-session'),
};

/** Platforms with outbound engagement modules. */
const OUTBOUND_PLATFORMS = ['instagram', 'tiktok', 'youtube', 'reddit', 'twitter'] as const;

type Platform = (typeof ALL_PLATFORMS)[number];

interface SchedulerOptions {
  dryRun?: boolean;
  platform?: Platform;
}

/**
 * Print a compact overview of upcoming scheduled posts.
 */
async function printUpcomingSchedule(): Promise<void> {
  const items = await getContentQueue({ status: 'scheduled', limit: 50 });
  if (items.length === 0) {
    console.log('[schedule] No upcoming posts scheduled');
    return;
  }

  // Sort by scheduled time ascending
  const sorted = items
    .filter((i) => i.scheduledFor)
    .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime());

  console.log(`[schedule] Upcoming posts (${sorted.length}):`);
  for (const item of sorted) {
    const time = new Date(item.scheduledFor!);
    const timeStr = time.toLocaleTimeString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const dateStr = time.toLocaleDateString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short',
      day: 'numeric',
    });
    const platform = (item.platform ?? 'unknown').padEnd(10);
    const caption = (item.caption ?? '').slice(0, 40).replace(/\n/g, ' ');
    console.log(`  ${dateStr} ${timeStr.padStart(8)}  ${platform}  ${caption}${(item.caption?.length ?? 0) > 40 ? '...' : ''}`);
  }
}

/**
 * Publish across all platforms (or a single one if specified).
 * Iterates through each platform and publishes the next due item.
 */
async function publishAllPlatforms(options: { dryRun?: boolean; platform?: Platform }): Promise<void> {
  const platforms = options.platform ? [options.platform] : [...ALL_PLATFORMS];
  let published = false;
  for (const p of platforms) {
    const sessionDir = SESSION_DIRS[p];
    try {
      let result: boolean;
      if (sessionDir) {
        result = await withBrowserLock(sessionDir, () =>
          publishNextScheduled({ platform: p, dryRun: options.dryRun }),
        );
      } else {
        result = await publishNextScheduled({ platform: p, dryRun: options.dryRun });
      }
      if (result) published = true;
    } catch (err) {
      console.error(`[scheduler] publish ${p} failed:`, err instanceof Error ? err.message : err);
    }
  }
  // After a publish, show updated schedule
  if (published) {
    await printUpcomingSchedule();
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
  const sessionDir = SESSION_DIRS[platform];
  console.log(`[scheduler] Outbound engagement on ${platform}...`);

  const doOutbound = async (): Promise<void> => {
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
    }
  };

  try {
    if (sessionDir) {
      await withBrowserLock(sessionDir, doOutbound);
    } else {
      await doOutbound();
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

  installTimestampLogger();

  // Clean up stale ProcessSingleton files left by crashed/orphaned browser
  // sessions. These prevent Playwright from launching new persistent contexts.
  // Cleans SingletonLock + SingletonCookie + SingletonSocket together.
  await cleanStaleSingletons(Object.values(SESSION_DIRS));

  console.log('[scheduler] Starting social media engine...');
  console.log(`[scheduler] Platforms: ${platform ?? 'ALL (' + ALL_PLATFORMS.join(', ') + ')'}`);
  if (dryRun) console.log('[scheduler] DRY RUN mode — no posts will be published');

  // Print initial queue status and upcoming schedule
  const status = await getQueueStatus(platform ?? 'instagram');
  console.log('[scheduler] Queue status:', JSON.stringify(status));
  await printUpcomingSchedule();

  // Define all scheduled jobs
  // NOTE: ingest job removed — render-next creates queue items directly with
  // proper messageIds. The old ingest job scanned the output directory and
  // created items with empty messageIds, breaking cross-post dedup.
  const jobs = [
    {
      name: 'caption',
      baseInterval: INTERVALS.CAPTION,
      fn: async () => {
        if (platform) return captionPendingItems({ platform, dryRun });
        // Process all platforms so YouTube/TikTok items don't get stuck
        let total = 0;
        for (const p of ALL_PLATFORMS) {
          total += await captionPendingItems({ platform: p, dryRun });
        }
        return total;
      },
    },
    {
      name: 'schedule',
      baseInterval: INTERVALS.SCHEDULE,
      fn: async () => {
        if (platform) return scheduleCaptionedItems({ platform, dryRun });
        // Process all platforms so YouTube/TikTok items don't get stuck
        let total = 0;
        for (const p of ALL_PLATFORMS) {
          total += await scheduleCaptionedItems({ platform: p, dryRun });
        }
        return total;
      },
    },
    {
      name: 'publish',
      baseInterval: INTERVALS.PUBLISH,
      fn: () => publishAllPlatforms({ platform, dryRun }),
    },
    {
      name: 'comment-reply',
      baseInterval: INTERVALS.COMMENT_REPLY,
      fn: () => withBrowserLock(SESSION_DIRS.instagram, () => runCommentResponder({ dryRun })),
    },
    {
      name: 'follower-snapshot',
      baseInterval: INTERVALS.METRICS,
      fn: async () => {
        // Follower snapshots open browsers for each platform sequentially.
        // Lock each one to avoid conflicts with other jobs.
        for (const p of ALL_PLATFORMS) {
          const dir = SESSION_DIRS[p];
          if (dir) {
            await withBrowserLock(dir, async () => {
              try {
                await collectFollowerSnapshot(p);
              } catch (err) {
                console.error(`[scheduler] follower ${p} failed:`, err instanceof Error ? err.message : err);
              }
            });
          }
        }
      },
    },
    {
      name: 'outbound-engagement',
      baseInterval: INTERVALS.OUTBOUND,
      fn: () => runOutboundEngagement({ dryRun }),
    },
    {
      name: 'render-content',
      baseInterval: INTERVALS.RENDER,
      fn: async () => {
        const { renderNextContent } = await import('../content/auto-render.js');
        await renderNextContent({ dryRun, platform });
      },
    },
    {
      name: 'learn',
      baseInterval: INTERVALS.LEARN,
      fn: async () => {
        await seedDailyMessages({ dryRun });
        if (!dryRun) {
          // Compute data-driven template weights from engagement metrics
          try {
            const { execFile } = await import('node:child_process');
            const { promisify } = await import('node:util');
            const exec = promisify(execFile);
            const result = await exec('npx', ['tsx', 'packages/analytics/src/index.ts', 'learn-weights'], {
              cwd: process.cwd(),
              env: { ...process.env, PATH: pathWithHomebrew() },
              timeout: 2 * 60 * 1000,
            });
            if (result.stdout) console.log(result.stdout.trim());
            console.log('[scheduler] Template weights updated from engagement data');
          } catch (err) {
            console.warn('[scheduler] Weight learning failed:', err instanceof Error ? err.message : err);
          }

          // Strategy brief is optional — requires ANTHROPIC_API_KEY
          try {
            const { execFile } = await import('node:child_process');
            const { promisify } = await import('node:util');
            const exec = promisify(execFile);
            await exec('npx', ['tsx', 'packages/analytics/src/index.ts', 'strategy'], {
              cwd: process.cwd(),
              env: { ...process.env, PATH: pathWithHomebrew() },
              timeout: 5 * 60 * 1000,
            });
            console.log('[scheduler] Strategy brief generated');
          } catch (err) {
            console.warn('[scheduler] Strategy brief skipped:', err instanceof Error ? err.message : err);
          }
        }
      },
    },
    {
      name: 'collect-metrics',
      baseInterval: INTERVALS.METRICS,
      fn: async () => {
        const { collectEngagementMetrics } = await import('../collectors/engagement.js');
        const result = await collectEngagementMetrics();
        if (result.captchaOn) {
          console.warn(`[scheduler] Metrics collection hit CAPTCHA on ${result.captchaOn} — solve manually`);
        }
      },
    },
    {
      name: 'verify-posts',
      baseInterval: INTERVALS.VERIFY,
      fn: async () => {
        const { verifyRecentPosts } = await import('../verification/verify-post.js');
        await verifyRecentPosts();
      },
    },
    {
      name: 'daily-summary',
      baseInterval: INTERVALS.DAILY_SUMMARY,
      fn: async () => {
        try {
          const { execFile } = await import('node:child_process');
          const { promisify } = await import('node:util');
          const exec = promisify(execFile);
          const result = await exec('npx', ['tsx', 'packages/analytics/src/index.ts', 'daily-summary'], {
            cwd: process.cwd(),
            env: { ...process.env, PATH: pathWithHomebrew() },
            timeout: 2 * 60 * 1000,
          });
          if (result.stdout) console.log(result.stdout);
        } catch (err) {
          console.warn('[scheduler] Daily summary failed:', err instanceof Error ? err.message : err);
        }
      },
    },
    {
      name: 'unfollow',
      baseInterval: INTERVALS.UNFOLLOW,
      fn: async () => {
        // Unfollow non-followers across Instagram, TikTok, and YouTube
        const platforms = [
          {
            name: 'instagram' as const,
            sessionDir: SESSION_DIRS.instagram,
            run: async () => {
              const { runUnfollowSession } = await import('../engagement/unfollow.js');
              await runUnfollowSession({ dryRun });
            },
          },
          {
            name: 'tiktok' as const,
            sessionDir: SESSION_DIRS.tiktok,
            run: async () => {
              const { runTikTokUnfollowSession } = await import('../engagement/unfollow-tiktok.js');
              await runTikTokUnfollowSession({ dryRun });
            },
          },
          {
            name: 'youtube' as const,
            sessionDir: SESSION_DIRS.youtube,
            run: async () => {
              const { runYouTubeUnsubscribeSession } = await import('../engagement/unfollow-youtube.js');
              await runYouTubeUnsubscribeSession({ dryRun });
            },
          },
        ];

        for (const p of platforms) {
          try {
            await withBrowserLock(p.sessionDir, p.run);
          } catch (err) {
            console.error(`[scheduler] unfollow ${p.name} failed:`, err instanceof Error ? err.message : err);
          }
        }
      },
    },
  ];

  // Run each job on its own jittered interval loop
  const controllers: AbortController[] = [];

  for (const job of jobs) {
    const controller = new AbortController();
    controllers.push(controller);
    runJobLoop(job.name, job.fn, job.baseInterval, controller.signal);
  }

  // Catch up any missed/overdue scheduled items before running jobs
  console.log('[scheduler] Checking for overdue scheduled items...');
  const catchUpPlatforms = platform ? [platform] : [...ALL_PLATFORMS];
  for (const p of catchUpPlatforms) {
    try {
      await catchUpMissedSlots(p as Platform);
    } catch (err) {
      console.error(`[scheduler] catch-up ${p} failed:`, err instanceof Error ? err.message : err);
    }
  }

  // Run initial pass — skip jobs that ran recently (survives restarts)
  console.log('[scheduler] Running initial pass...');
  for (const job of jobs) {
    const elapsed = getSecondsSinceLastRun(job.name);
    if (elapsed !== null && elapsed * 1000 < job.baseInterval) {
      const minAgo = Math.round(elapsed / 60);
      console.log(`[scheduler] Skipping ${job.name} — ran ${minAgo} min ago`);
      continue;
    }
    try {
      await withRetry<unknown>(() => job.fn(), { maxRetries: 2, baseDelayMs: 3000, label: job.name });
      saveLastRun(job.name);
    } catch (err) {
      console.error(`[scheduler] Initial ${job.name} failed:`, err instanceof Error ? err.message : err);
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

/** High-frequency jobs that only log when they actually do something. */
const QUIET_JOBS = new Set(['publish', 'verify-posts', 'caption', 'ingest', 'schedule']);

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
    if (!QUIET_JOBS.has(name)) {
      const minutes = Math.round(interval / 60000);
      console.log(`[scheduler] Next ${name} in ~${minutes} min`);
    }

    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, interval);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });

    if (signal.aborted) break;

    try {
      await withRetry(() => fn(), { maxRetries: 2, baseDelayMs: 3000, label: name });
      saveLastRun(name);
    } catch (err) {
      console.error(`[scheduler] ${name} error:`, err instanceof Error ? err.message : err);
    }
  }
}
