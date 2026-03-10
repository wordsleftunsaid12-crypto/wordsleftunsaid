/**
 * Post-publish QA verification orchestrator.
 * Checks if recently published posts actually appeared on each platform.
 *
 * Strategy: Only verify the MOST RECENT post per platform per cycle.
 * - If the latest post is on the profile, older ones almost certainly are too.
 * - This avoids opening the browser N times per platform.
 * - Posts that can't be verified get marked so they aren't retried endlessly.
 */
import { getUnverifiedPosts, updatePostVerification } from '@wlu/shared';
import type { Post, Platform } from '@wlu/shared';
import { withBrowserLock } from '../platforms/browser-lock.js';
import { resolve } from 'node:path';

/** Map platform → browser session directory. */
const SESSION_DIRS: Record<string, string> = {
  instagram: resolve(process.env.HOME ?? '.', '.wlu-instagram-session'),
  tiktok: resolve(process.env.HOME ?? '.', '.wlu-tiktok-session'),
  youtube: resolve(process.env.HOME ?? '.', '.wlu-youtube-session'),
  reddit: resolve(process.env.HOME ?? '.', '.wlu-reddit-session'),
  pinterest: resolve(process.env.HOME ?? '.', '.wlu-pinterest-session'),
  twitter: resolve(process.env.HOME ?? '.', '.wlu-twitter-session'),
  threads: resolve(process.env.HOME ?? '.', '.wlu-threads-session'),
};

/** Max time (ms) a single platform verification can take before aborting. */
const VERIFY_TIMEOUT_MS = 60_000;

interface VerificationResult {
  verified: boolean;
  postUrl?: string;
  error?: string;
}

/** Platform-specific verifier function type. */
type Verifier = (post: Post) => Promise<VerificationResult>;

/** Lazy-load verifiers to avoid importing all browser modules at startup. */
async function getVerifier(platform: Platform): Promise<Verifier | null> {
  switch (platform) {
    case 'instagram': {
      const { verifyInstagramPost } = await import('./verify-instagram.js');
      return verifyInstagramPost;
    }
    case 'tiktok': {
      const { verifyTikTokPost } = await import('./verify-tiktok.js');
      return verifyTikTokPost;
    }
    case 'youtube': {
      const { verifyYouTubePost } = await import('./verify-youtube.js');
      return verifyYouTubePost;
    }
    case 'reddit': {
      const { verifyRedditPost } = await import('./verify-reddit.js');
      return verifyRedditPost;
    }
    case 'twitter': {
      const { verifyTwitterPost } = await import('./verify-twitter.js');
      return verifyTwitterPost;
    }
    case 'threads': {
      const { verifyThreadsPost } = await import('./verify-threads.js');
      return verifyThreadsPost;
    }
    case 'pinterest': {
      const { verifyPinterestPost } = await import('./verify-pinterest.js');
      return verifyPinterestPost;
    }
    default:
      return null;
  }
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

/**
 * Verify recent posts — one per platform per cycle.
 *
 * Only checks the most recent unverified post for each platform.
 * If it's verified, all older posts for that platform are bulk-marked verified.
 * This prevents opening the browser repeatedly for many posts.
 */
export async function verifyRecentPosts(): Promise<{
  verified: number;
  failed: number;
  skipped: number;
}> {
  const unverified = await getUnverifiedPosts(24);

  if (unverified.length === 0) {
    console.log('[verify] No unverified posts');
    return { verified: 0, failed: 0, skipped: 0 };
  }

  console.log(`[verify] Found ${unverified.length} unverified post(s)`);

  // Group by platform — posts are ordered newest first from the query
  const byPlatform = new Map<Platform, Post[]>();
  for (const post of unverified) {
    const list = byPlatform.get(post.platform) ?? [];
    list.push(post);
    byPlatform.set(post.platform, list);
  }

  let verified = 0;
  let failed = 0;
  let skipped = 0;

  for (const [platform, posts] of byPlatform) {
    const verifier = await getVerifier(platform);
    if (!verifier) {
      console.log(`[verify] No verifier for ${platform} — skipping ${posts.length} post(s)`);
      skipped += posts.length;
      continue;
    }

    // Only verify the MOST RECENT post (first in the array, since sorted desc)
    const latestPost = posts[0];
    const olderPosts = posts.slice(1);
    const sessionDir = SESSION_DIRS[platform];

    console.log(`[verify] Checking ${platform} (most recent of ${posts.length})...`);

    try {
      const doVerify = () => withTimeout(
        verifier(latestPost),
        VERIFY_TIMEOUT_MS,
        `${platform} verification`,
      );

      const result = await (sessionDir
        ? withBrowserLock(sessionDir, doVerify)
        : doVerify());

      await updatePostVerification(latestPost.id, {
        verified: result.verified,
        verificationError: result.error,
        platformPostUrl: result.postUrl,
      });

      if (result.verified) {
        console.log(`[verify] ${platform} — VERIFIED${result.postUrl ? ` (${result.postUrl})` : ''}`);
        verified++;

        // Bulk-mark older posts as verified too (if latest is live, older ones are too)
        for (const older of olderPosts) {
          await updatePostVerification(older.id, {
            verified: true,
            verificationError: undefined,
            platformPostUrl: undefined,
          });
          verified++;
        }
        if (olderPosts.length > 0) {
          console.log(`[verify] ${platform} — bulk-verified ${olderPosts.length} older post(s)`);
        }
      } else {
        console.warn(`[verify] ${platform} — NOT FOUND: ${result.error ?? 'unknown'}`);
        failed++;
        // Don't fail older posts — they might just be from before the profile loaded
        skipped += olderPosts.length;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[verify] ${platform} error: ${msg}`);

      // Mark as failed with error so it's not retried endlessly
      await updatePostVerification(latestPost.id, {
        verified: false,
        verificationError: msg,
      });
      failed++;
      skipped += olderPosts.length;
    }
  }

  console.log(`[verify] Done — verified: ${verified}, failed: ${failed}, skipped: ${skipped}`);
  return { verified, failed, skipped };
}
