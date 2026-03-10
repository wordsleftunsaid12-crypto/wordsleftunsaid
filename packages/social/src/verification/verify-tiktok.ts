import type { Post } from '@wlu/shared';
import { launchTikTok, navigateToProfile } from '../platforms/tiktok/browser.js';
import { extractSnippet, textContains } from './match-utils.js';

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

    // Check that profile loaded — look for video grid
    const firstVideo = page.locator('[data-e2e="user-post-item"] a, div[class*="DivItemContainer"] a').first();
    if (!(await firstVideo.isVisible({ timeout: 10000 }).catch(() => false))) {
      // Try broader selector — TikTok changes classes frequently
      const anyVideo = page.locator('a[href*="/video/"]').first();
      if (!(await anyVideo.isVisible({ timeout: 3000 }).catch(() => false))) {
        return { verified: false, error: 'No videos visible on profile' };
      }
    }

    const snippet = extractSnippet(post.caption);
    if (!snippet) {
      return { verified: true };
    }

    // Click the most recent video and check description
    const videoLink = page.locator('[data-e2e="user-post-item"] a, a[href*="/video/"]').first();
    await videoLink.click();
    await page.waitForTimeout(3000);

    const postUrl = page.url();
    const pageText = await page.textContent('body').catch(() => '') ?? '';
    if (textContains(pageText, snippet)) {
      return { verified: true, postUrl };
    }

    return { verified: false, error: 'Most recent video description does not match' };
  } finally {
    await context.close();
  }
}
