import type { Post } from '@wlu/shared';
import { launchInstagram, navigateToProfile } from '../platforms/instagram/browser.js';
import { extractSnippet, textContains } from './match-utils.js';

interface VerificationResult {
  verified: boolean;
  postUrl?: string;
  error?: string;
}

/**
 * Verify an Instagram post exists by checking the profile's most recent post.
 */
export async function verifyInstagramPost(post: Post): Promise<VerificationResult> {
  const { context, page } = await launchInstagram();

  try {
    await navigateToProfile(page, 'u.wordsleftunsaid');

    // Check that the profile actually loaded
    const profileLoaded = await page.locator('header section').isVisible({ timeout: 10000 }).catch(() => false);
    if (!profileLoaded) {
      return { verified: false, error: 'Instagram profile did not load' };
    }

    // Check if at least one post exists in the grid
    const firstPost = page.locator('a[href*="/p/"], a[href*="/reel/"]').first();
    const hasPost = await firstPost.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasPost) {
      return { verified: false, error: 'No posts visible on profile' };
    }

    const href = await firstPost.getAttribute('href').catch(() => null);
    const postUrl = href ? `https://www.instagram.com${href}` : undefined;

    const snippet = extractSnippet(post.caption);
    if (!snippet) {
      return { verified: true, postUrl };
    }

    // Click the first post and check caption
    await firstPost.click();
    await page.waitForTimeout(3000);

    // Look for caption text in the expanded post dialog
    const dialogText = await page.locator('article, [role="dialog"]').first()
      .textContent({ timeout: 5000 }).catch(() => '') ?? '';

    if (textContains(dialogText, snippet)) {
      return { verified: true, postUrl: page.url() };
    }

    return { verified: false, error: 'Most recent post caption does not match' };
  } finally {
    await context.close();
  }
}
