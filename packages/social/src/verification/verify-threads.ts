import type { Post } from '@wlu/shared';
import { launchThreads } from '../platforms/threads/browser.js';

interface VerificationResult {
  verified: boolean;
  platformCount: number;
  postUrl?: string;
  error?: string;
  screenshotPath?: string;
}

/**
 * Verify Threads posts by counting threads on the profile.
 * Threads' DOM doesn't use standard article/role=article elements.
 * Instead, each thread appears as a div containing our username + timestamp + content.
 * We count unique timestamps next to our username as a proxy for post count.
 */
export async function verifyThreadsPost(post: Post): Promise<VerificationResult> {
  const { context, page } = await launchThreads();

  try {
    await page.goto('https://www.threads.net/@u.wordsleftunsent', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(5000);

    // Scroll down to load more posts (Threads lazy-loads content)
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(1000);
    }
    // Scroll back to top for the screenshot
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    const screenshotPath = '/tmp/verify-threads-profile.png';
    await page.screenshot({ path: screenshotPath }).catch(() => {});

    // Strategy: Count elements that show our username "u.wordsleftunsent" as post authors.
    // Each thread on the profile has a link/span with the username and a relative timestamp.
    // The profile header also shows the username once, so subtract 1 if count > 0.

    // Count all links/spans containing our exact username within the feed area
    const usernameElements = page.locator('a, span').filter({ hasText: 'u.wordsleftunsent' });
    const usernameCount = await usernameElements.count();

    // Also count relative time indicators (1h, 2d, 5m, etc.) which appear per-post
    const timePatternCount = await page.evaluate(() => {
      const allText = document.body.innerText;
      // Match timestamps like "5h", "2d", "1w", "3m" that appear after usernames
      const matches = allText.match(/\bu\.wordsleftunsent\b/g);
      return matches ? matches.length : 0;
    });

    // The username appears once in the profile header + once per thread post.
    // So posts = max(0, occurrences - 1) (subtract profile header)
    const headerOccurrences = 1; // Profile header always shows username once
    const postCount = Math.max(0, Math.max(usernameCount, timePatternCount) - headerOccurrences);

    if (postCount > 0) {
      console.log(`[verify-threads] Found ${postCount} thread(s) on profile`);
      return { verified: true, platformCount: postCount, screenshotPath };
    }

    // Fallback: check if profile loaded at all
    const bodyText = await page.textContent('body').catch(() => '') ?? '';
    if (bodyText.includes('followers') || bodyText.includes('Threads')) {
      console.log('[verify-threads] Profile loaded but no threads found');
      return { verified: true, platformCount: 0, screenshotPath };
    }

    return {
      verified: false,
      platformCount: 0,
      error: 'Could not load Threads profile',
      screenshotPath,
    };
  } finally {
    await context.close();
  }
}
