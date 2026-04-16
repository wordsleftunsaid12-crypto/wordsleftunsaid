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
 * Counts visible video thumbnail elements on the profile grid.
 */
export async function verifyTikTokPost(post: Post): Promise<VerificationResult> {
  const { context, page } = await launchTikTok();

  try {
    await navigateToProfile(page, 'u.wordsleftunsaid');
    await page.waitForTimeout(3000);

    // Dismiss cookie consent and other modals that block content
    await dismissModals(page);
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

    const screenshotPath = '/tmp/verify-tiktok-profile.png';
    await page.screenshot({ path: screenshotPath }).catch(() => {});

    // Detect CAPTCHA
    const bodyText = await page.textContent('body').catch(() => '') ?? '';
    if (bodyText.includes('Drag the slider') || bodyText.includes('fit the puzzle') || bodyText.includes('Verify to continue')) {
      console.warn('[verify-tk] CAPTCHA detected — cannot verify, skipping');
      return { verified: false, platformCount: -1, error: 'CAPTCHA blocked profile access', screenshotPath };
    }

    // Count video elements directly — prioritize this over regex.
    // Scroll to load all videos (TikTok lazy-loads the grid).
    let totalCount = 0;
    let prevCount = -1;
    const maxScrolls = 15;

    for (let scroll = 0; scroll <= maxScrolls; scroll++) {
      // Try multiple selectors — TikTok obfuscates class names
      const selectors = [
        '[data-e2e="user-post-item"]',
        `a[href*="/video/"]`,
      ];

      let bestCount = 0;
      for (const selector of selectors) {
        const count = await page.locator(selector).count();
        if (count > bestCount) bestCount = count;
      }
      totalCount = bestCount;

      if (totalCount === prevCount || totalCount === 0) break;
      prevCount = totalCount;

      if (scroll < maxScrolls) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
      }
    }

    if (totalCount > 0) {
      console.log(`[verify-tk] Profile shows ${totalCount} videos`);
      return { verified: true, platformCount: totalCount, screenshotPath };
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
