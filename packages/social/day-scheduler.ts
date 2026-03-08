/**
 * Full-day social media scheduler.
 * Spreads posting and engagement across optimal time windows.
 *
 * Schedule (local time):
 *   8:00 AM  — Morning: Post to TikTok (2 queued) + IG engagement
 *  10:30 AM  — Mid-morning: TikTok engagement
 *   1:00 PM  — Lunch: Post remaining TikTok cross-post + IG engagement
 *   4:00 PM  — Afternoon: TikTok engagement
 *   7:00 PM  — Evening: IG + TikTok engagement (peak hours)
 */
import 'dotenv/config';
import {
  getOutboundEngagementCountToday,
  getPostCountToday,
  getNextScheduledItem,
} from '@wlu/shared';

function log(msg: string): void {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
  console.log(`[${ts}] ${msg}`);
}

async function sleepUntil(targetHour: number, targetMinute: number = 0): Promise<void> {
  const now = new Date();
  const target = new Date(now);
  target.setHours(targetHour, targetMinute, 0, 0);

  if (target <= now) {
    log(`Target ${targetHour}:${String(targetMinute).padStart(2, '0')} already passed, continuing...`);
    return;
  }

  const ms = target.getTime() - now.getTime();
  const minutes = Math.round(ms / 60000);
  log(`Sleeping ${minutes} minutes until ${targetHour}:${String(targetMinute).padStart(2, '0')}...`);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function postToTikTok(maxPosts: number = 1): Promise<number> {
  const todayCount = await getPostCountToday('tiktok');
  const canPost = Math.min(maxPosts, 3 - todayCount);

  if (canPost <= 0) {
    log('TikTok daily post limit reached');
    return 0;
  }

  let posted = 0;
  for (let i = 0; i < canPost; i++) {
    const item = await getNextScheduledItem('tiktok');
    if (!item) {
      log('No more TikTok items in queue');
      break;
    }

    log(`Posting to TikTok: "${(item.caption ?? '').slice(0, 50)}..."`);
    try {
      const { publishNextScheduled } = await import('./src/scheduler/publish-job.js');
      const success = await publishNextScheduled({ platform: 'tiktok' });
      if (success) {
        posted++;
        log(`TikTok post ${posted} complete`);
      }
    } catch (err) {
      log(`TikTok post failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (i < canPost - 1) {
      log('Waiting 45s between posts...');
      await new Promise((r) => setTimeout(r, 45000));
    }
  }

  return posted;
}

async function postToInstagram(maxPosts: number = 1): Promise<number> {
  const todayCount = await getPostCountToday('instagram');
  const canPost = Math.min(maxPosts, 3 - todayCount);

  if (canPost <= 0) {
    log('Instagram daily post limit reached');
    return 0;
  }

  let posted = 0;
  for (let i = 0; i < canPost; i++) {
    const item = await getNextScheduledItem('instagram');
    if (!item) {
      log('No more Instagram items in queue');
      break;
    }

    log(`Posting to Instagram: "${(item.caption ?? '').slice(0, 50)}..."`);
    try {
      const { publishNextScheduled } = await import('./src/scheduler/publish-job.js');
      const success = await publishNextScheduled({ platform: 'instagram' });
      if (success) {
        posted++;
        log(`Instagram post ${posted} complete`);
      }
    } catch (err) {
      log(`Instagram post failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (i < canPost - 1) {
      log('Waiting 45s between posts...');
      await new Promise((r) => setTimeout(r, 45000));
    }
  }

  return posted;
}

async function runEngagement(platform: 'instagram' | 'tiktok'): Promise<void> {
  log(`Running ${platform} outbound engagement...`);

  // Remove stale browser locks
  const fs = await import('fs');
  const sessionDir = platform === 'tiktok' ? `${process.env.HOME}/.wlu-tiktok-session` : `${process.env.HOME}/.wlu-instagram-session`;
  const lockFile = `${sessionDir}/SingletonLock`;
  try { fs.unlinkSync(lockFile); } catch { /* no lock */ }

  try {
    if (platform === 'tiktok') {
      const { runTikTokOutboundSession } = await import('./src/engagement/outbound-tiktok.js');
      const result = await runTikTokOutboundSession();
      log(`TikTok engagement: ${result.likes} likes, ${result.follows} follows, ${result.comments} comments, ${result.errors} errors`);
    } else {
      const { runOutboundSession } = await import('./src/engagement/outbound.js');
      await runOutboundSession();
    }
  } catch (err) {
    log(`${platform} engagement error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function printDaySummary(): Promise<void> {
  const [igLikes, igFollows, igComments, tkLikes, tkFollows, tkComments] = await Promise.all([
    getOutboundEngagementCountToday('like', 'instagram'),
    getOutboundEngagementCountToday('follow', 'instagram'),
    getOutboundEngagementCountToday('comment', 'instagram'),
    getOutboundEngagementCountToday('like', 'tiktok'),
    getOutboundEngagementCountToday('follow', 'tiktok'),
    getOutboundEngagementCountToday('comment', 'tiktok'),
  ]);

  const igPosts = await getPostCountToday('instagram');
  const tkPosts = await getPostCountToday('tiktok');

  log('=== DAY SUMMARY ===');
  log(`Instagram — ${igPosts} posts, ${igLikes} likes, ${igFollows} follows, ${igComments} comments`);
  log(`TikTok    — ${tkPosts} posts, ${tkLikes} likes, ${tkFollows} follows, ${tkComments} comments`);
}

async function main(): Promise<void> {
  log('=== Starting full-day social media scheduler ===');

  // ── 8:00 AM — Morning: Post TikTok + IG engagement ──
  log('--- MORNING SESSION (8 AM) ---');
  const tkPosted = await postToTikTok(2);
  log(`Posted ${tkPosted} TikTok videos`);
  await runEngagement('instagram');

  // ── 10:30 AM — Mid-morning: TikTok engagement ──
  await sleepUntil(10, 30);
  log('--- MID-MORNING SESSION (10:30 AM) ---');
  await runEngagement('tiktok');

  // ── 1:00 PM — Lunch: Post remaining + IG engagement ──
  await sleepUntil(13, 0);
  log('--- LUNCH SESSION (1 PM) ---');
  const tkPosted2 = await postToTikTok(1);
  log(`Posted ${tkPosted2} more TikTok videos`);
  await runEngagement('instagram');

  // ── 4:00 PM — Afternoon: TikTok engagement ──
  await sleepUntil(16, 0);
  log('--- AFTERNOON SESSION (4 PM) ---');
  await runEngagement('tiktok');

  // ── 7:00 PM — Evening: Both platforms (peak hours) ──
  await sleepUntil(19, 0);
  log('--- EVENING SESSION (7 PM) ---');
  await runEngagement('instagram');
  await runEngagement('tiktok');

  // ── End of day summary ──
  log('--- END OF DAY ---');
  await printDaySummary();
  log('=== Day scheduler complete ===');
}

main().catch((err) => {
  log(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
