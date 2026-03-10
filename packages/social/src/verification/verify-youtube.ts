import type { Post } from '@wlu/shared';
import { launchYouTube } from '../platforms/youtube/browser.js';

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
    // Navigate to YouTube Studio content page
    await page.goto('https://studio.youtube.com/channel/UC/videos/short', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(5000);

    // Look for the most recent short's title
    const snippet = post.caption?.split('\n')[0]?.slice(0, 30) ?? '';
    if (!snippet) {
      return { verified: false, error: 'No caption to match against' };
    }

    const pageText = await page.textContent('body') ?? '';
    if (pageText.includes(snippet)) {
      // Try to get the video URL
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
