import type { Post } from '@wlu/shared';
import { launchReddit } from '../platforms/reddit/browser.js';

interface VerificationResult {
  verified: boolean;
  postUrl?: string;
  error?: string;
}

/**
 * Verify a Reddit post exists by checking the user's profile submissions.
 */
export async function verifyRedditPost(post: Post): Promise<VerificationResult> {
  const { context, page } = await launchReddit();

  try {
    // Navigate to user's post history
    await page.goto('https://www.reddit.com/user/me/submitted/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(5000);

    // Check if the most recent post title matches
    const snippet = post.caption?.slice(0, 30) ?? '';
    if (!snippet) {
      return { verified: false, error: 'No caption to match against' };
    }

    const pageText = await page.textContent('body') ?? '';
    if (pageText.includes(snippet)) {
      // Try to find the post link
      const postLink = page.locator('a[href*="/comments/"]').first();
      const href = await postLink.getAttribute('href').catch(() => null);
      const postUrl = href?.startsWith('http') ? href : href ? `https://www.reddit.com${href}` : undefined;

      return { verified: true, postUrl };
    }

    return { verified: false, error: 'Most recent submission does not match' };
  } finally {
    await context.close();
  }
}
