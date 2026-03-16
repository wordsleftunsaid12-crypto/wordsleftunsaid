import type { Post } from '@wlu/shared';
import { launchYouTube } from '../platforms/youtube/browser.js';

interface VerificationResult {
  verified: boolean;
  platformCount: number;
  postUrl?: string;
  error?: string;
  screenshotPath?: string;
}

/**
 * Verify YouTube Shorts by counting them in YouTube Studio.
 * Navigates to Studio's Shorts tab and counts video entries.
 */
export async function verifyYouTubePost(post: Post): Promise<VerificationResult> {
  const { context, page } = await launchYouTube();

  try {
    // Navigate to YouTube Studio's Shorts content tab
    await page.goto('https://studio.youtube.com/channel/UC/videos/short', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(5000);

    // Take screenshot of Studio shorts list
    const screenshotPath = '/tmp/verify-youtube-studio.png';
    await page.screenshot({ path: screenshotPath }).catch(() => {});

    // Count video rows in the content table
    // YouTube Studio shows a table with one row per video
    const videoRows = page.locator('ytcp-video-row, tr.video-row, [class*="video-row"]');
    let rowCount = await videoRows.count();

    if (rowCount > 0) {
      console.log(`[verify-yt] Studio shows ${rowCount} shorts`);
      return { verified: true, platformCount: rowCount, screenshotPath };
    }

    // Fallback: count by looking at thumbnail links in the content list
    const videoLinks = page.locator('a[href*="/video/"], a[href*="/shorts/"]');
    rowCount = await videoLinks.count();
    // Deduplicate — each video might have multiple links (title + thumbnail)
    if (rowCount > 0) {
      // Rough dedup: each video typically has 2 links (thumbnail + title)
      const hrefs = new Set<string>();
      for (let i = 0; i < rowCount; i++) {
        const href = await videoLinks.nth(i).getAttribute('href').catch(() => null);
        if (href) hrefs.add(href);
      }
      const uniqueCount = hrefs.size;
      console.log(`[verify-yt] Studio shows ${uniqueCount} unique video links`);
      return { verified: true, platformCount: uniqueCount, screenshotPath };
    }

    // Try reading the page text for a count indicator
    const bodyText = await page.textContent('body').catch(() => '') ?? '';
    // YouTube Studio sometimes shows "Shorts (N)" in the tab
    const shortsMatch = bodyText.match(/Shorts?\s*\(?(\d+)\)?/i);
    if (shortsMatch) {
      const count = parseInt(shortsMatch[1], 10);
      console.log(`[verify-yt] Studio tab shows ${count} shorts`);
      return { verified: true, platformCount: count, screenshotPath };
    }

    // Check if Studio loaded
    if (bodyText.includes('Channel content') || bodyText.includes('Shorts')) {
      console.log('[verify-yt] Studio loaded but no shorts found');
      return { verified: true, platformCount: 0, screenshotPath };
    }

    return {
      verified: false,
      platformCount: 0,
      error: 'Could not load YouTube Studio or read shorts count',
      screenshotPath,
    };
  } finally {
    await context.close();
  }
}
