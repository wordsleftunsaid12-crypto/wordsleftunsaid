import type { Page } from 'playwright';
import {
  recordOutboundEngagement,
  getOutboundEngagementCountToday,
} from '@wlu/shared';
import { getTargetHashtags, pickRandomHashtag } from './targeting.js';
import { jitteredSleep } from '../scheduler/timing.js';
import { launchYouTube, dismissModals } from '../platforms/youtube/browser.js';

/**
 * Strict daily limits for YouTube outbound engagement.
 * Most conservative of the three platforms — YouTube is strict about automation.
 */
const LIMITS = {
  maxLikesPerDay: 10,
  maxSubscribesPerDay: 2,
  maxCommentsPerDay: 2,
  minDelayBetweenActions: 8000, // 8 seconds (was 25s)
} as const;

/** Our own channel usernames — skip these during outbound engagement */
const OWN_ACCOUNTS = ['wordsleftunsaid', 'Words Left Unsaid'];

/**
 * Comment templates for YouTube Shorts (natural, slightly longer than TikTok).
 */
const COMMENT_TEMPLATES = [
  'this really resonated with me',
  'needed to hear this today',
  'the way this just hit different',
  'beautifully put into words',
  'this stopped me mid-scroll',
  'more people need to see this',
  'felt this in my soul',
  'so real it hurts',
  'sometimes the simplest words carry the most weight',
  'this is why I keep coming back to Shorts',
];

interface OutboundResult {
  likes: number;
  subscribes: number;
  comments: number;
  errors: number;
}

/**
 * Run a YouTube Shorts outbound engagement session.
 *
 * Flow: search for keyword → open Shorts → like/subscribe/comment.
 * YouTube Shorts search: youtube.com/results?search_query={keyword}&sp=EgIYAQ%3D%3D
 */
export async function runYouTubeOutboundSession(
  options: { dryRun?: boolean } = {},
): Promise<OutboundResult> {
  const { dryRun = false } = options;

  // Check daily counts
  const [likesToday, subscribesToday, commentsToday] = await Promise.all([
    getOutboundEngagementCountToday('like', 'youtube'),
    getOutboundEngagementCountToday('follow', 'youtube'),
    getOutboundEngagementCountToday('comment', 'youtube'),
  ]);

  const remaining = {
    likes: Math.max(0, LIMITS.maxLikesPerDay - likesToday),
    subscribes: Math.max(0, LIMITS.maxSubscribesPerDay - subscribesToday),
    comments: Math.max(0, LIMITS.maxCommentsPerDay - commentsToday),
  };

  console.log(
    `[youtube-outbound] Daily remaining — likes: ${remaining.likes}, subscribes: ${remaining.subscribes}, comments: ${remaining.comments}`,
  );

  if (remaining.likes === 0 && remaining.subscribes === 0 && remaining.comments === 0) {
    console.log('[youtube-outbound] Daily limits reached. Skipping session.');
    return { likes: 0, subscribes: 0, comments: 0, errors: 0 };
  }

  const hashtags = await getTargetHashtags();
  const searchKeyword = pickRandomHashtag(hashtags);
  console.log(`[youtube-outbound] Search keyword: "${searchKeyword}"`);

  if (dryRun) {
    console.log(`[youtube-outbound] [DRY RUN] Would engage with "${searchKeyword}" Shorts`);
    return { likes: 0, subscribes: 0, comments: 0, errors: 0 };
  }

  console.log('[youtube-outbound] Launching browser...');
  const { context, page } = await launchYouTube();
  const result: OutboundResult = { likes: 0, subscribes: 0, comments: 0, errors: 0 };
  const visitedUrls = new Set<string>();

  try {
    // Navigate to YouTube search with Shorts filter
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchKeyword)}&sp=EgIYAQ%3D%3D`;
    console.log(`[youtube-outbound] Searching: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Collect Short URLs from search results
    const shortsLinks = page.locator('a[href*="/shorts/"]');
    const linkCount = await shortsLinks.count();

    if (linkCount === 0) {
      console.log('[youtube-outbound] No Shorts found in search results');
      await page.screenshot({ path: '/tmp/youtube-outbound-debug.png' }).catch(() => {});
      return result;
    }

    console.log(`[youtube-outbound] Found ${linkCount} Shorts links`);

    // Collect unique Short URLs (skip bare /shorts/ feed link)
    const shortUrls: string[] = [];
    for (let i = 0; i < Math.min(linkCount, 20); i++) {
      const href = await shortsLinks.nth(i).getAttribute('href').catch(() => null);
      if (href && href.match(/\/shorts\/[A-Za-z0-9_-]+/)) {
        const fullUrl = href.startsWith('http') ? href : `https://www.youtube.com${href}`;
        if (!shortUrls.includes(fullUrl)) {
          shortUrls.push(fullUrl);
        }
      }
      if (shortUrls.length >= 8) break;
    }

    console.log(`[youtube-outbound] Collected ${shortUrls.length} unique Short URLs`);

    const likesToDo = Math.min(remaining.likes, 8);
    const subscribesToDo = Math.min(remaining.subscribes, 2);
    const commentsToDo = Math.min(remaining.comments, 1);

    // Visit up to 8 Shorts
    for (let i = 0; i < Math.min(shortUrls.length, 8); i++) {
      const url = shortUrls[i];
      if (visitedUrls.has(url)) continue;
      visitedUrls.add(url);

      try {
        console.log(`[youtube-outbound] Opening Short ${i + 1}: ${url.split('/shorts/')[1]?.slice(0, 11) ?? url.slice(-20)}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2000);
        await dismissModals(page);

        const username = await getYouTubeUsername(page);
        console.log(`[youtube-outbound] Short by @${username ?? 'unknown'}`);

        // Skip our own channel
        if (username && OWN_ACCOUNTS.some(own => username.toLowerCase() === own.toLowerCase())) {
          console.log(`[youtube-outbound] Skipping own channel @${username}`);
          continue;
        }

        // Like the Short
        if (result.likes < likesToDo) {
          const liked = await likeYouTubeShort(page);
          if (liked) {
            await recordOutboundEngagement({
              actionType: 'like',
              platform: 'youtube',
              targetUsername: username ?? 'unknown',
              targetPostUrl: url,
              targetHashtag: searchKeyword,
            });
            result.likes++;
            console.log(`[youtube-outbound] Liked! (${result.likes}/${likesToDo})`);
          } else {
            console.log('[youtube-outbound] Already liked or button not found');
          }
          await jitteredSleep(LIMITS.minDelayBetweenActions);
        }

        // Subscribe (every other video)
        if (result.subscribes < subscribesToDo && i % 2 === 1 && username) {
          const subscribed = await subscribeToCreator(page);
          if (subscribed) {
            await recordOutboundEngagement({
              actionType: 'follow',
              platform: 'youtube',
              targetUsername: username,
              targetPostUrl: url,
              targetHashtag: searchKeyword,
            });
            result.subscribes++;
            console.log(`[youtube-outbound] Subscribed to @${username} (${result.subscribes}/${subscribesToDo})`);
          }
          await jitteredSleep(LIMITS.minDelayBetweenActions);
        }

        // Comment (first video only)
        if (result.comments < commentsToDo && i === 0) {
          const commentText = pickComment();
          const commented = await leaveYouTubeComment(page, commentText);
          if (commented) {
            await recordOutboundEngagement({
              actionType: 'comment',
              platform: 'youtube',
              targetUsername: username ?? 'unknown',
              targetPostUrl: url,
              targetHashtag: searchKeyword,
              commentText,
            });
            result.comments++;
            console.log(`[youtube-outbound] Commented: "${commentText}"`);
          } else {
            result.errors++;
          }
          await jitteredSleep(LIMITS.minDelayBetweenActions);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[youtube-outbound] Error on Short ${i + 1}: ${msg.slice(0, 100)}`);
        await page.screenshot({ path: `/tmp/youtube-outbound-error-${i}.png` }).catch(() => {});
        result.errors++;
      }
    }
  } finally {
    await context.close();
  }

  console.log(
    `[youtube-outbound] Session complete — ${result.likes} likes, ${result.subscribes} subscribes, ${result.comments} comments, ${result.errors} errors`,
  );

  return result;
}

// --- Browser helpers ---

function pickComment(): string {
  return COMMENT_TEMPLATES[Math.floor(Math.random() * COMMENT_TEMPLATES.length)];
}

async function getYouTubeUsername(page: Page): Promise<string | null> {
  try {
    // YouTube Shorts show the channel link with /@username in the overlay
    const channelLink = page.locator('a[href*="/@"]').first();
    const href = await channelLink.getAttribute('href', { timeout: 3000 });
    if (href) {
      const match = href.match(/@([^/]+)/);
      if (match) return match[1];
    }
  } catch {
    // ignore
  }
  return null;
}

async function likeYouTubeShort(page: Page): Promise<boolean> {
  try {
    // The like button has aria-label like "like this video along with X other people"
    const likeBtn = page.locator('button[aria-label*="like this video"]').first();

    if (!(await likeBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      return false;
    }

    // Check if already liked: the aria-pressed attribute or class changes
    const isLiked = await likeBtn.evaluate((el) => {
      return el.getAttribute('aria-pressed') === 'true' ||
        el.classList.contains('style-default-active');
    }).catch(() => false);

    if (isLiked) return false;

    await likeBtn.click();
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;
  }
}

async function subscribeToCreator(page: Page): Promise<boolean> {
  try {
    // Subscribe button has aria-label "Subscribe to @username"
    const subBtn = page.locator('button[aria-label*="Subscribe to"]').first();

    if (!(await subBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      return false;
    }

    // Check if already subscribed (button text changes to "Subscribed")
    const text = await subBtn.innerText().catch(() => '');
    if (text.trim().toLowerCase() === 'subscribed') {
      return false;
    }

    await subBtn.click();
    await page.waitForTimeout(1000);
    return true;
  } catch {
    return false;
  }
}

async function leaveYouTubeComment(page: Page, text: string): Promise<boolean> {
  try {
    // 1. Open the comments panel by clicking the comments button
    const commentsBtn = page.locator('button[aria-label*="comments" i]').first();
    if (!(await commentsBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log('[youtube-outbound] Comments button not visible');
      return false;
    }

    await commentsBtn.click();
    await page.waitForTimeout(1500);

    // 2. Click the comment input placeholder to activate it
    const placeholder = page.locator('#placeholder-area, #simplebox-placeholder').first();
    if (!(await placeholder.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log('[youtube-outbound] Comment placeholder not found');
      await page.screenshot({ path: '/tmp/youtube-comment-debug.png' }).catch(() => {});
      return false;
    }

    await placeholder.click();
    await page.waitForTimeout(1000);

    // 3. Type in the now-active comment input
    const commentInput = page.locator('#contenteditable-root, [contenteditable="true"]').first();
    if (!(await commentInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log('[youtube-outbound] Comment input not editable');
      return false;
    }

    await commentInput.click();
    await page.waitForTimeout(500);
    await page.keyboard.type(text, { delay: 15 });
    await page.waitForTimeout(500);

    // 4. Click the Comment/Submit button
    const submitBtn = page.locator('#submit-button').first();
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(1500);
      return true;
    }

    // Fallback: try Ctrl+Enter
    console.log('[youtube-outbound] Submit button not found, pressing Ctrl+Enter');
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(3000);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[youtube-outbound] Comment error: ${msg.slice(0, 100)}`);
    return false;
  }
}
