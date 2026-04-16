/**
 * Engagement metrics scrapers for all platforms.
 * Visits individual post URLs and scrapes visible metrics (views, likes, comments, shares).
 * Includes URL discovery: visits profiles to find post URLs for DB records missing them.
 * Mirrors the followers.ts pattern: one scraper per platform + orchestrator.
 */
import type { Page, BrowserContext } from 'playwright';
import type { Platform, Post } from '@wlu/shared';
import {
  getPostsNeedingMetrics,
  saveEngagementMetrics,
  updatePostUrl,
} from '@wlu/shared';
import { withBrowserLock } from '../platforms/browser-lock.js';
import { launchInstagram, BROWSER_DATA_DIR } from '../platforms/instagram/browser.js';
import { launchTikTok, TIKTOK_BROWSER_DATA_DIR } from '../platforms/tiktok/browser.js';
import { launchYouTube, YOUTUBE_BROWSER_DATA_DIR } from '../platforms/youtube/browser.js';
import { launchReddit, REDDIT_BROWSER_DATA_DIR } from '../platforms/reddit/browser.js';
import { launchTwitter, TWITTER_BROWSER_DATA_DIR } from '../platforms/twitter/browser.js';
import { launchPinterest, PINTEREST_BROWSER_DATA_DIR } from '../platforms/pinterest/browser.js';
import { CaptchaDetectedError, detectCaptcha } from '../utils/captcha.js';

interface MetricsResult {
  likes: number;
  comments: number;
  shares: number;
  views: number;
  saves: number;
}

interface CollectionResult {
  total: number;
  byPlatform: Record<string, number>;
  errors: string[];
  captchaOn?: string;
}

/**
 * Parse abbreviated count strings: "1.2K" → 1200, "3.5M" → 3500000, "842" → 842.
 */
function parseCount(text: string): number {
  const cleaned = text.trim().replace(/,/g, '');
  const match = cleaned.match(/^([\d.]+)\s*([KMB])?$/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const suffix = (match[2] ?? '').toUpperCase();
  const multipliers: Record<string, number> = { K: 1000, M: 1000000, B: 1000000000 };
  return Math.round(num * (multipliers[suffix] ?? 1));
}

/**
 * Extract a number from text that matches a pattern.
 * e.g., extractMetric("1,234 likes", /likes?/i) → 1234
 */
function extractMetric(text: string, label: RegExp): number {
  // Pattern: number (with optional K/M/B) followed by label
  const patterns = [
    new RegExp(`([\\d,.]+[KMB]?)\\s*${label.source}`, 'i'),
    new RegExp(`${label.source}\\s*([\\d,.]+[KMB]?)`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseCount(match[1]);
  }
  return 0;
}

// --- Per-Platform Scrapers ---

async function scrapeInstagramPost(page: Page): Promise<MetricsResult> {
  await page.waitForTimeout(3000);
  const metrics: MetricsResult = { likes: 0, comments: 0, shares: 0, views: 0, saves: 0 };

  // Instagram reels show views/plays prominently
  const bodyText = await page.locator('main').first().innerText({ timeout: 5000 }).catch(() => '');

  // Views/plays: "X plays" or "X views"
  metrics.views = extractMetric(bodyText, /(?:plays?|views?)/);

  // Likes: "X likes" — also try the specific section
  metrics.likes = extractMetric(bodyText, /likes?/);
  if (metrics.likes === 0) {
    const likesEl = page.locator('section span:has-text("like"), a:has-text("like")').first();
    const likesText = await likesEl.textContent({ timeout: 2000 }).catch(() => '') ?? '';
    const match = likesText.match(/([\d,]+)/);
    if (match) metrics.likes = parseInt(match[1].replace(/,/g, ''), 10);
  }

  // Comments: "X comments" or "View all X comments"
  metrics.comments = extractMetric(bodyText, /comments?/);

  return metrics;
}

async function scrapeTikTokPost(page: Page): Promise<MetricsResult> {
  await page.waitForTimeout(3000);
  const metrics: MetricsResult = { likes: 0, comments: 0, shares: 0, views: 0, saves: 0 };

  // TikTok shows all metrics on the video page
  // Try data-e2e attributes first (more stable)
  const likeCount = page.locator('[data-e2e="like-count"]').first();
  if (await likeCount.isVisible({ timeout: 3000 }).catch(() => false)) {
    metrics.likes = parseCount(await likeCount.innerText().catch(() => '0'));
  }

  const commentCount = page.locator('[data-e2e="comment-count"]').first();
  if (await commentCount.isVisible({ timeout: 2000 }).catch(() => false)) {
    metrics.comments = parseCount(await commentCount.innerText().catch(() => '0'));
  }

  const shareCount = page.locator('[data-e2e="share-count"]').first();
  if (await shareCount.isVisible({ timeout: 2000 }).catch(() => false)) {
    metrics.shares = parseCount(await shareCount.innerText().catch(() => '0'));
  }

  // Views: usually in the video overlay or near the video
  const bodyText = await page.locator('main, [data-e2e="browse-video"]').first()
    .innerText({ timeout: 3000 }).catch(() => '');
  metrics.views = extractMetric(bodyText, /(?:views?|plays?)/);

  // Fallback: saves/bookmarks
  const saveCount = page.locator('[data-e2e="undefined-count"], [data-e2e="save-count"]').first();
  if (await saveCount.isVisible({ timeout: 2000 }).catch(() => false)) {
    metrics.saves = parseCount(await saveCount.innerText().catch(() => '0'));
  }

  return metrics;
}

async function scrapeYouTubePost(page: Page): Promise<MetricsResult> {
  await page.waitForTimeout(3000);
  const metrics: MetricsResult = { likes: 0, comments: 0, shares: 0, views: 0, saves: 0 };

  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');

  // Views: "X views" prominently displayed
  metrics.views = extractMetric(bodyText, /views?/);

  // Likes: button or text near the like icon
  const likeBtn = page.locator('#like-button, [aria-label*="like" i]').first();
  const likeText = await likeBtn.innerText({ timeout: 3000 }).catch(() => '');
  if (likeText) {
    const match = likeText.match(/([\d,.]+[KMB]?)/i);
    if (match) metrics.likes = parseCount(match[1]);
  }

  // Comments: "X comments" or comment count near the section
  metrics.comments = extractMetric(bodyText, /comments?/);

  return metrics;
}

async function scrapeRedditPost(page: Page): Promise<MetricsResult> {
  await page.waitForTimeout(3000);
  const metrics: MetricsResult = { likes: 0, comments: 0, shares: 0, views: 0, saves: 0 };

  const bodyText = await page.locator('main, [data-testid="post-container"], shreddit-post').first()
    .innerText({ timeout: 5000 }).catch(() => '');

  // Reddit shows "score" (upvotes) and "N comments"
  // Score/upvotes
  const scoreEl = page.locator('[data-testid="score"], shreddit-post').first();
  const scoreText = await scoreEl.getAttribute('score').catch(() => null) ??
    await scoreEl.innerText().catch(() => '');
  const scoreMatch = scoreText.match(/([\d,.]+[KMB]?)\s*(?:points?|upvotes?|score)?/i);
  if (scoreMatch) metrics.likes = parseCount(scoreMatch[1]);

  // Fallback: extract from body text
  if (metrics.likes === 0) {
    metrics.likes = extractMetric(bodyText, /(?:points?|upvotes?)/);
  }

  // Comments
  metrics.comments = extractMetric(bodyText, /comments?/);

  return metrics;
}

async function scrapeTwitterPost(page: Page): Promise<MetricsResult> {
  await page.waitForTimeout(3000);
  const metrics: MetricsResult = { likes: 0, comments: 0, shares: 0, views: 0, saves: 0 };

  // Twitter/X shows views, likes, reposts, replies on the tweet detail page
  const bodyText = await page.locator('[data-testid="tweet"], article').first()
    .innerText({ timeout: 5000 }).catch(() => '');

  // Views: displayed prominently
  metrics.views = extractMetric(bodyText, /views?/);

  // Likes
  const likeEl = page.locator('[data-testid="like"] span, [data-testid="unlike"] span').first();
  const likeText = await likeEl.innerText({ timeout: 2000 }).catch(() => '');
  if (likeText) metrics.likes = parseCount(likeText);

  // Replies → comments
  const replyEl = page.locator('[data-testid="reply"] span').first();
  const replyText = await replyEl.innerText({ timeout: 2000 }).catch(() => '');
  if (replyText) metrics.comments = parseCount(replyText);

  // Reposts → shares
  const repostEl = page.locator('[data-testid="retweet"] span').first();
  const repostText = await repostEl.innerText({ timeout: 2000 }).catch(() => '');
  if (repostText) metrics.shares = parseCount(repostText);

  // Bookmarks → saves
  const bookmarkEl = page.locator('[data-testid="bookmark"] span').first();
  const bookmarkText = await bookmarkEl.innerText({ timeout: 2000 }).catch(() => '');
  if (bookmarkText) metrics.saves = parseCount(bookmarkText);

  return metrics;
}

async function scrapePinterestPost(page: Page): Promise<MetricsResult> {
  await page.waitForTimeout(3000);
  const metrics: MetricsResult = { likes: 0, comments: 0, shares: 0, views: 0, saves: 0 };

  // Pinterest pin pages show saves (repins), reactions, and comments.
  // The save count is often shown prominently near the save/pin button.
  // Comments are listed below the pin image.

  // Try specific Pinterest selectors first
  // Save count: shown near the red "Save" button, or in the pin stats area
  const saveEl = page.locator('[data-test-id="save-count"], [data-test-id="aggregated-save-count"]').first();
  const saveText = await saveEl.innerText({ timeout: 3000 }).catch(() => '');
  if (saveText) {
    const match = saveText.match(/([\d,.]+[KMB]?)/i);
    if (match) metrics.saves = parseCount(match[1]);
  }

  // Reactions (hearts): Pinterest shows reaction count near the reaction button
  const reactEl = page.locator('[data-test-id="reactions-count"], [data-test-id="react-count"]').first();
  const reactText = await reactEl.innerText({ timeout: 2000 }).catch(() => '');
  if (reactText) {
    const match = reactText.match(/([\d,.]+[KMB]?)/i);
    if (match) metrics.likes = parseCount(match[1]);
  }

  // Comments count: often "X comments" or a number near the comment section
  const commentHeader = page.locator('[data-test-id="comment-count"], [data-test-id="canonical-card-comments-header"]').first();
  const commentText = await commentHeader.innerText({ timeout: 2000 }).catch(() => '');
  if (commentText) {
    const match = commentText.match(/([\d,.]+[KMB]?)/i);
    if (match) metrics.comments = parseCount(match[1]);
  }

  // Fallback: scan the full page text for numbers near keywords
  if (metrics.saves === 0 && metrics.likes === 0 && metrics.comments === 0) {
    const bodyText = await page.locator('main, [data-test-id="pin-page"], [data-test-id="closeup-page"]').first()
      .innerText({ timeout: 5000 }).catch(() => '');
    metrics.saves = extractMetric(bodyText, /(?:saves?|repins?|saved)/);
    metrics.likes = extractMetric(bodyText, /(?:reactions?|likes?)/);
    metrics.comments = extractMetric(bodyText, /comments?/);

    // Pinterest also sometimes shows outbound clicks — use as views proxy
    if (metrics.views === 0) {
      metrics.views = extractMetric(bodyText, /(?:clicks?|impressions?)/);
    }
  }

  return metrics;
}

// --- URL Discovery: Profile Scanning ---

interface ProfileConfig {
  url: string;
  linkSelector: string;
  baseUrl: string;
}

const PROFILE_CONFIG: Partial<Record<Platform, ProfileConfig>> = {
  instagram: {
    url: 'https://www.instagram.com/u.wordsleftunsent/',
    linkSelector: 'a[href*="/p/"], a[href*="/reel/"]',
    baseUrl: 'https://www.instagram.com',
  },
  tiktok: {
    url: 'https://www.tiktok.com/@u.wordsleftunsaid',
    linkSelector: 'a[href*="/video/"]',
    baseUrl: 'https://www.tiktok.com',
  },
  youtube: {
    url: 'https://studio.youtube.com/channel/UC/videos/short',
    linkSelector: 'a[href*="/video/"]',
    baseUrl: 'https://studio.youtube.com',
  },
  reddit: {
    url: 'https://www.reddit.com/user/Proud-Minute4849/submitted/',
    linkSelector: 'a[href*="/comments/"]',
    baseUrl: 'https://www.reddit.com',
  },
  twitter: {
    url: 'https://x.com/unsentwords12',
    linkSelector: 'a[href*="/unsentwords12/status/"]',
    baseUrl: 'https://x.com',
  },
  pinterest: {
    url: 'https://www.pinterest.com/wordsleftunsent/',
    linkSelector: 'a[href*="/pin/"]',
    baseUrl: 'https://www.pinterest.com',
  },
};

/**
 * Convert platform-specific internal URLs to public-facing URLs.
 * YouTube Studio links `/video/ABC123/edit` → `https://youtube.com/shorts/ABC123`
 */
function toPublicUrl(url: string, platform: Platform): string {
  if (platform === 'youtube') {
    // Studio URL: https://studio.youtube.com/video/ABC123/edit or /video/ABC123
    const match = url.match(/\/video\/([A-Za-z0-9_-]+)/);
    if (match) {
      return `https://youtube.com/shorts/${match[1]}`;
    }
  }
  return url;
}

/**
 * Normalize a caption for fuzzy matching.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '') // Strip punctuation
    .trim();
}

/**
 * Find the DB post whose caption best matches the given text.
 * Returns the matched post or undefined.
 */
function findCaptionMatch(
  platformText: string,
  candidates: Post[],
): Post | undefined {
  const normalized = normalizeText(platformText);
  if (normalized.length < 10) return undefined;

  let bestMatch: Post | undefined;
  let bestScore = 0;

  for (const post of candidates) {
    if (!post.caption || post.platformPostUrl) continue; // Already matched or no caption

    const dbNormalized = normalizeText(post.caption);
    if (dbNormalized.length < 10) continue;

    // Check if the first 40 chars of one appear in the other
    const snippet = dbNormalized.slice(0, 40);
    if (normalized.includes(snippet) || dbNormalized.includes(normalized.slice(0, 40))) {
      // Score by overlap length
      const score = snippet.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = post;
      }
    }
  }

  return bestMatch;
}

/**
 * Extract visible text/caption from a post page.
 */
async function extractPostText(page: Page, platform: Platform): Promise<string> {
  await page.waitForTimeout(2000);

  // Use platform-specific selectors for caption text
  const selectors: Partial<Record<Platform, string[]>> = {
    instagram: ['h1', 'span[dir="auto"]', 'div[data-testid] span'],
    tiktok: ['[data-e2e="browse-video-desc"]', '[data-e2e="video-desc"]', 'h1'],
    youtube: ['#description-text', 'yt-attributed-string#description', 'h1'],
    reddit: ['[data-testid="post-title"]', 'h1', 'shreddit-post h1'],
    twitter: ['[data-testid="tweetText"]', 'article div[dir="auto"]'],
    pinterest: ['h1', '[data-test-id="pin-title"]', 'div[data-test-id="pin-description"]'],
  };

  for (const selector of selectors[platform] ?? []) {
    const el = page.locator(selector).first();
    const text = await el.innerText({ timeout: 3000 }).catch(() => '');
    if (text && text.length >= 10) return text;
  }

  // Fallback: grab from main/body
  return await page.locator('main').first().innerText({ timeout: 3000 }).catch(() => '');
}

/**
 * Discover post URLs by visiting the profile and matching posts.
 * Strategy: try caption-based matching first, then fall back to position-based matching.
 * Profile pages show posts newest-first, matching our DB order.
 * Updates DB records in-place (sets platformPostUrl).
 */
async function discoverPostUrls(
  page: Page,
  platform: Platform,
  posts: Post[],
): Promise<number> {
  const postsWithoutUrl = posts.filter(p => !p.platformPostUrl);
  if (postsWithoutUrl.length === 0) return 0;

  const profileConfig = PROFILE_CONFIG[platform];
  if (!profileConfig) return 0;

  console.log(`[collect-metrics] ${platform}: discovering URLs for ${postsWithoutUrl.length} post(s)...`);

  try {
    // Navigate to profile
    await page.goto(profileConfig.url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(5000);

    // Check for CAPTCHA
    if (await detectCaptcha(page, platform)) {
      console.warn(`[collect-metrics] ${platform}: CAPTCHA on profile — skipping URL discovery`);
      return 0;
    }

    // Extract post links from profile
    const linkElements = await page.locator(profileConfig.linkSelector).all();
    const urls: string[] = [];
    const seen = new Set<string>();

    for (const link of linkElements) {
      const href = await link.getAttribute('href').catch(() => null);
      if (!href) continue;

      const fullUrl = href.startsWith('http') ? href : `${profileConfig.baseUrl}${href}`;

      // Deduplicate (profiles sometimes have duplicate links)
      if (seen.has(fullUrl)) continue;
      seen.add(fullUrl);
      urls.push(fullUrl);

      if (urls.length >= postsWithoutUrl.length + 5) break; // Don't need more than this
    }

    console.log(`[collect-metrics] ${platform}: found ${urls.length} post links on profile`);

    if (urls.length === 0) return 0;

    // Phase A: Try caption-based matching (visit each post, extract text, match)
    let matched = 0;
    const unmatchedUrls: string[] = [];

    for (const url of urls) {
      if (postsWithoutUrl.every(p => p.platformPostUrl)) break;

      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });

        const text = await extractPostText(page, platform);
        if (!text || text.length < 10) {
          unmatchedUrls.push(url);
          continue;
        }

        const match = findCaptionMatch(text, postsWithoutUrl);
        if (match) {
          await updatePostUrl(match.id, url);
          match.platformPostUrl = url;
          matched++;
          console.log(`[collect-metrics] ${platform}: matched URL for post ${match.id.slice(0, 8)}`);
        } else {
          unmatchedUrls.push(url);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[collect-metrics] ${platform}: failed to check ${url.slice(0, 60)}: ${msg.slice(0, 80)}`);
        unmatchedUrls.push(url);
      }
    }

    // Phase B: Position-based fallback — ONLY when caption matching found nothing
    // and the profile URL count is close to the DB post count (within 2x).
    // If caption matching found some but not all, the remaining URLs are NOT ordered
    // consistently with remaining DB posts, so position matching would be wrong.
    // Also unreliable when profile has way more posts than DB (e.g. 93 tweets vs 33 DB).
    const stillUnmatched = postsWithoutUrl.filter(p => !p.platformPostUrl);
    const positionMatchSafe =
      matched === 0 && // No caption matches found (order preserved)
      urls.length <= postsWithoutUrl.length * 2; // Profile not too much larger than DB

    if (stillUnmatched.length > 0 && unmatchedUrls.length > 0 && positionMatchSafe) {
      const positionMatches = Math.min(stillUnmatched.length, unmatchedUrls.length);
      for (let i = 0; i < positionMatches; i++) {
        await updatePostUrl(stillUnmatched[i].id, unmatchedUrls[i]);
        stillUnmatched[i].platformPostUrl = unmatchedUrls[i];
        matched++;
        console.log(`[collect-metrics] ${platform}: position-matched URL for post ${stillUnmatched[i].id.slice(0, 8)}`);
      }
    } else if (stillUnmatched.length > 0 && !positionMatchSafe) {
      console.log(
        `[collect-metrics] ${platform}: skipped position matching (${matched} caption matches, ${urls.length} profile URLs vs ${postsWithoutUrl.length} DB posts)`,
      );
    }

    console.log(`[collect-metrics] ${platform}: discovered ${matched}/${postsWithoutUrl.length} post URLs`);
    return matched;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[collect-metrics] ${platform}: URL discovery failed: ${msg.slice(0, 100)}`);
    return 0;
  }
}

// --- Platform Configuration ---

interface PlatformConfig {
  launch: () => Promise<{ context: BrowserContext; page: Page }>;
  sessionDir: string;
  scrape: (page: Page) => Promise<MetricsResult>;
}

const PLATFORM_CONFIG: Partial<Record<Platform, PlatformConfig>> = {
  instagram: { launch: launchInstagram, sessionDir: BROWSER_DATA_DIR, scrape: scrapeInstagramPost },
  tiktok: { launch: launchTikTok, sessionDir: TIKTOK_BROWSER_DATA_DIR, scrape: scrapeTikTokPost },
  youtube: { launch: launchYouTube, sessionDir: YOUTUBE_BROWSER_DATA_DIR, scrape: scrapeYouTubePost },
  reddit: { launch: launchReddit, sessionDir: REDDIT_BROWSER_DATA_DIR, scrape: scrapeRedditPost },
  twitter: { launch: launchTwitter, sessionDir: TWITTER_BROWSER_DATA_DIR, scrape: scrapeTwitterPost },
  pinterest: { launch: launchPinterest, sessionDir: PINTEREST_BROWSER_DATA_DIR, scrape: scrapePinterestPost },
};

const ALL_PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube', 'reddit', 'twitter', 'pinterest'];

/**
 * Scrape engagement metrics for posts on a single platform.
 * Phase 1: Discover missing URLs from profile (one-time).
 * Phase 2: Visit each post URL and scrape metrics.
 */
async function collectForPlatform(
  platform: Platform,
  maxPosts: number,
  minAgeHours: number,
): Promise<number> {
  const posts = await getPostsNeedingMetrics(platform, minAgeHours, maxPosts);
  if (posts.length === 0) {
    console.log(`[collect-metrics] ${platform}: no posts need fresh metrics`);
    return 0;
  }

  const config = PLATFORM_CONFIG[platform];
  if (!config) {
    console.log(`[collect-metrics] ${platform}: no scraper configured — skipping`);
    return 0;
  }
  let collected = 0;
  let context: BrowserContext | undefined;

  try {
    const session = await config.launch();
    context = session.context;
    const page = session.page;

    // Phase 1: Discover URLs for posts that don't have them
    const postsWithoutUrl = posts.filter(p => !p.platformPostUrl);
    if (postsWithoutUrl.length > 0) {
      await discoverPostUrls(page, platform, posts);
    }

    // Phase 2: Scrape metrics for posts with URLs
    const scrapeable = posts.filter(p => p.platformPostUrl);
    if (scrapeable.length === 0) {
      console.log(`[collect-metrics] ${platform}: ${posts.length} post(s) found but none have URLs — run backfill-urls or wait for URL discovery`);
      await context.close();
      context = undefined;
      return 0;
    }

    console.log(`[collect-metrics] ${platform}: scraping ${scrapeable.length} post(s)...`);

    for (const post of scrapeable) {
      try {
        await page.goto(post.platformPostUrl!, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });

        // Check for CAPTCHA after navigation
        if (await detectCaptcha(page, platform)) {
          const screenshotPath = `/tmp/captcha-${platform}-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath }).catch(() => {});
          console.error(
            `[collect-metrics] ${platform}: CAPTCHA detected! Screenshot: ${screenshotPath}\n` +
              `Browser left open — solve it manually, then restart the scheduler.`,
          );
          throw new CaptchaDetectedError(platform);
        }

        const metrics = await config.scrape(page);

        // Sanity check: if a post from our small account shows > 1000 likes,
        // the URL is likely wrong (position-matched to someone else's viral post).
        // Skip saving to avoid polluting engagement data.
        const totalEngagement = metrics.likes + metrics.comments + metrics.shares;
        if (totalEngagement > 1000) {
          console.warn(
            `[collect-metrics] ${platform}: SKIPPING post ${post.id.slice(0, 8)} — implausibly high engagement ` +
              `(${metrics.likes} likes, ${metrics.comments} comments, ${metrics.shares} shares). ` +
              `URL may be wrong: ${post.platformPostUrl?.slice(0, 60)}`,
          );
          continue;
        }

        await saveEngagementMetrics({
          postId: post.id,
          likes: metrics.likes,
          comments: metrics.comments,
          shares: metrics.shares,
          views: metrics.views,
          saves: metrics.saves,
          reach: 0,
          impressions: 0,
        });

        collected++;
        const parts = [];
        if (metrics.views) parts.push(`${metrics.views} views`);
        if (metrics.likes) parts.push(`${metrics.likes} likes`);
        if (metrics.comments) parts.push(`${metrics.comments} comments`);
        if (metrics.shares) parts.push(`${metrics.shares} shares`);
        console.log(
          `[collect-metrics] ${platform} post ${collected}/${scrapeable.length}: ${parts.join(', ') || 'no visible metrics'}`,
        );
      } catch (err) {
        if (err instanceof CaptchaDetectedError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[collect-metrics] ${platform}: failed to scrape post ${post.id.slice(0, 8)}: ${msg.slice(0, 100)}`);
      }
    }

    await context.close();
    context = undefined;
  } catch (err) {
    if (err instanceof CaptchaDetectedError) {
      // Don't close browser — user needs to solve CAPTCHA
      throw err;
    }
    if (context) {
      await context.close().catch(() => {});
    }
    throw err;
  }

  console.log(`[collect-metrics] ${platform}: collected ${collected}/${posts.length}`);
  return collected;
}

/**
 * Collect engagement metrics across all (or specified) platforms.
 * Each platform runs sequentially with browser lock.
 */
export async function collectEngagementMetrics(options: {
  platforms?: Platform[];
  maxPostsPerPlatform?: number;
  minAgeHours?: number;
} = {}): Promise<CollectionResult> {
  const {
    platforms = ALL_PLATFORMS,
    maxPostsPerPlatform = 10,
    minAgeHours = 6,
  } = options;

  const result: CollectionResult = {
    total: 0,
    byPlatform: {},
    errors: [],
  };

  for (const platform of platforms) {
    const config = PLATFORM_CONFIG[platform];
    if (!config) continue;

    try {
      const collected = await withBrowserLock(config.sessionDir, () =>
        collectForPlatform(platform, maxPostsPerPlatform, minAgeHours),
      );
      result.byPlatform[platform] = collected;
      result.total += collected;
    } catch (err) {
      if (err instanceof CaptchaDetectedError) {
        result.captchaOn = platform;
        result.errors.push(`${platform}: CAPTCHA detected — browser left open`);
        console.error(`[collect-metrics] Stopping collection — CAPTCHA on ${platform}`);
        break; // Stop collecting, user needs to handle CAPTCHA
      }
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${platform}: ${msg.slice(0, 100)}`);
      console.error(`[collect-metrics] ${platform} failed: ${msg.slice(0, 100)}`);
    }
  }

  console.log(
    `[collect-metrics] Done — ${result.total} metrics collected across ${Object.keys(result.byPlatform).length} platforms` +
      (result.errors.length ? `, ${result.errors.length} errors` : ''),
  );
  return result;
}
