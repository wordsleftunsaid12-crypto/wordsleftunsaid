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
 * Navigates to Studio's Shorts tab and counts ytcp-video-row elements,
 * scrolling to load all rows (Studio virtualizes long lists).
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

    const screenshotPath = '/tmp/verify-youtube-studio.png';
    await page.screenshot({ path: screenshotPath }).catch(() => {});

    // Count ytcp-video-row elements — these are the ONLY reliable indicator
    // of actual video entries in Studio's content table.
    // Studio virtualizes the list, so we need to scroll to load all rows.
    let rowCount = 0;
    let prevCount = -1;
    const maxScrolls = 20; // Safety limit — even with 100+ videos this is enough

    for (let scroll = 0; scroll <= maxScrolls; scroll++) {
      const rows = page.locator('ytcp-video-row');
      rowCount = await rows.count();

      if (rowCount === prevCount) {
        // No new rows loaded — we've reached the end
        break;
      }
      prevCount = rowCount;

      if (scroll < maxScrolls) {
        // Scroll down to trigger lazy loading
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1500);
      }
    }

    if (rowCount > 0) {
      console.log(`[verify-yt] Studio shows ${rowCount} shorts`);
      return { verified: true, platformCount: rowCount, screenshotPath };
    }

    // Check if Studio loaded at all
    const bodyText = await page.textContent('body').catch(() => '') ?? '';
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
