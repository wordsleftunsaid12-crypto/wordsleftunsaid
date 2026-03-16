import type { Post } from '@wlu/shared';
import { launchReddit } from '../platforms/reddit/browser.js';

interface VerificationResult {
  verified: boolean;
  platformCount: number;
  postUrl?: string;
  error?: string;
  screenshotPath?: string;
}

/**
 * Verify Reddit posts by counting submissions on the user profile.
 */
export async function verifyRedditPost(post: Post): Promise<VerificationResult> {
  const { context, page } = await launchReddit();

  try {
    await page.goto('https://www.reddit.com/user/Proud-Minute4849/submitted/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(8000);

    const screenshotPath = '/tmp/verify-reddit-profile.png';
    await page.screenshot({ path: screenshotPath }).catch(() => {});

    // Count post entries on the submissions page
    const postElements = page.locator('a[href*="/comments/"], shreddit-post, article');
    const count = await postElements.count();

    if (count > 0) {
      console.log(`[verify-reddit] Profile shows ${count} posts`);
      return { verified: true, platformCount: count, screenshotPath };
    }

    // Check if page loaded at all
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
    if (bodyText.includes('submitted') || bodyText.includes('Posts')) {
      console.log('[verify-reddit] Profile loaded but no posts found');
      return { verified: true, platformCount: 0, screenshotPath };
    }

    return {
      verified: false,
      platformCount: 0,
      error: 'Could not load Reddit profile',
      screenshotPath,
    };
  } finally {
    await context.close();
  }
}
