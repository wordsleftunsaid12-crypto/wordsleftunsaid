/**
 * Follower count scrapers for all 3 platforms.
 * Each platform needs its own browser context (can't run in parallel).
 */
import type { Page } from 'playwright';
import { saveFollowerSnapshot } from '@wlu/shared';
import type { Platform } from '@wlu/shared';
import { launchInstagram, navigateToProfile as navigateToIgProfile } from '../platforms/instagram/browser.js';
import { launchTikTok, navigateToProfile as navigateToTkProfile } from '../platforms/tiktok/browser.js';
import { launchYouTube } from '../platforms/youtube/browser.js';

interface FollowerCounts {
  followers: number;
  following: number;
}

/**
 * Parse abbreviated count strings like "1.2K", "3.5M", "842".
 */
function parseAbbreviatedCount(text: string): number {
  const cleaned = text.trim().replace(/,/g, '');
  const match = cleaned.match(/^([\d.]+)\s*([KMB])?$/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const suffix = (match[2] ?? '').toUpperCase();
  const multipliers: Record<string, number> = { K: 1000, M: 1000000, B: 1000000000 };
  return Math.round(num * (multipliers[suffix] ?? 1));
}

// --- Instagram ---

export async function scrapeInstagramFollowerCounts(
  username = 'u.wordsleftunsaid',
): Promise<FollowerCounts> {
  const { context, page } = await launchInstagram();
  try {
    await navigateToIgProfile(page, username);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/followers-instagram-debug.png' }).catch(() => {});
    return await extractInstagramCounts(page);
  } finally {
    await context.close();
  }
}

async function extractInstagramCounts(page: Page): Promise<FollowerCounts> {
  let followers = 0;
  let following = 0;

  // Strategy 1: header section ul li
  const stats = page.locator('header section ul li');
  const count = await stats.count();

  for (let i = 0; i < count; i++) {
    const text = await stats.nth(i).innerText().catch(() => '');
    const lower = text.toLowerCase();
    if (lower.includes('follower')) {
      const numText = text.split(/\s/)[0];
      followers = parseAbbreviatedCount(numText);
    } else if (lower.includes('following')) {
      const numText = text.split(/\s/)[0];
      following = parseAbbreviatedCount(numText);
    }
  }

  // Strategy 2: extract from meta description tag
  if (followers === 0) {
    const counts = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="description"]');
      const desc = meta?.getAttribute('content') ?? '';
      const followerMatch = desc.match(/([\d,.]+[KMB]?)\s*Follower/i);
      const followingMatch = desc.match(/([\d,.]+[KMB]?)\s*Following/i);
      return {
        followerText: followerMatch?.[1] ?? '',
        followingText: followingMatch?.[1] ?? '',
      };
    }).catch(() => ({ followerText: '', followingText: '' }));

    if (counts.followerText) followers = parseAbbreviatedCount(counts.followerText);
    if (counts.followingText) following = parseAbbreviatedCount(counts.followingText);
  }

  // Strategy 3: broad text search on header element
  if (followers === 0) {
    const bodyText = await page.locator('header').innerText().catch(() => '');
    const fMatch = bodyText.match(/([\d,.]+[KMB]?)\s*followers/i);
    const gMatch = bodyText.match(/([\d,.]+[KMB]?)\s*following/i);
    if (fMatch) followers = parseAbbreviatedCount(fMatch[1]);
    if (gMatch) following = parseAbbreviatedCount(gMatch[1]);
  }

  console.log(`[followers] Instagram: ${followers} followers, ${following} following`);
  return { followers, following };
}

// --- TikTok ---

export async function scrapeTikTokFollowerCounts(
  username = 'wordsleftunsaid.com',
): Promise<FollowerCounts> {
  const { context, page } = await launchTikTok();
  try {
    await navigateToTkProfile(page, username);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/followers-tiktok-debug.png' }).catch(() => {});
    return await extractTikTokCounts(page);
  } finally {
    await context.close();
  }
}

async function extractTikTokCounts(page: Page): Promise<FollowerCounts> {
  // TikTok profile uses data-e2e attributes for counts
  let followers = 0;
  let following = 0;

  const followerEl = page.locator('[data-e2e="followers-count"]').first();
  if (await followerEl.isVisible({ timeout: 5000 }).catch(() => false)) {
    const text = await followerEl.innerText().catch(() => '0');
    followers = parseAbbreviatedCount(text);
  }

  const followingEl = page.locator('[data-e2e="following-count"]').first();
  if (await followingEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    const text = await followingEl.innerText().catch(() => '0');
    following = parseAbbreviatedCount(text);
  }

  console.log(`[followers] TikTok: ${followers} followers, ${following} following`);
  return { followers, following };
}

// --- YouTube ---

export async function scrapeYouTubeSubscriberCount(
  channelHandle = '@WordsLeftUnsaid-v4g',
): Promise<FollowerCounts> {
  const { context, page } = await launchYouTube();
  try {
    // Navigate to the public channel page instead of Studio dashboard
    // Studio metrics show views/engagement which get misread as subscribers
    const channelUrl = `https://www.youtube.com/${channelHandle}`;
    console.log(`[followers] Navigating to ${channelUrl}`);
    await page.goto(channelUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/followers-youtube-debug.png' }).catch(() => {});
    return await extractYouTubeCounts(page);
  } finally {
    await context.close();
  }
}

async function extractYouTubeCounts(page: Page): Promise<FollowerCounts> {
  let followers = 0;

  // The public channel page shows "X subscribers" near the channel name
  const subText = await page.evaluate(() => {
    // Look for subscriber count element
    const els = document.querySelectorAll('#subscriber-count, [id*="subscriber"], yt-formatted-string');
    for (const el of els) {
      const text = el.textContent ?? '';
      if (text.toLowerCase().includes('subscriber')) {
        return text;
      }
    }
    // Broader fallback: search page text
    const allText = document.body.innerText;
    const match = allText.match(/([\d,.]+[KMB]?)\s*subscriber/i);
    return match ? match[0] : '';
  }).catch(() => '');

  if (subText) {
    const match = subText.match(/([\d,.]+[KMB]?)\s*subscriber/i);
    if (match) {
      followers = parseAbbreviatedCount(match[1]);
    }
  }

  console.log(`[followers] YouTube: ${followers} subscribers`);
  return { followers, following: 0 };
}

// --- Multi-platform collection ---

interface CollectionResult {
  succeeded: Platform[];
  failed: Platform[];
}

/**
 * Collect follower snapshots from all 3 platforms sequentially.
 * Each platform runs in its own browser context.
 * Errors on one platform don't block the others.
 */
export async function collectAllFollowerSnapshots(): Promise<CollectionResult> {
  const result: CollectionResult = { succeeded: [], failed: [] };

  const scrapers: { platform: Platform; fn: () => Promise<FollowerCounts> }[] = [
    { platform: 'instagram', fn: scrapeInstagramFollowerCounts },
    { platform: 'tiktok', fn: scrapeTikTokFollowerCounts },
    { platform: 'youtube', fn: scrapeYouTubeSubscriberCount },
  ];

  for (const { platform, fn } of scrapers) {
    try {
      console.log(`[followers] Scraping ${platform}...`);
      const counts = await fn();
      await saveFollowerSnapshot({
        platform,
        followerCount: counts.followers,
        followingCount: counts.following,
      });
      result.succeeded.push(platform);
      console.log(`[followers] Saved ${platform} snapshot`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[followers] Failed to scrape ${platform}: ${msg.slice(0, 100)}`);
      result.failed.push(platform);
    }
  }

  console.log(
    `[followers] Done — succeeded: [${result.succeeded.join(', ')}], failed: [${result.failed.join(', ')}]`,
  );

  return result;
}
