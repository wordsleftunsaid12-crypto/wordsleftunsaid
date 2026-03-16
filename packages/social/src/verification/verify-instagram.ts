import type { Post } from '@wlu/shared';
import { launchInstagram, navigateToProfile } from '../platforms/instagram/browser.js';

interface VerificationResult {
  verified: boolean;
  platformCount: number;
  postUrl?: string;
  error?: string;
  screenshotPath?: string;
}

/**
 * Verify Instagram posts by counting videos/reels on the profile.
 * Navigates to our profile, reads the post count from the stats header,
 * and takes a screenshot as evidence.
 */
export async function verifyInstagramPost(post: Post): Promise<VerificationResult> {
  const { context, page } = await launchInstagram();

  try {
    await navigateToProfile(page, 'u.wordsleftunsent');
    await page.waitForTimeout(5000);

    // Take screenshot of profile
    const screenshotPath = '/tmp/verify-instagram-profile.png';
    await page.screenshot({ path: screenshotPath }).catch(() => {});

    // Read post count from profile header stats
    // Instagram shows "X posts" in the header — the number is in a span near the text "posts"
    const profileText = await page.textContent('header').catch(() => '') ?? '';

    // Try to parse "X posts" from the header text
    const postCountMatch = profileText.match(/(\d[\d,]*)\s*posts?/i);
    if (postCountMatch) {
      const count = parseInt(postCountMatch[1].replace(/,/g, ''), 10);
      console.log(`[verify-ig] Profile shows ${count} posts`);
      return { verified: true, platformCount: count, screenshotPath };
    }

    // Fallback: try to find post count using the stats area (span/a elements)
    // Instagram renders stats as: posts / followers / following
    const statLinks = page.locator('header li, header a[href*="/"]');
    const statCount = await statLinks.count();
    for (let i = 0; i < Math.min(statCount, 5); i++) {
      const text = await statLinks.nth(i).textContent().catch(() => '') ?? '';
      const match = text.match(/(\d[\d,]*)\s*posts?/i);
      if (match) {
        const count = parseInt(match[1].replace(/,/g, ''), 10);
        console.log(`[verify-ig] Profile shows ${count} posts (from stats)`);
        return { verified: true, platformCount: count, screenshotPath };
      }
    }

    // Last fallback: count actual post thumbnails in the grid
    const postLinks = page.locator('a[href*="/p/"], a[href*="/reel/"]');
    const gridCount = await postLinks.count();
    if (gridCount > 0) {
      console.log(`[verify-ig] Found ${gridCount} post links in grid (stats not parseable)`);
      return { verified: true, platformCount: gridCount, screenshotPath };
    }

    return {
      verified: false,
      platformCount: 0,
      error: 'Could not read post count from Instagram profile',
      screenshotPath,
    };
  } finally {
    await context.close();
  }
}
