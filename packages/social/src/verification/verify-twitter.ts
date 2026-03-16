import type { Post } from '@wlu/shared';
import { launchTwitter } from '../platforms/twitter/browser.js';

interface VerificationResult {
  verified: boolean;
  platformCount: number;
  postUrl?: string;
  error?: string;
  screenshotPath?: string;
}

/**
 * Verify Twitter/X posts by counting tweets on the profile.
 */
export async function verifyTwitterPost(post: Post): Promise<VerificationResult> {
  const { context, page } = await launchTwitter();

  try {
    await page.goto('https://x.com/unsentwords12', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(5000);

    const screenshotPath = '/tmp/verify-twitter-profile.png';
    await page.screenshot({ path: screenshotPath }).catch(() => {});

    // Try to read tweet count from profile header (shows "X posts" in the sub-header)
    const headerText = await page.textContent('h2, [data-testid="UserProfileHeader_Items"]').catch(() => '') ?? '';
    const bodyText = await page.textContent('body').catch(() => '') ?? '';

    // X/Twitter shows "X posts" near the top of the profile
    const countMatch = bodyText.match(/(\d[\d,]*)\s*posts?/i);
    if (countMatch) {
      const count = parseInt(countMatch[1].replace(/,/g, ''), 10);
      console.log(`[verify-twitter] Profile shows ${count} posts`);
      return { verified: true, platformCount: count, screenshotPath };
    }

    // Fallback: count tweet elements
    const tweets = page.locator('[data-testid="tweet"], [data-testid="tweetText"]');
    const tweetCount = await tweets.count();
    if (tweetCount > 0) {
      console.log(`[verify-twitter] Found ${tweetCount} tweet elements`);
      return { verified: true, platformCount: tweetCount, screenshotPath };
    }

    // Check if profile loaded
    if (bodyText.includes('Following') || bodyText.includes('Followers')) {
      console.log('[verify-twitter] Profile loaded but no tweets found');
      return { verified: true, platformCount: 0, screenshotPath };
    }

    return {
      verified: false,
      platformCount: 0,
      error: 'Could not load Twitter profile',
      screenshotPath,
    };
  } finally {
    await context.close();
  }
}
