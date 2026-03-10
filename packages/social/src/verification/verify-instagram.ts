import type { Post } from '@wlu/shared';
import { launchInstagram, navigateToProfile } from '../platforms/instagram/browser.js';

interface VerificationResult {
  verified: boolean;
  postUrl?: string;
  error?: string;
}

/**
 * Verify an Instagram post exists by checking the profile's most recent post caption.
 */
export async function verifyInstagramPost(post: Post): Promise<VerificationResult> {
  const { context, page } = await launchInstagram();

  try {
    await navigateToProfile(page, 'u.wordsleftunsaid');
    await page.waitForTimeout(3000);

    // Click the most recent post (top-left in grid)
    const firstPost = page.locator('article a[href*="/p/"], a[href*="/reel/"]').first();
    if (!(await firstPost.isVisible({ timeout: 5000 }).catch(() => false))) {
      return { verified: false, error: 'No posts visible on profile' };
    }

    await firstPost.click();
    await page.waitForTimeout(3000);

    // Get the post URL
    const postUrl = page.url();

    // Check caption text
    const captionEl = page.locator('h1, span').filter({ hasText: post.caption?.slice(0, 30) ?? '' }).first();
    const found = await captionEl.isVisible({ timeout: 5000 }).catch(() => false);

    if (found) {
      return { verified: true, postUrl };
    }

    // Fallback: check if the post URL changed (meaning we did open a post)
    if (postUrl.includes('/p/') || postUrl.includes('/reel/')) {
      // The most recent post exists but caption didn't match — might be a different post
      return { verified: false, error: 'Most recent post caption does not match' };
    }

    return { verified: false, error: 'Could not find post on profile' };
  } finally {
    await context.close();
  }
}
