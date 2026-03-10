import type { Post } from '@wlu/shared';
import { launchTwitter } from '../platforms/twitter/browser.js';
import { extractSnippet, textContains } from './match-utils.js';

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
    await page.goto('https://x.com/wordsleftunsaid', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(5000);

    const snippet = extractSnippet(post.caption);
    if (!snippet) {
      return { verified: false, error: 'No caption to match against' };
    }

    // Look for the tweet text in article elements
    const tweets = page.locator('[data-testid="tweetText"]');
    const firstTweetText = await tweets.first().textContent({ timeout: 5000 }).catch(() => '');

    if (firstTweetText && textContains(firstTweetText, snippet)) {
      const tweetLink = page.locator('a[href*="/status/"]').first();
      const href = await tweetLink.getAttribute('href').catch(() => null);
      const postUrl = href ? `https://x.com${href}` : undefined;
      return { verified: true, postUrl };
    }

    // Fallback: check full page body
    const bodyText = await page.textContent('body').catch(() => '') ?? '';
    if (textContains(bodyText, snippet)) {
      return { verified: true };
    }

    return { verified: false, error: 'Most recent tweet text does not match' };
  } finally {
    await context.close();
  }
}
