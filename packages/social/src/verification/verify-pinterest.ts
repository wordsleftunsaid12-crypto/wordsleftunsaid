import type { Post } from '@wlu/shared';
import { launchPinterest } from '../platforms/pinterest/browser.js';
import { extractSnippet, textContains } from './match-utils.js';

interface VerificationResult {
  verified: boolean;
  postUrl?: string;
  error?: string;
}

/**
 * Verify a Pinterest pin exists by checking the profile's Created tab.
 */
export async function verifyPinterestPost(post: Post): Promise<VerificationResult> {
  const { context, page } = await launchPinterest();

  try {
    await page.goto('https://www.pinterest.com/wordsleftunsaid/_created/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(5000);

    const snippet = extractSnippet(post.caption);
    if (!snippet) {
      return { verified: false, error: 'No caption to match against' };
    }

    const pageText = await page.textContent('body').catch(() => '') ?? '';
    if (textContains(pageText, snippet)) {
      const pinLink = page.locator('a[href*="/pin/"]').first();
      const href = await pinLink.getAttribute('href').catch(() => null);
      const postUrl = href ? `https://www.pinterest.com${href}` : undefined;
      return { verified: true, postUrl };
    }

    return { verified: false, error: 'Most recent pin does not match' };
  } finally {
    await context.close();
  }
}
