import type { Post } from '@wlu/shared';
import { launchThreads } from '../platforms/threads/browser.js';

interface VerificationResult {
  verified: boolean;
  postUrl?: string;
  error?: string;
}

/**
 * Verify a Threads post exists by checking the profile's most recent thread.
 */
export async function verifyThreadsPost(post: Post): Promise<VerificationResult> {
  const { context, page } = await launchThreads();

  try {
    // Navigate to profile
    await page.goto('https://www.threads.net/@u.wordsleftunsaid', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(5000);

    const snippet = post.caption?.slice(0, 30) ?? '';
    if (!snippet) {
      return { verified: false, error: 'No caption to match against' };
    }

    const pageText = await page.textContent('body') ?? '';
    if (pageText.includes(snippet)) {
      return { verified: true };
    }

    return { verified: false, error: 'Most recent thread text does not match' };
  } finally {
    await context.close();
  }
}
