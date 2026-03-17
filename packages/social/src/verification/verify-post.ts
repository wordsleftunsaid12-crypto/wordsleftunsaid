/**
 * Post-publish QA verification orchestrator.
 *
 * Strategy: For each platform, count posts on the actual platform profile
 * and compare against the DB record count. Take screenshots as evidence.
 * This catches "ghost posts" — posts recorded in DB but not on the platform.
 */
import { getTotalPostCount, updatePostVerification, getUnverifiedPosts, getContentQueue } from '@wlu/shared';
import type { Post, Platform } from '@wlu/shared';
import { withBrowserLock } from '../platforms/browser-lock.js';
import { resolve } from 'node:path';

/** All platforms we post to and can verify. */
const VERIFIABLE_PLATFORMS: Platform[] = [
  'instagram', 'tiktok', 'youtube', 'reddit', 'twitter', 'threads', 'pinterest',
];

/** Map platform → browser session directory. */
const SESSION_DIRS: Record<string, string> = {
  instagram: resolve(process.env.HOME ?? '.', '.wlu-instagram-session'),
  tiktok: resolve(process.env.HOME ?? '.', '.wlu-tiktok-session'),
  youtube: resolve(process.env.HOME ?? '.', '.wlu-youtube-session'),
  reddit: resolve(process.env.HOME ?? '.', '.wlu-reddit-session'),
  twitter: resolve(process.env.HOME ?? '.', '.wlu-twitter-session'),
  threads: resolve(process.env.HOME ?? '.', '.wlu-threads-session'),
  pinterest: resolve(process.env.HOME ?? '.', '.wlu-pinterest-session'),
};

/** Max time (ms) a single platform verification can take. */
const VERIFY_TIMEOUT_MS = 60_000;

interface PlatformVerifyResult {
  platform: Platform;
  dbCount: number;
  platformCount: number;
  match: boolean;
  screenshotPath?: string;
  error?: string;
}

/** Wrap a promise with a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/** Get the platform-specific count function. */
async function getPlatformCount(
  platform: Platform,
): Promise<{ platformCount: number; screenshotPath?: string }> {
  // All verifiers follow the same pattern: launch browser → count posts → screenshot
  const dummy = {} as Post;

  switch (platform) {
    case 'instagram': {
      const { verifyInstagramPost } = await import('./verify-instagram.js');
      const r = await verifyInstagramPost(dummy);
      return { platformCount: r.platformCount, screenshotPath: r.screenshotPath };
    }
    case 'tiktok': {
      const { verifyTikTokPost } = await import('./verify-tiktok.js');
      const r = await verifyTikTokPost(dummy);
      return { platformCount: r.platformCount, screenshotPath: r.screenshotPath };
    }
    case 'youtube': {
      const { verifyYouTubePost } = await import('./verify-youtube.js');
      const r = await verifyYouTubePost(dummy);
      return { platformCount: r.platformCount, screenshotPath: r.screenshotPath };
    }
    case 'reddit': {
      const { verifyRedditPost } = await import('./verify-reddit.js');
      const r = await verifyRedditPost(dummy);
      return { platformCount: r.platformCount, screenshotPath: r.screenshotPath };
    }
    case 'twitter': {
      const { verifyTwitterPost } = await import('./verify-twitter.js');
      const r = await verifyTwitterPost(dummy);
      return { platformCount: r.platformCount, screenshotPath: r.screenshotPath };
    }
    case 'threads': {
      const { verifyThreadsPost } = await import('./verify-threads.js');
      const r = await verifyThreadsPost(dummy);
      return { platformCount: r.platformCount, screenshotPath: r.screenshotPath };
    }
    case 'pinterest': {
      const { verifyPinterestPost } = await import('./verify-pinterest.js');
      const r = await verifyPinterestPost(dummy);
      return { platformCount: r.platformCount, screenshotPath: r.screenshotPath };
    }
    default:
      throw new Error(`No verifier for ${platform}`);
  }
}

/**
 * Run QA verification across all platforms.
 *
 * For each platform:
 * 1. Get DB post count
 * 2. Navigate to platform profile and count posts
 * 3. Compare counts and report discrepancies
 * 4. Take screenshots as evidence
 *
 * Also marks any unverified posts as verified/failed based on the count comparison.
 */
export async function verifyRecentPosts(): Promise<{
  verified: number;
  failed: number;
  skipped: number;
  results: PlatformVerifyResult[];
}> {
  const results: PlatformVerifyResult[] = [];
  let verified = 0;
  let failed = 0;
  let skipped = 0;

  for (const platform of VERIFIABLE_PLATFORMS) {
    const sessionDir = SESSION_DIRS[platform];

    try {
      // Get DB count for this platform
      const dbCount = await getTotalPostCount(platform);

      // Get platform count via browser
      const doVerify = () => withTimeout(
        getPlatformCount(platform),
        VERIFY_TIMEOUT_MS,
        `${platform} verification`,
      );

      const { platformCount, screenshotPath } = await (sessionDir
        ? withBrowserLock(sessionDir, doVerify)
        : doVerify());

      // platformCount === -1 means the verifier was blocked (e.g. CAPTCHA)
      // In that case, skip this platform entirely — don't mark posts as failed
      if (platformCount < 0) {
        console.warn(
          `[verify] ${platform} — SKIPPED (blocked by CAPTCHA or anti-bot)`,
        );
        results.push({
          platform,
          dbCount,
          platformCount: 0,
          match: false,
          screenshotPath,
          error: 'Blocked by CAPTCHA — skipped',
        });
        skipped++;
        continue;
      }

      const match = platformCount >= dbCount;
      const result: PlatformVerifyResult = {
        platform,
        dbCount,
        platformCount,
        match,
        screenshotPath,
      };

      if (match) {
        console.log(
          `[verify] ${platform} — OK (platform: ${platformCount}, db: ${dbCount})`,
        );
        verified++;
      } else {
        const missing = dbCount - platformCount;
        console.warn(
          `[verify] ${platform} — MISMATCH: platform has ${platformCount} but DB has ${dbCount} (${missing} ghost posts)`,
        );
        failed++;
      }

      results.push(result);

      // Mark unverified posts based on count comparison
      await markUnverifiedPosts(platform, match);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[verify] ${platform} error: ${msg}`);
      results.push({
        platform,
        dbCount: 0,
        platformCount: 0,
        match: false,
        error: msg,
      });
      failed++;
    }
  }

  // Check for failed queue items (publishes that crashed before reaching the posts table)
  const failedQueueItems = await checkFailedQueueItems();

  // Check cross-platform balance
  const balanceWarnings = checkCrossPlatformBalance(results);

  // Print summary
  console.log('\n[verify] ═══ QA Summary ═══');
  for (const r of results) {
    const status = r.error ? 'ERROR' : r.match ? 'OK' : 'MISMATCH';
    const detail = r.error
      ? r.error
      : `platform: ${r.platformCount}, db: ${r.dbCount}`;
    console.log(`[verify]   ${r.platform.padEnd(12)} ${status.padEnd(10)} ${detail}`);
    if (r.screenshotPath) {
      console.log(`[verify]   ${''.padEnd(12)} screenshot: ${r.screenshotPath}`);
    }
  }

  if (failedQueueItems.length > 0) {
    console.log('[verify]');
    console.log('[verify]   FAILED QUEUE ITEMS (publish crashed before recording):');
    for (const item of failedQueueItems) {
      console.log(`[verify]     ${item.platform.padEnd(12)} ${item.count} failed — ${item.lastError}`);
    }
    failed += failedQueueItems.length;
  }

  if (balanceWarnings.length > 0) {
    console.log('[verify]');
    console.log('[verify]   BALANCE WARNINGS:');
    for (const w of balanceWarnings) {
      console.log(`[verify]     ${w}`);
    }
  }

  console.log('[verify] ═══════════════════\n');

  return { verified, failed, skipped, results };
}

/**
 * Mark unverified posts for a platform as verified or failed
 * based on whether the platform count matches the DB count.
 */
async function markUnverifiedPosts(
  platform: Platform,
  countsMatch: boolean,
): Promise<void> {
  const unverified = await getUnverifiedPosts(72); // Check last 3 days

  const platformPosts = unverified.filter((p) => p.platform === platform);
  if (platformPosts.length === 0) return;

  for (const post of platformPosts) {
    try {
      await updatePostVerification(post.id, {
        verified: countsMatch,
        verificationError: countsMatch
          ? undefined
          : 'Platform post count is lower than DB count — post may not have been published',
      });
    } catch {
      // Ignore individual update errors
    }
  }

  if (platformPosts.length > 0) {
    console.log(
      `[verify] Marked ${platformPosts.length} ${platform} post(s) as ${countsMatch ? 'verified' : 'failed'}`,
    );
  }
}

/**
 * Check the content_queue for failed items that never made it to the posts table.
 * These represent publish attempts that crashed (e.g., Pinterest button timeout).
 */
async function checkFailedQueueItems(): Promise<
  Array<{ platform: string; count: number; lastError: string }>
> {
  const failedItems: Array<{ platform: string; count: number; lastError: string }> = [];

  for (const platform of VERIFIABLE_PLATFORMS) {
    const items = await getContentQueue({ status: 'failed', platform, limit: 20 });
    if (items.length > 0) {
      const lastError = items[0].errorMessage?.slice(0, 120) ?? 'unknown error';
      failedItems.push({ platform, count: items.length, lastError });
    }
  }

  return failedItems;
}

/**
 * Check if any platform has significantly fewer posts than others,
 * which indicates a systemic publishing issue.
 */
function checkCrossPlatformBalance(results: PlatformVerifyResult[]): string[] {
  const warnings: string[] = [];
  const validResults = results.filter((r) => !r.error);
  if (validResults.length < 3) return warnings;

  const counts = validResults.map((r) => r.dbCount);
  const maxCount = Math.max(...counts);

  // If the max count is at least 3, check for platforms that are far behind
  if (maxCount >= 3) {
    for (const r of validResults) {
      if (r.dbCount < maxCount * 0.4) {
        warnings.push(
          `${r.platform} has only ${r.dbCount} posts (others have up to ${maxCount}) — check for config/publish issues`,
        );
      }
    }
  }

  return warnings;
}
