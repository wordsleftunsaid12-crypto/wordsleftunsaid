import type { Page } from 'playwright';
import {
  recordOutboundEngagement,
  getOutboundEngagementCountToday,
} from '@wlu/shared';
import { jitteredSleep } from '../scheduler/timing.js';
import { launchTwitter } from '../platforms/twitter/browser.js';

/**
 * Conservative daily limits for X/Twitter engagement.
 * Twitter rate-limits aggressively — keep volumes low.
 */
const LIMITS = {
  maxLikesPerDay: 6,
  maxRetweetsPerDay: 2,
  maxCommentsPerDay: 1,
  minDelayBetweenActions: 10000, // 10 seconds between actions
} as const;

const OWN_ACCOUNTS = ['unsentwords12', 'wordsleftunsent'];

/** Hashtags/search terms to find relatable content on X. */
const SEARCH_QUERIES = [
  'unsent letter',
  '#unsentletters',
  '#wordsleftunsent',
  '#dearex',
  '#thingsiwishisaid',
  'things i never told you',
  '"i miss you" letter',
  '"i wish i said"',
];

/**
 * Empathetic reply templates for X/Twitter (concise, tweet-length).
 */
const COMMENT_TEMPLATES = [
  'This really hit home.',
  'Felt every word of this.',
  'Needed to read this today. Thank you for sharing.',
  'The courage to say this, even here, is beautiful.',
  'Some words just stay with you.',
  'So much truth in this.',
];

interface TwitterOutboundResult {
  likes: number;
  retweets: number;
  comments: number;
  errors: number;
}

/**
 * Run an outbound engagement session on X/Twitter.
 * Searches for related content, likes tweets, and leaves thoughtful replies.
 */
export async function runTwitterOutboundSession(options: {
  dryRun?: boolean;
} = {}): Promise<TwitterOutboundResult> {
  const { dryRun = false } = options;
  const result: TwitterOutboundResult = { likes: 0, retweets: 0, comments: 0, errors: 0 };

  const [todayLikes, todayRetweets, todayComments] = await Promise.all([
    getOutboundEngagementCountToday('like', 'twitter'),
    getOutboundEngagementCountToday('follow', 'twitter'), // retweets stored as 'follow' action
    getOutboundEngagementCountToday('comment', 'twitter'),
  ]);

  const remaining = {
    likes: Math.max(0, LIMITS.maxLikesPerDay - todayLikes),
    retweets: Math.max(0, LIMITS.maxRetweetsPerDay - todayRetweets),
    comments: Math.max(0, LIMITS.maxCommentsPerDay - todayComments),
  };

  if (remaining.likes === 0 && remaining.retweets === 0 && remaining.comments === 0) {
    console.log('[twitter-outbound] Daily limits reached, skipping session');
    return result;
  }

  console.log(
    `[twitter-outbound] Starting session (${remaining.likes} likes, ${remaining.retweets} retweets, ${remaining.comments} replies remaining)`,
  );

  if (dryRun) {
    console.log('[twitter-outbound] [DRY RUN] Would search and engage');
    return result;
  }

  const { context, page } = await launchTwitter();

  try {
    // Pick a random search query
    const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
    console.log(`[twitter-outbound] Searching: "${query}"`);

    await page.goto(`https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(4000);

    // Collect tweet links from search results
    const tweetLinks = await page.locator('a[href*="/status/"]').evaluateAll(
      (els: HTMLAnchorElement[]) => els
        .map(el => el.href)
        .filter(href => /\/status\/\d+$/.test(href))
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 10),
    );

    console.log(`[twitter-outbound] Found ${tweetLinks.length} tweets`);

    let commentIndex = 0;

    for (const tweetUrl of tweetLinks) {
      if (result.likes >= remaining.likes && result.comments >= remaining.comments) break;

      try {
        await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        // Get author username from URL
        const urlMatch = tweetUrl.match(/x\.com\/([^/]+)\/status/);
        const author = urlMatch?.[1] ?? 'unknown';

        // Skip own accounts
        if (OWN_ACCOUNTS.some(a => author.toLowerCase() === a.toLowerCase())) {
          console.log('[twitter-outbound] Skipping own tweet');
          continue;
        }

        // Like the tweet
        if (result.likes < remaining.likes) {
          const liked = await likeXTweet(page);
          if (liked) {
            result.likes++;
            await recordOutboundEngagement({
              actionType: 'like',
              platform: 'twitter',
              targetUsername: author,
              targetPostUrl: tweetUrl,
              targetHashtag: query,
            });
            console.log(`[twitter-outbound] Liked tweet by @${author} (${result.likes}/${remaining.likes})`);
          }
          await jitteredSleep(LIMITS.minDelayBetweenActions);
        }

        // Retweet (every 3rd tweet)
        if (result.retweets < remaining.retweets && commentIndex % 3 === 0) {
          const retweeted = await retweetXTweet(page);
          if (retweeted) {
            result.retweets++;
            await recordOutboundEngagement({
              actionType: 'follow', // stored as 'follow' since outbound_engagement has limited types
              platform: 'twitter',
              targetUsername: author,
              targetPostUrl: tweetUrl,
              targetHashtag: query,
            });
            console.log(`[twitter-outbound] Retweeted @${author} (${result.retweets}/${remaining.retweets})`);
          }
          await jitteredSleep(LIMITS.minDelayBetweenActions);
        }

        // Reply to first eligible tweet only
        if (result.comments < remaining.comments && commentIndex === 0) {
          const reply = COMMENT_TEMPLATES[Math.floor(Math.random() * COMMENT_TEMPLATES.length)];
          const replied = await replyToXTweet(page, reply);
          if (replied) {
            result.comments++;
            await recordOutboundEngagement({
              actionType: 'comment',
              platform: 'twitter',
              targetUsername: author,
              targetPostUrl: tweetUrl,
              targetHashtag: query,
              commentText: reply,
            });
            console.log(`[twitter-outbound] Replied to @${author}: "${reply}"`);
          }
          await jitteredSleep(LIMITS.minDelayBetweenActions * 2);
        }

        commentIndex++;
      } catch (err) {
        result.errors++;
        console.warn('[twitter-outbound] Error on tweet:', err instanceof Error ? err.message : err);
      }
    }
  } finally {
    await context.close();
  }

  console.log(
    `[twitter-outbound] Session complete: ${result.likes} likes, ${result.retweets} retweets, ${result.comments} replies, ${result.errors} errors`,
  );
  return result;
}

// --- Browser helpers ---

async function likeXTweet(page: Page): Promise<boolean> {
  try {
    // Check if already liked first
    const unlikeBtn = page.locator('[data-testid="unlike"]').first();
    if (await unlikeBtn.isVisible({ timeout: 1000 }).catch(() => false)) return false;

    const likeBtn = page.locator('[data-testid="like"]').first();
    if (!(await likeBtn.isVisible({ timeout: 5000 }).catch(() => false))) return false;

    await likeBtn.click();
    await page.waitForTimeout(1000);
    return true;
  } catch {
    return false;
  }
}

async function retweetXTweet(page: Page): Promise<boolean> {
  try {
    const retweetBtn = page.locator('[data-testid="retweet"]').first();
    if (!(await retweetBtn.isVisible({ timeout: 3000 }).catch(() => false))) return false;

    // Check if already retweeted
    const unretweetBtn = page.locator('[data-testid="unretweet"]').first();
    if (await unretweetBtn.isVisible({ timeout: 500 }).catch(() => false)) return false;

    await retweetBtn.click();
    await page.waitForTimeout(1000);

    // Click "Repost" in the menu
    const repostOption = page.locator('[data-testid="retweetConfirm"]').first();
    if (await repostOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await repostOption.click();
      await page.waitForTimeout(500);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function replyToXTweet(page: Page, text: string): Promise<boolean> {
  try {
    // The reply input is the rich text editor on the tweet detail page
    const replyBox = page.locator('[data-testid="tweetTextarea_0"]').first();
    if (!(await replyBox.isVisible({ timeout: 3000 }).catch(() => false))) {
      // Try clicking the reply button first
      const replyBtn = page.locator('[data-testid="reply"]').first();
      if (await replyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await replyBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    const editor = page.locator('[data-testid="tweetTextarea_0"]').first();
    if (!(await editor.isVisible({ timeout: 3000 }).catch(() => false))) return false;

    await editor.click();
    await page.waitForTimeout(500);
    await page.keyboard.type(text, { delay: 20 });
    await page.waitForTimeout(1000);

    // Click the Reply/Post button
    const inlineBtn = page.locator('[data-testid="tweetButtonInline"]').first();
    const regularBtn = page.locator('[data-testid="tweetButton"]').first();
    const postBtn = (await inlineBtn.isVisible({ timeout: 2000 }).catch(() => false))
      ? inlineBtn
      : regularBtn;
    if (await postBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await postBtn.click();
      await page.waitForTimeout(2000);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
