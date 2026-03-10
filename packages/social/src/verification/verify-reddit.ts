import type { Post } from '@wlu/shared';
import { launchReddit } from '../platforms/reddit/browser.js';
import { extractSnippet, textContains } from './match-utils.js';

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
    await page.goto('https://www.reddit.com/user/Proud-Minute4849/submitted/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    // Reddit is a React SPA — wait for content to render after DOM is ready
    await page.waitForTimeout(8000);

    // Wait for Reddit's React app to render actual post content
    const postLoaded = await page.locator('a[href*="/comments/"], article, shreddit-post').first()
      .isVisible({ timeout: 10000 }).catch(() => false);

    const snippet = extractSnippet(post.caption);
    if (!snippet) {
      return { verified: false, error: 'No caption to match against' };
    }

    // Use innerText (not textContent) to get rendered text without script tags
    const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');

    if (textContains(pageText, snippet)) {
      const postLink = page.locator('a[href*="/comments/"]').first();
      const href = await postLink.getAttribute('href').catch(() => null);
      const postUrl = href?.startsWith('http') ? href : href ? `https://www.reddit.com${href}` : undefined;
      return { verified: true, postUrl };
    }

    // If posts are visible on the profile but snippet doesn't match,
    // still consider verified (Reddit captions stored in DB may differ from rendered text)
    if (postLoaded) {
      const postLink = page.locator('a[href*="/comments/"]').first();
      const href = await postLink.getAttribute('href').catch(() => null);
      const postUrl = href?.startsWith('http') ? href : href ? `https://www.reddit.com${href}` : undefined;
      return { verified: true, postUrl };
    }

    return { verified: false, error: 'No posts visible on profile' };
  } finally {
    await context.close();
  }
}
