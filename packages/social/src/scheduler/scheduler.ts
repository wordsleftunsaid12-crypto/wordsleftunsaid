import { resolve } from 'node:path';
import { unlinkSync, readlinkSync } from 'node:fs';
import { jitteredInterval, INTERVALS } from './timing.js';
import { scheduleCaptionedItems, getQueueStatus, catchUpMissedSlots } from './queue.js';
import { captionPendingItems } from '../captions/generate.js';
import { ingestNewVideos } from '../ingest.js';
import { publishNextScheduled } from './publish-job.js';
import { runCommentResponder } from '../engagement/comment-responder.js';
import { collectFollowerSnapshot } from '../collectors/followers.js';
import { seedDailyMessages } from '../content/message-seeder.js';
import { saveLastRun, getSecondsSinceLastRun, installTimestampLogger } from './state.js';
import { withBrowserLock } from '../platforms/browser-lock.js';
import { getContentQueue, withRetry } from '@wlu/shared';

/** All supported platforms for publishing. */
const ALL_PLATFORMS = [
  'instagram', 'tiktok', 'youtube',
  'reddit', 'pinterest', 'twitter', 'threads',
] as const;

/** Map platform → browser session directory for lock coordination. */
const SESSION_DIRS: Record<string, string> = {
  instagram: resolve(process.env.HOME ?? '.', '.wlu-instagram-session'),
  tiktok: resolve(process.env.HOME ?? '.', '.wlu-tiktok-session'),
  youtube: resolve(process.env.HOME ?? '.', '.wlu-youtube-session'),
  reddit: resolve(process.env.HOME ?? '.', '.wlu-reddit-session'),
  pinterest: resolve(process.env.HOME ?? '.', '.wlu-pinterest-session'),
  twitter: resolve(process.env.HOME ?? '.', '.wlu-twitter-session'),
  threads: resolve(process.env.HOME ?? '.', '.wlu-threads-session'),
};

/** Platforms with outbound engagement modules. */
const OUTBOUND_PLATFORMS = ['instagram', 'tiktok', 'youtube', 'reddit', 'twitter', 'threads'] as const;

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
      case 'threads': {
        const { runThreadsOutboundSession } = await import('../engagement/outbound-threads.js');
        await runThreadsOutboundSession({ dryRun });
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
 * Remove stale SingletonLock symlinks from browser session directories.
 * Chromium creates these locks to prevent concurrent profile access. If a
 * browser process crashes or is killed, the lock file is left behind and
 * blocks all future launches until removed.
 */
function cleanStaleLocks(): void {
  for (const [platform, dir] of Object.entries(SESSION_DIRS)) {
    const lockPath = resolve(dir, 'SingletonLock');
    try {
      const target = readlinkSync(lockPath);
      // The lock is a symlink to "<hostname>-<pid>". Check if the PID is alive.
      const pidMatch = target.match(/-(\d+)$/);
      if (pidMatch) {
        const pid = parseInt(pidMatch[1], 10);
        try {
          process.kill(pid, 0); // Signal 0 = check if alive
          // Process is still alive — leave the lock
          continue;
        } catch {
          // Process is dead — safe to remove
        }
      }
      unlinkSync(lockPath);
      console.log(`[scheduler] Removed stale lock: ${platform} (was ${target})`);
    } catch {
      // No lock file or not a symlink — nothing to clean
    }
  }
}

/**
 * Start the main scheduler loop. Runs all pipeline jobs on jittered intervals.
 * This is the long-running process started by `npm run schedule`.
 */
export async function startScheduler(options: SchedulerOptions = {}): Promise<void> {
  const { dryRun = false, platform } = options;

  installTimestampLogger();

  // Clean up stale SingletonLock files left by crashed browser sessions.
  // These prevent Playwright from launching new persistent contexts.
  cleanStaleLocks();

  console.log('[scheduler] Starting social media engine...');
  console.log(`[scheduler] Platforms: ${platform ?? 'ALL (' + ALL_PLATFORMS.join(', ') + ')'}`);
  if (dryRun) console.log('[scheduler] DRY RUN mode — no posts will be published');

  // Print initial queue status and upcoming schedule
  const status = await getQueueStatus(platform ?? 'instagram');
  console.log('[scheduler] Queue status:', JSON.stringify(status));
  await printUpcomingSchedule();

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
        await renderNextContent({ dryRun });
      },
    },
    {
      name: 'learn',
      baseInterval: INTERVALS.LEARN,
      fn: async () => {
        await seedDailyMessages({ dryRun });
        if (!dryRun) {
          try {
            const { execFile } = await import('node:child_process');
            const { promisify } = await import('node:util');
            const exec = promisify(execFile);
            await exec('npx', ['tsx', 'packages/analytics/src/index.ts', 'strategy'], {
              cwd: process.cwd(),
              env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
              timeout: 5 * 60 * 1000,
            });
            console.log('[scheduler] Strategy brief generated');
          } catch (err) {
            // Strategy brief is optional — requires ANTHROPIC_API_KEY
            console.warn('[scheduler] Strategy brief skipped:', err instanceof Error ? err.message : err);
          }
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
            env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
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
