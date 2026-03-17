import type { Post } from '@wlu/shared';
import { launchPinterest } from '../platforms/pinterest/browser.js';

/** Pinterest profile username — must match the logged-in account */
const PINTEREST_USERNAME = 'wordsleftunsent';

interface VerificationResult {
  verified: boolean;
  platformCount: number;
  postUrl?: string;
  error?: string;
  screenshotPath?: string;
}

/**
 * Verify Pinterest pins by navigating to the user's "Created" tab
 * and counting published pins.
 */
export async function verifyPinterestPost(post: Post): Promise<VerificationResult> {
  const { context, page } = await launchPinterest();

  try {
    const profileUrl = `https://www.pinterest.com/${PINTEREST_USERNAME}/`;
    console.log(`[verify-pinterest] Navigating to: ${profileUrl}`);
    await page.goto(profileUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(5000);

    // Verify we're on a profile page, not the home feed or error page
    const currentUrl = page.url();
    const isProfilePage =
      currentUrl.includes(`pinterest.com/${PINTEREST_USERNAME}`) &&
      !currentUrl.includes('show_error') &&
      !currentUrl.includes('login');

    const screenshotPath = '/tmp/verify-pinterest-profile.png';
    await page.screenshot({ path: screenshotPath }).catch(() => {});

    if (!isProfilePage) {
      // We got redirected to the home feed — username may be wrong
      console.warn(`[verify-pinterest] Redirected to ${currentUrl} — not a profile page`);
      return {
        verified: false,
        platformCount: 0,
        error: `Redirected to home feed instead of profile (${currentUrl})`,
        screenshotPath,
      };
    }

    // Click the "Created" tab if not already active
    const createdTab = page.getByText('Created', { exact: true }).first();
    if (await createdTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createdTab.click().catch(() => {});
      await page.waitForTimeout(2000);
    }

    // Count pin elements on the Created tab
    const pinElements = page.locator('a[href*="/pin/"], [data-test-id="pin"]');
    const count = await pinElements.count();

    if (count > 0) {
      // Deduplicate — each pin may have multiple links
      const hrefs = new Set<string>();
      for (let i = 0; i < count; i++) {
        const href = await pinElements.nth(i).getAttribute('href').catch(() => null);
        if (href && href.includes('/pin/')) hrefs.add(href);
      }
      const uniqueCount = hrefs.size;
      console.log(`[verify-pinterest] Created tab shows ${uniqueCount} pins`);
      return { verified: true, platformCount: uniqueCount, screenshotPath };
    }

    // Check if profile loaded
    const profileBodyText = await page.textContent('body').catch(() => '') ?? '';
    if (profileBodyText.includes('Created') || profileBodyText.includes('followers')) {
      console.log('[verify-pinterest] Profile loaded but no pins found');
      return { verified: true, platformCount: 0, screenshotPath };
    }

    return {
      verified: false,
      platformCount: 0,
      error: 'Could not load Pinterest profile',
      screenshotPath,
    };
  } finally {
    await context.close();
  }
}
