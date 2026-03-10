import type { Post } from '@wlu/shared';
import { launchYouTube } from '../platforms/youtube/browser.js';
import { extractSnippet, textContains } from './match-utils.js';

interface VerificationResult {
  verified: boolean;
  postUrl?: string;
  error?: string;
}

/**
 * Verify a YouTube Short exists by checking YouTube Studio's content list.
 */
export async function verifyYouTubePost(post: Post): Promise<VerificationResult> {
  const { context, page } = await launchYouTube();

  try {
    await page.goto('https://studio.youtube.com/channel/UC/videos/short', {
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
      const videoLink = page.locator('a[href*="/shorts/"], a[href*="/video/"]').first();
      const href = await videoLink.getAttribute('href').catch(() => null);
      const postUrl = href ? `https://youtube.com${href}` : undefined;
      return { verified: true, postUrl };
    }

    return { verified: false, error: 'Most recent Short title does not match' };
  } finally {
    await context.close();
  }
}
