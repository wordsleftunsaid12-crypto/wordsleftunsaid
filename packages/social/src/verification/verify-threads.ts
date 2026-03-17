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

    // Detect 404 / page-not-found
    const bodyText = await page.textContent('body').catch(() => '') ?? '';
    if (bodyText.includes('Not all who wander') || bodyText.includes("page is gone")) {
      console.log('[verify-threads] Profile returned 404 — page not found');
      return {
        verified: false,
        platformCount: -1, // Signal: blocked/unavailable, skip
        error: 'Threads profile returned 404 — may be temporarily unavailable',
        screenshotPath,
      };
    }

    // Strategy: Count elements that show our username as post authors.
    // Each thread on the profile has a link/span with the username and a relative timestamp.
    // The profile header also shows the username once, so subtract 1 if count > 0.
    const username = 'u.wordsleftunsent';

    // Count all links/spans containing our exact username within the feed area
    const usernameElements = page.locator('a, span').filter({ hasText: username });
    const usernameCount = await usernameElements.count();

    // Also count via regex on body text
    const textMatchCount = await page.evaluate((uname: string) => {
      const allText = document.body.innerText;
      const regex = new RegExp(`\\b${uname.replace('.', '\\.')}\\b`, 'g');
      const matches = allText.match(regex);
      return matches ? matches.length : 0;
    }, username);

    // The username appears once in the profile header + once per thread post.
    // So posts = max(0, occurrences - 1) (subtract profile header)
    const headerOccurrences = 1;
    const postCount = Math.max(0, Math.max(usernameCount, textMatchCount) - headerOccurrences);

    if (postCount > 0) {
      console.log(`[verify-threads] Found ${postCount} thread(s) on profile`);
      return { verified: true, platformCount: postCount, screenshotPath };
    }

    // Fallback: check if profile loaded at all
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
