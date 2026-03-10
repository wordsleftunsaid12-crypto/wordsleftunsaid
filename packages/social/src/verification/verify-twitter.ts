import type { Post } from '@wlu/shared';
import { launchTwitter } from '../platforms/twitter/browser.js';

interface VerificationResult {
  verified: boolean;
  postUrl?: string;
  error?: string;
}

/**
 * Verify a Twitter/X post exists by checking the profile's most recent tweet.
 */
export async function verifyTwitterPost(post: Post): Promise<VerificationResult> {
  const { context, page } = await launchTwitter();

  try {
    // Navigate to profile
    await page.goto('https://x.com/wordsleftunsaid', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(5000);

    // Check if the most recent tweet text matches
    const snippet = post.caption?.slice(0, 30) ?? '';
    if (!snippet) {
      return { verified: false, error: 'No caption to match against' };
    }

    // Look for the tweet text in article elements
    const tweets = page.locator('[data-testid="tweetText"]');
    const firstTweetText = await tweets.first().textContent().catch(() => '');

    if (firstTweetText && firstTweetText.includes(snippet)) {
      // Get tweet URL
      const tweetLink = page.locator('a[href*="/status/"]').first();
      const href = await tweetLink.getAttribute('href').catch(() => null);
      const postUrl = href ? `https://x.com${href}` : undefined;

      return { verified: true, postUrl };
    }

    return { verified: false, error: 'Most recent tweet text does not match' };
  } finally {
    await context.close();
  }
}
