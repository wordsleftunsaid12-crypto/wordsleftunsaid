import type { Post } from '@wlu/shared';
import { launchTikTok, navigateToProfile } from '../platforms/tiktok/browser.js';

interface VerificationResult {
  verified: boolean;
  postUrl?: string;
  error?: string;
}

/**
 * Verify a TikTok post exists by checking the profile's most recent video.
 */
export async function verifyTikTokPost(post: Post): Promise<VerificationResult> {
  const { context, page } = await launchTikTok();

  try {
    await navigateToProfile(page, 'u.wordsleftunsaid');
    await page.waitForTimeout(3000);

    // Click the most recent video
    const firstVideo = page.locator('[data-e2e="user-post-item"] a, div[class*="DivItemContainer"] a').first();
    if (!(await firstVideo.isVisible({ timeout: 5000 }).catch(() => false))) {
      return { verified: false, error: 'No videos visible on profile' };
    }

    await firstVideo.click();
    await page.waitForTimeout(3000);

    const postUrl = page.url();

    // Check description text
    const snippet = post.caption?.slice(0, 30) ?? '';
    const descEl = page.locator('[data-e2e="browse-video-desc"], [class*="DivVideoDesc"]')
      .filter({ hasText: snippet }).first();
    const found = await descEl.isVisible({ timeout: 5000 }).catch(() => false);

    if (found) {
      return { verified: true, postUrl };
    }

    // Check page content broadly
    const pageText = await page.textContent('body') ?? '';
    if (snippet && pageText.includes(snippet)) {
      return { verified: true, postUrl };
    }

    return { verified: false, error: 'Most recent video description does not match' };
  } finally {
    await context.close();
  }
}
