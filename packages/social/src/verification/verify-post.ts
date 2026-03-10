/**
 * Post-publish QA verification orchestrator.
 * Checks if recently published posts actually appeared on each platform.
 */
import { getUnverifiedPosts, updatePostVerification, updateContentQueueStatus } from '@wlu/shared';
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

/**
 * Verify all unverified posts from the last 24 hours.
 * Groups by platform to minimize browser opens.
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

  // Group by platform
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

    const sessionDir = SESSION_DIRS[platform];

    for (const post of posts) {
      try {
        const result = await (sessionDir
          ? withBrowserLock(sessionDir, () => verifier(post))
          : verifier(post));

        await updatePostVerification(post.id, {
          verified: result.verified,
          verificationError: result.error,
          platformPostUrl: result.postUrl,
        });

        if (result.verified) {
          console.log(`[verify] ${platform} post ${post.id.slice(0, 8)} — VERIFIED${result.postUrl ? ` (${result.postUrl})` : ''}`);
          verified++;
        } else {
          console.warn(`[verify] ${platform} post ${post.id.slice(0, 8)} — NOT FOUND: ${result.error ?? 'unknown'}`);
          failed++;

          // Re-queue for retry if content queue ID exists
          if (post.contentQueueId) {
            try {
              await updateContentQueueStatus(post.contentQueueId, 'scheduled', {
                scheduledFor: new Date(Date.now() + 30 * 60000).toISOString(),
                errorMessage: `Verification failed: ${result.error ?? 'post not found on platform'}`,
              });
              console.log(`[verify] Re-queued ${post.contentQueueId.slice(0, 8)} for retry`);
            } catch (err) {
              console.warn(`[verify] Failed to re-queue:`, err instanceof Error ? err.message : err);
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[verify] Error verifying ${platform} post ${post.id.slice(0, 8)}:`, msg);
        await updatePostVerification(post.id, {
          verified: false,
          verificationError: msg,
        });
        failed++;
      }
    }
  }

  console.log(`[verify] Done — verified: ${verified}, failed: ${failed}, skipped: ${skipped}`);
  return { verified, failed, skipped };
}
