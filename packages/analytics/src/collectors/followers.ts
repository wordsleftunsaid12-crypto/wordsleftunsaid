import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { saveFollowerSnapshot, getFollowerHistory } from '@wlu/shared';
import type { Platform } from '@wlu/shared';

const IG_BROWSER_DATA_DIR = resolve(process.env.HOME ?? '.', '.wlu-instagram-session');
const TK_BROWSER_DATA_DIR = resolve(process.env.HOME ?? '.', '.wlu-tiktok-session');
const YT_BROWSER_DATA_DIR = resolve(process.env.HOME ?? '.', '.wlu-youtube-session');

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Record a follower count snapshot to the database.
 */
export async function recordFollowerSnapshot(
  platform: Platform,
  followerCount: number,
  followingCount: number,
): Promise<void> {
  await saveFollowerSnapshot({ platform, followerCount, followingCount });
  console.log(
    `[followers] ${platform}: ${followerCount} followers, ${followingCount} following`,
  );
}

// --- Instagram ---

/**
 * Scrape follower/following counts from Instagram profile.
 */
export async function scrapeInstagramFollowerCounts(
  username: string = 'u.wordsleftunsaid',
): Promise<{ followers: number; following: number }> {
  ensureDir(IG_BROWSER_DATA_DIR);

  const context = await chromium.launchPersistentContext(IG_BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] ?? (await context.newPage());

  try {
    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    const counts = await page.evaluate(() => {
      const headerText = document.querySelector('header')?.textContent ?? '';
      const followersMatch = headerText.match(/([\d,.]+[KMkm]?)\s*followers/i);
      const followingMatch = headerText.match(/([\d,.]+[KMkm]?)\s*following/i);

      function parseCount(str: string | undefined): number {
        if (!str) return 0;
        const cleaned = str.replace(/,/g, '');
        const multipliers: Record<string, number> = {
          k: 1000, K: 1000, m: 1000000, M: 1000000,
        };
        const lastChar = cleaned[cleaned.length - 1];
        if (multipliers[lastChar]) {
          return Math.round(parseFloat(cleaned.slice(0, -1)) * multipliers[lastChar]);
        }
        return parseInt(cleaned, 10) || 0;
      }

      return {
        followers: parseCount(followersMatch?.[1]),
        following: parseCount(followingMatch?.[1]),
      };
    });

    console.log(`[followers] @${username}: ${counts.followers} followers, ${counts.following} following`);
    return counts;
  } finally {
    await context.close();
  }
}

// --- TikTok ---

/**
 * Scrape follower/following counts from TikTok profile.
 */
export async function scrapeTikTokFollowerCounts(
  username: string = 'u.wordsleftunsaid',
): Promise<{ followers: number; following: number }> {
  ensureDir(TK_BROWSER_DATA_DIR);

  const context = await chromium.launchPersistentContext(TK_BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] ?? (await context.newPage());

  try {
    await page.goto(`https://www.tiktok.com/@${username}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(5000);

    // Dismiss cookie banner if present
    const cookieBtn = page.locator('button').filter({ hasText: /accept all|decline all/i }).first();
    if (await cookieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cookieBtn.click();
      await page.waitForTimeout(1000);
    }

    // TikTok uses data-e2e attributes for profile stats
    let followers = 0;
    let following = 0;

    const followersEl = page.locator('[data-e2e="followers-count"]').first();
    if (await followersEl.isVisible({ timeout: 5000 }).catch(() => false)) {
      const text = await followersEl.innerText().catch(() => '0');
      followers = parseAbbreviatedCount(text);
    }

    const followingEl = page.locator('[data-e2e="following-count"]').first();
    if (await followingEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await followingEl.innerText().catch(() => '0');
      following = parseAbbreviatedCount(text);
    }

    console.log(`[followers] TikTok @${username}: ${followers} followers, ${following} following`);
    return { followers, following };
  } finally {
    await context.close();
  }
}

// --- YouTube ---

/**
 * Scrape subscriber count from YouTube Studio dashboard.
 */
export async function scrapeYouTubeSubscriberCount(): Promise<{ followers: number; following: number }> {
  ensureDir(YT_BROWSER_DATA_DIR);

  const context = await chromium.launchPersistentContext(YT_BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] ?? (await context.newPage());

  try {
    await page.goto('https://studio.youtube.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(5000);

    // YouTube Studio dashboard shows "Current subscribers" with a count
    let subscribers = 0;

    // Try to extract from the dashboard analytics card
    const subText = page.locator('text=/Current subscribers/i').first();
    if (await subText.isVisible({ timeout: 5000 }).catch(() => false)) {
      // The subscriber count is typically in a nearby element
      const parentText = await subText.evaluate((el) => {
        // Walk up to find the container with the actual count
        let parent = el.parentElement;
        for (let i = 0; i < 5 && parent; i++) {
          const text = parent.textContent ?? '';
          const match = text.match(/Current subscribers\s*([\d,.]+[KMkm]?)/i);
          if (match) return match[1];
          parent = parent.parentElement;
        }
        return '';
      }).catch(() => '');

      if (parentText) {
        subscribers = parseAbbreviatedCount(parentText);
      }
    }

    // Fallback: try to find any standalone number near "subscribers"
    if (subscribers === 0) {
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const match = bodyText.match(/Current subscribers\s*([\d,.]+[KMkm]?)/i);
      if (match) {
        subscribers = parseAbbreviatedCount(match[1]);
      }
    }

    console.log(`[followers] YouTube: ${subscribers} subscribers`);
    return { followers: subscribers, following: 0 };
  } finally {
    await context.close();
  }
}

// --- Multi-platform ---

/**
 * Collect follower snapshots for all 3 platforms.
 * Runs sequentially (each needs its own browser context).
 */
export async function collectAllFollowerSnapshots(): Promise<void> {
  console.log('[followers] Collecting snapshots for all platforms...');

  // Instagram
  try {
    const ig = await scrapeInstagramFollowerCounts();
    await recordFollowerSnapshot('instagram', ig.followers, ig.following);
  } catch (err) {
    console.warn('[followers] Instagram scrape failed:', err instanceof Error ? err.message : err);
  }

  // TikTok
  try {
    const tk = await scrapeTikTokFollowerCounts();
    await recordFollowerSnapshot('tiktok', tk.followers, tk.following);
  } catch (err) {
    console.warn('[followers] TikTok scrape failed:', err instanceof Error ? err.message : err);
  }

  // YouTube
  try {
    const yt = await scrapeYouTubeSubscriberCount();
    await recordFollowerSnapshot('youtube', yt.followers, yt.following);
  } catch (err) {
    console.warn('[followers] YouTube scrape failed:', err instanceof Error ? err.message : err);
  }

  console.log('[followers] All snapshots collected.');
}

/**
 * Legacy alias — scrape Instagram (backward compat).
 */
export const scrapeFollowerCounts = scrapeInstagramFollowerCounts;

/**
 * Legacy alias — collect single platform snapshot.
 */
export async function collectFollowerSnapshot(
  platform: Platform = 'instagram',
  username: string = 'u.wordsleftunsaid',
): Promise<void> {
  if (platform === 'tiktok') {
    const counts = await scrapeTikTokFollowerCounts(username);
    await recordFollowerSnapshot('tiktok', counts.followers, counts.following);
  } else if (platform === 'youtube') {
    const counts = await scrapeYouTubeSubscriberCount();
    await recordFollowerSnapshot('youtube', counts.followers, counts.following);
  } else {
    const counts = await scrapeInstagramFollowerCounts(username);
    await recordFollowerSnapshot('instagram', counts.followers, counts.following);
  }
}

/**
 * Calculate follower growth over a time period.
 */
export async function getFollowerGrowth(
  platform: Platform,
  daysBack: number = 30,
): Promise<{
  startCount: number;
  endCount: number;
  netGrowth: number;
  growthRate: number;
  avgDailyGrowth: number;
}> {
  const history = await getFollowerHistory(platform, daysBack);

  if (history.length < 2) {
    return {
      startCount: history[0]?.followerCount ?? 0,
      endCount: history[0]?.followerCount ?? 0,
      netGrowth: 0,
      growthRate: 0,
      avgDailyGrowth: 0,
    };
  }

  const start = history[0];
  const end = history[history.length - 1];
  const netGrowth = end.followerCount - start.followerCount;
  const growthRate = start.followerCount > 0 ? netGrowth / start.followerCount : 0;

  const daysBetween = Math.max(
    1,
    (new Date(end.measuredAt).getTime() - new Date(start.measuredAt).getTime()) / 86400000,
  );

  return {
    startCount: start.followerCount,
    endCount: end.followerCount,
    netGrowth,
    growthRate,
    avgDailyGrowth: netGrowth / daysBetween,
  };
}

// --- Utility ---

/**
 * Parse abbreviated count strings (e.g., "2.5K" → 2500, "1.2M" → 1200000).
 */
function parseAbbreviatedCount(text: string): number {
  const cleaned = text.trim().replace(/,/g, '');
  const multipliers: Record<string, number> = {
    k: 1000, K: 1000, m: 1000000, M: 1000000,
  };
  const lastChar = cleaned[cleaned.length - 1];
  if (multipliers[lastChar]) {
    return Math.round(parseFloat(cleaned.slice(0, -1)) * multipliers[lastChar]);
  }
  return parseInt(cleaned, 10) || 0;
}
