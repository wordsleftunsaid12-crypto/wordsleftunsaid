import type { Post } from '@wlu/shared';
import { launchTikTok, navigateToProfile, dismissModals } from '../platforms/tiktok/browser.js';

interface VerificationResult {
  verified: boolean;
  platformCount: number;
  postUrl?: string;
  error?: string;
  screenshotPath?: string;
}

/**
 * Verify TikTok posts by counting videos on the profile.
 * Navigates to our profile, reads the video count from the stats header,
 * and takes a screenshot as evidence.
 */
export async function verifyTikTokPost(post: Post): Promise<VerificationResult> {
  const { context, page } = await launchTikTok();

  try {
    await navigateToProfile(page, 'u.wordsleftunsaid');
    await page.waitForTimeout(3000);

    // Dismiss cookie consent and other modals that block content
    await dismissModals(page);

    // Also try the explicit cookie banner buttons (TikTok shows a full-page overlay)
    const allowCookiesBtn = page.getByRole('button', { name: /allow all|accept all|allow cookies/i }).first();
    const declineCookiesBtn = page.getByRole('button', { name: /decline optional|reject/i }).first();
    for (const btn of [declineCookiesBtn, allowCookiesBtn]) {
      if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await btn.click();
        console.log('[verify-tk] Dismissed cookie consent');
        await page.waitForTimeout(2000);
        break;
      }
    }

    await page.waitForTimeout(3000);

    // Take screenshot of profile
    const screenshotPath = '/tmp/verify-tiktok-profile.png';
    await page.screenshot({ path: screenshotPath }).catch(() => {});

    // Read the body text to find video count
    // TikTok profiles show: "X Following  Y Followers  Z Likes" and video count near tabs
    const bodyText = await page.textContent('body').catch(() => '') ?? '';

    // Try to find "X Videos" text (TikTok shows this in the tabs area)
    const videoCountMatch = bodyText.match(/(\d[\d,]*)\s*Videos?/i);
    if (videoCountMatch) {
      const count = parseInt(videoCountMatch[1].replace(/,/g, ''), 10);
      console.log(`[verify-tk] Profile shows ${count} videos`);
      return { verified: true, platformCount: count, screenshotPath };
    }

    // Fallback: count video thumbnails on the profile
    const videoSelectors = [
      '[data-e2e="user-post-item"]',
      'div[class*="DivItemContainer"]',
      'div[class*="DivVideoFeed"] a',
      'a[href*="/video/"]',
      // TikTok also uses @username/video/ID pattern in links
      `a[href*="/@u.wordsleftunsaid/video/"]`,
    ];

    for (const selector of videoSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`[verify-tk] Found ${count} video elements (via ${selector})`);
        return { verified: true, platformCount: count, screenshotPath };
      }
    }

    // Check if profile loaded at all
    if (bodyText.includes('Followers') || bodyText.includes('Following')) {
      console.log('[verify-tk] Profile loaded but no videos found');
      return { verified: true, platformCount: 0, screenshotPath };
    }

    return {
      verified: false,
      platformCount: 0,
      error: 'Could not load TikTok profile or read video count',
      screenshotPath,
    };
  } finally {
    await context.close();
  }
}
