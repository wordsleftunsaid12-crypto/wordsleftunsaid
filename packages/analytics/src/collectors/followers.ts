import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { saveFollowerSnapshot, getFollowerHistory } from '@wlu/shared';
import type { Platform } from '@wlu/shared';

const BROWSER_DATA_DIR = resolve(
  process.env.HOME ?? '.',
  '.wlu-instagram-session',
);

/**
 * Record a daily follower count snapshot.
 * Should be called once per day by the scheduler.
 */
export async function recordFollowerSnapshot(
  platform: Platform,
  followerCount: number,
  followingCount: number,
): Promise<void> {
  await saveFollowerSnapshot({ platform, followerCount, followingCount });
  console.log(
    `[followers] Snapshot: ${followerCount} followers, ${followingCount} following`,
  );
}

/**
 * Scrape follower/following counts from Instagram profile via Playwright.
 */
export async function scrapeFollowerCounts(
  username: string = 'u.wordsleftunsaid',
): Promise<{ followers: number; following: number }> {
  if (!existsSync(BROWSER_DATA_DIR)) {
    mkdirSync(BROWSER_DATA_DIR, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
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
          k: 1000,
          K: 1000,
          m: 1000000,
          M: 1000000,
        };
        const lastChar = cleaned[cleaned.length - 1];
        if (multipliers[lastChar]) {
          return Math.round(
            parseFloat(cleaned.slice(0, -1)) * multipliers[lastChar],
          );
        }
        return parseInt(cleaned, 10) || 0;
      }

      return {
        followers: parseCount(followersMatch?.[1]),
        following: parseCount(followingMatch?.[1]),
      };
    });

    console.log(
      `[followers] @${username}: ${counts.followers} followers, ${counts.following} following`,
    );

    return counts;
  } finally {
    await context.close();
  }
}

/**
 * Scrape and save a follower snapshot in one step.
 */
export async function collectFollowerSnapshot(
  platform: Platform = 'instagram',
  username: string = 'u.wordsleftunsaid',
): Promise<void> {
  const counts = await scrapeFollowerCounts(username);
  await recordFollowerSnapshot(platform, counts.followers, counts.following);
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
  const growthRate =
    start.followerCount > 0 ? netGrowth / start.followerCount : 0;

  const daysBetween = Math.max(
    1,
    (new Date(end.measuredAt).getTime() -
      new Date(start.measuredAt).getTime()) /
      86400000,
  );

  return {
    startCount: start.followerCount,
    endCount: end.followerCount,
    netGrowth,
    growthRate,
    avgDailyGrowth: netGrowth / daysBetween,
  };
}
