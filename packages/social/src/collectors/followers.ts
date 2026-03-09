/**
 * Follower count scrapers for all platforms.
 * Each platform needs its own browser context (runs sequentially).
 */
import type { Page } from 'playwright';
import { saveFollowerSnapshot } from '@wlu/shared';
import type { Platform } from '@wlu/shared';
import { launchInstagram, navigateToProfile as navigateToIgProfile } from '../platforms/instagram/browser.js';
import { launchTikTok, navigateToProfile as navigateToTkProfile } from '../platforms/tiktok/browser.js';
import { launchYouTube } from '../platforms/youtube/browser.js';
import { launchTwitter } from '../platforms/twitter/browser.js';
import { launchReddit } from '../platforms/reddit/browser.js';
import { launchThreads } from '../platforms/threads/browser.js';
import { launchPinterest } from '../platforms/pinterest/browser.js';

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
  username = 'u.wordsleftunsent',
): Promise<FollowerCounts> {
  const { context, page } = await launchInstagram();
  try {
    await navigateToIgProfile(page, username);
    await page.waitForTimeout(2000);
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
  username = 'u.wordsleftunsaid',
): Promise<FollowerCounts> {
  const { context, page } = await launchTikTok();
  try {
    await navigateToTkProfile(page, username);
    await page.waitForTimeout(2000);
    return await extractTikTokCounts(page);
  } finally {
    await context.close();
  }
}

async function extractTikTokCounts(page: Page): Promise<FollowerCounts> {
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
  channelHandle = '@WordsLeftUnsent',
): Promise<FollowerCounts> {
  const { context, page } = await launchYouTube();
  try {
    const channelUrl = `https://www.youtube.com/${channelHandle}`;
    console.log(`[followers] Navigating to ${channelUrl}`);
    await page.goto(channelUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    return await extractYouTubeCounts(page);
  } finally {
    await context.close();
  }
}

async function extractYouTubeCounts(page: Page): Promise<FollowerCounts> {
  let followers = 0;

  // Strategy 1: metadata span with "subscribers" text
  const subText = await page.evaluate(() => {
    const spans = document.querySelectorAll(
      'span.yt-content-metadata-view-model__metadata-text, #subscriber-count, yt-formatted-string#subscriber-count',
    );
    for (const el of spans) {
      const text = el.textContent?.trim() ?? '';
      if (text.toLowerCase().includes('subscriber')) return text;
    }
    return '';
  }).catch(() => '');

  if (subText) {
    const match = subText.match(/([\d,.]+[KMB]?)\s*subscriber/i);
    if (match) {
      followers = parseAbbreviatedCount(match[1]);
    }
  }

  // Strategy 2: meta description tag
  if (followers === 0) {
    const metaText = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="description"]');
      return meta?.getAttribute('content') ?? '';
    }).catch(() => '');
    const match = metaText.match(/([\d,.]+[KMB]?)\s*subscriber/i);
    if (match) {
      followers = parseAbbreviatedCount(match[1]);
    }
  }

  // Strategy 3: search page body text (last resort)
  if (followers === 0) {
    const bodyText = await page.locator('main').first().innerText().catch(() => '');
    const match = bodyText.match(/([\d,.]+[KMB]?)\s*subscriber/i);
    if (match) {
      followers = parseAbbreviatedCount(match[1]);
    }
  }

  console.log(`[followers] YouTube: ${followers} subscribers`);
  return { followers, following: 0 };
}

// --- Twitter/X ---

export async function scrapeTwitterFollowerCounts(
  username = 'unsentwords12',
): Promise<FollowerCounts> {
  const { context, page } = await launchTwitter();
  try {
    await page.goto(`https://x.com/${username}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);
    return await extractTwitterCounts(page);
  } finally {
    await context.close();
  }
}

async function extractTwitterCounts(page: Page): Promise<FollowerCounts> {
  let followers = 0;
  let following = 0;

  // X profile shows "N Followers" and "N Following" as links
  const followerLink = page.locator('a[href$="/verified_followers"]').first();
  if (await followerLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    const text = await followerLink.innerText().catch(() => '');
    const match = text.match(/([\d,.]+[KMB]?)/i);
    if (match) followers = parseAbbreviatedCount(match[1]);
  }

  const followingLink = page.locator('a[href$="/following"]').first();
  if (await followingLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    const text = await followingLink.innerText().catch(() => '');
    const match = text.match(/([\d,.]+[KMB]?)/i);
    if (match) following = parseAbbreviatedCount(match[1]);
  }

  // Fallback: parse from page body text
  if (followers === 0) {
    const bodyText = await page.locator('main').first().innerText().catch(() => '');
    const fMatch = bodyText.match(/([\d,.]+[KMB]?)\s*Followers/);
    const gMatch = bodyText.match(/([\d,.]+[KMB]?)\s*Following/);
    if (fMatch) followers = parseAbbreviatedCount(fMatch[1]);
    if (gMatch) following = parseAbbreviatedCount(gMatch[1]);
  }

  console.log(`[followers] Twitter: ${followers} followers, ${following} following`);
  return { followers, following };
}

// --- Reddit ---

export async function scrapeRedditFollowerCounts(
  username = 'Proud-Minute4849',
): Promise<FollowerCounts> {
  const { context, page } = await launchReddit();
  try {
    await page.goto(`https://www.reddit.com/user/${username}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);
    return await extractRedditCounts(page);
  } finally {
    await context.close();
  }
}

async function extractRedditCounts(page: Page): Promise<FollowerCounts> {
  let followers = 0;

  // Reddit profile shows karma and sometimes followers in the sidebar
  const bodyText = await page.locator('main, [id*="profile"], aside').allInnerTexts()
    .then(texts => texts.join(' '))
    .catch(() => '');
  const fMatch = bodyText.match(/([\d,.]+[KMB]?)\s*followers?/i);
  if (fMatch) followers = parseAbbreviatedCount(fMatch[1]);

  console.log(`[followers] Reddit: ${followers} followers`);
  return { followers, following: 0 };
}

// --- Threads ---

export async function scrapeThreadsFollowerCounts(
  username = 'u.wordsleftunsaid',
): Promise<FollowerCounts> {
  const { context, page } = await launchThreads();
  try {
    await page.goto(`https://www.threads.net/@${username}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);
    return await extractThreadsCounts(page);
  } finally {
    await context.close();
  }
}

async function extractThreadsCounts(page: Page): Promise<FollowerCounts> {
  let followers = 0;

  // Threads profile shows "N followers" as a link/text
  const bodyText = await page.locator('main, header').allInnerTexts()
    .then(texts => texts.join(' '))
    .catch(() => '');
  const fMatch = bodyText.match(/([\d,.]+[KMB]?)\s*followers?/i);
  if (fMatch) followers = parseAbbreviatedCount(fMatch[1]);

  console.log(`[followers] Threads: ${followers} followers`);
  return { followers, following: 0 };
}

// --- Pinterest ---

export async function scrapePinterestFollowerCounts(
  username = 'wordsleftunsent',
): Promise<FollowerCounts> {
  const { context, page } = await launchPinterest();
  try {
    await page.goto(`https://www.pinterest.com/${username}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);
    return await extractPinterestCounts(page);
  } finally {
    await context.close();
  }
}

async function extractPinterestCounts(page: Page): Promise<FollowerCounts> {
  let followers = 0;
  let following = 0;

  // Pinterest profile shows "N followers" and "N following"
  const bodyText = await page.locator('main, header, [data-test-id="profile-header"]').allInnerTexts()
    .then(texts => texts.join(' '))
    .catch(() => '');
  const fMatch = bodyText.match(/([\d,.]+[KMB]?)\s*followers?/i);
  const gMatch = bodyText.match(/([\d,.]+[KMB]?)\s*following/i);
  if (fMatch) followers = parseAbbreviatedCount(fMatch[1]);
  if (gMatch) following = parseAbbreviatedCount(gMatch[1]);

  console.log(`[followers] Pinterest: ${followers} followers, ${following} following`);
  return { followers, following };
}

// --- Multi-platform collection ---

interface CollectionResult {
  succeeded: Platform[];
  failed: Platform[];
}

/**
 * Collect follower snapshots from all platforms sequentially.
 * Each platform runs in its own browser context.
 * Errors on one platform don't block the others.
 */
export async function collectAllFollowerSnapshots(): Promise<CollectionResult> {
  const result: CollectionResult = { succeeded: [], failed: [] };

  const scrapers: { platform: Platform; fn: () => Promise<FollowerCounts> }[] = [
    { platform: 'instagram', fn: scrapeInstagramFollowerCounts },
    { platform: 'tiktok', fn: scrapeTikTokFollowerCounts },
    { platform: 'youtube', fn: scrapeYouTubeSubscriberCount },
    { platform: 'twitter', fn: scrapeTwitterFollowerCounts },
    { platform: 'reddit', fn: scrapeRedditFollowerCounts },
    { platform: 'threads', fn: scrapeThreadsFollowerCounts },
    { platform: 'pinterest', fn: scrapePinterestFollowerCounts },
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
