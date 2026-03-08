import type { Page } from 'playwright';
import {
  recordOutboundEngagement,
  getOutboundEngagementCountToday,
} from '@wlu/shared';
import { getTargetHashtags, pickRandomHashtag } from './targeting.js';
import { jitteredSleep } from '../scheduler/timing.js';
import { launchTikTok, dismissModals } from '../platforms/tiktok/browser.js';

/**
 * Strict daily limits for TikTok outbound engagement.
 * Even more conservative than Instagram — TikTok is aggressive about bans.
 */
const LIMITS = {
  maxLikesPerDay: 12,
  maxFollowsPerDay: 3,
  maxCommentsPerDay: 2,
  minDelayBetweenActions: 6000, // 6 seconds (was 20s)
} as const;

/** Our own account usernames — skip these during outbound engagement */
const OWN_ACCOUNTS = ['u.wordsleftunsaid', 'wordsleftunsaid'];

/**
 * Comment templates for TikTok (shorter, more casual than Instagram).
 */
const COMMENT_TEMPLATES = [
  'this really hit different',
  'needed this today',
  'the way this just stopped me scrolling',
  'so real',
  'this one is staying with me',
  'felt every word of this',
  'why is this so relatable',
  'beautifully said',
  'this is everything',
  'more people need to see this',
];

interface OutboundResult {
  likes: number;
  follows: number;
  comments: number;
  errors: number;
}

/**
 * Run a TikTok outbound engagement session.
 *
 * Flow: open hashtag page → visit posts → like/comment/follow.
 * TikTok web hashtag pages: https://www.tiktok.com/tag/<hashtag>
 */
export async function runTikTokOutboundSession(
  options: { dryRun?: boolean } = {},
): Promise<OutboundResult> {
  const { dryRun = false } = options;

  // Check daily counts (shared across platforms via engagement_type filter)
  const [likesToday, followsToday, commentsToday] = await Promise.all([
    getOutboundEngagementCountToday('like', 'tiktok'),
    getOutboundEngagementCountToday('follow', 'tiktok'),
    getOutboundEngagementCountToday('comment', 'tiktok'),
  ]);

  const remaining = {
    likes: Math.max(0, LIMITS.maxLikesPerDay - likesToday),
    follows: Math.max(0, LIMITS.maxFollowsPerDay - followsToday),
    comments: Math.max(0, LIMITS.maxCommentsPerDay - commentsToday),
  };

  console.log(
    `[tiktok-outbound] Daily remaining — likes: ${remaining.likes}, follows: ${remaining.follows}, comments: ${remaining.comments}`,
  );

  if (remaining.likes === 0 && remaining.follows === 0 && remaining.comments === 0) {
    console.log('[tiktok-outbound] Daily limits reached. Skipping session.');
    return { likes: 0, follows: 0, comments: 0, errors: 0 };
  }

  const hashtags = await getTargetHashtags();
  const targetHashtag = pickRandomHashtag(hashtags);
  console.log(`[tiktok-outbound] Target hashtag: #${targetHashtag}`);

  if (dryRun) {
    console.log(`[tiktok-outbound] [DRY RUN] Would engage with #${targetHashtag}`);
    return { likes: 0, follows: 0, comments: 0, errors: 0 };
  }

  console.log('[tiktok-outbound] Launching browser...');
  const { context, page } = await launchTikTok();
  const result: OutboundResult = { likes: 0, follows: 0, comments: 0, errors: 0 };
  const visitedUrls = new Set<string>();

  try {
    // Navigate to hashtag page
    const tagUrl = `https://www.tiktok.com/tag/${targetHashtag}`;
    console.log(`[tiktok-outbound] Navigating to ${tagUrl}...`);
    await page.goto(tagUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Find video links on the hashtag page
    const videoLinks = page.locator('[data-e2e="challenge-item"] a[href*="/video/"], a[href*="/video/"]');
    const linkCount = await videoLinks.count();

    if (linkCount === 0) {
      console.log('[tiktok-outbound] No videos found on hashtag page');
      await page.screenshot({ path: '/tmp/tiktok-outbound-debug.png' }).catch(() => {});
      return result;
    }

    console.log(`[tiktok-outbound] Found ${linkCount} videos`);

    // Collect unique video URLs first (avoid clicking, navigate directly)
    const videoUrls: string[] = [];
    for (let i = 0; i < Math.min(linkCount, 15); i++) {
      const href = await videoLinks.nth(i).getAttribute('href').catch(() => null);
      if (href && href.includes('/video/')) {
        const fullUrl = href.startsWith('http') ? href : `https://www.tiktok.com${href}`;
        if (!videoUrls.includes(fullUrl)) {
          videoUrls.push(fullUrl);
        }
      }
    }

    const likesToDo = Math.min(remaining.likes, 8);
    const followsToDo = Math.min(remaining.follows, 2);
    const commentsToDo = Math.min(remaining.comments, 1);

    // Visit up to 8 unique videos
    for (let i = 0; i < Math.min(videoUrls.length, 8); i++) {
      const url = videoUrls[i];
      if (visitedUrls.has(url)) continue;
      visitedUrls.add(url);

      try {
        console.log(`[tiktok-outbound] Opening video ${i + 1}: ${url.slice(-30)}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1500);
        await dismissModals(page);

        const username = await getTikTokUsername(page);
        console.log(`[tiktok-outbound] Video by @${username ?? 'unknown'}`);

        // Skip our own account
        if (username && OWN_ACCOUNTS.includes(username.toLowerCase())) {
          console.log(`[tiktok-outbound] Skipping own account @${username}`);
          continue;
        }

        // Like the video
        if (result.likes < likesToDo) {
          const liked = await likeTikTokVideo(page);
          if (liked) {
            await recordOutboundEngagement({
              actionType: 'like',
              platform: 'tiktok',
              targetUsername: username ?? 'unknown',
              targetPostUrl: url,
              targetHashtag: targetHashtag,
            });
            result.likes++;
            console.log(`[tiktok-outbound] Liked! (${result.likes}/${likesToDo})`);
          } else {
            console.log('[tiktok-outbound] Already liked or button not found');
          }
          await jitteredSleep(LIMITS.minDelayBetweenActions);
        }

        // Follow (every other video)
        if (result.follows < followsToDo && i % 2 === 1 && username) {
          const followed = await followTikTokUser(page);
          if (followed) {
            await recordOutboundEngagement({
              actionType: 'follow',
              platform: 'tiktok',
              targetUsername: username,
              targetPostUrl: url,
              targetHashtag: targetHashtag,
            });
            result.follows++;
            console.log(`[tiktok-outbound] Followed @${username} (${result.follows}/${followsToDo})`);
          }
          await jitteredSleep(LIMITS.minDelayBetweenActions);
        }

        // Comment (first video only)
        if (result.comments < commentsToDo && i === 0) {
          const commentText = pickComment();
          const commented = await leaveTikTokComment(page, commentText);
          if (commented) {
            await recordOutboundEngagement({
              actionType: 'comment',
              platform: 'tiktok',
              targetUsername: username ?? 'unknown',
              targetPostUrl: url,
              targetHashtag: targetHashtag,
              commentText,
            });
            result.comments++;
            console.log(`[tiktok-outbound] Commented: "${commentText}"`);
          } else {
            result.errors++;
          }
          await jitteredSleep(LIMITS.minDelayBetweenActions);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[tiktok-outbound] Error on video ${i + 1}: ${msg.slice(0, 100)}`);
        await page.screenshot({ path: `/tmp/tiktok-outbound-error-${i}.png` }).catch(() => {});
        result.errors++;
      }
    }
  } finally {
    await context.close();
  }

  console.log(
    `[tiktok-outbound] Session complete — ${result.likes} likes, ${result.follows} follows, ${result.comments} comments, ${result.errors} errors`,
  );

  return result;
}

// --- Browser helpers ---

function pickComment(): string {
  return COMMENT_TEMPLATES[Math.floor(Math.random() * COMMENT_TEMPLATES.length)];
}

async function getTikTokUsername(page: Page): Promise<string | null> {
  // Primary: extract username from the video URL (most reliable on TikTok)
  const url = page.url();
  const urlMatch = url.match(/@([^/]+)/);
  if (urlMatch) return urlMatch[1];

  // Fallback: try the author avatar link's href
  try {
    const avatarLink = page.locator('[data-e2e="video-author-avatar"]').first();
    const href = await avatarLink.getAttribute('href', { timeout: 3000 });
    if (href) {
      const hrefMatch = href.match(/@([^/]+)/);
      if (hrefMatch) return hrefMatch[1];
    }
  } catch {
    // ignore
  }

  return null;
}

async function likeTikTokVideo(page: Page): Promise<boolean> {
  try {
    // The like icon uses data-e2e="like-icon" (a <span> wrapping an SVG)
    const likeIcon = page.locator('[data-e2e="like-icon"]').first();

    if (!(await likeIcon.isVisible({ timeout: 3000 }).catch(() => false))) {
      return false;
    }

    // Check if already liked by looking at the color/class of the SVG inside
    const isLiked = await likeIcon.evaluate((el) => {
      const svg = el.querySelector('svg');
      // TikTok uses a filled red heart (fill color) when liked
      return svg?.getAttribute('fill')?.includes('rgb(254') ||
        el.classList.contains('active') ||
        el.getAttribute('class')?.includes('liked') || false;
    }).catch(() => false);

    if (isLiked) return false;

    await likeIcon.click();
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;
  }
}

async function followTikTokUser(page: Page): Promise<boolean> {
  try {
    // TikTok feed uses data-e2e="feed-follow" for the follow button
    const followBtn = page.locator('[data-e2e="feed-follow"]').first();

    if (await followBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await followBtn.click();
      await page.waitForTimeout(1000);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

async function dismissOverlays(page: Page): Promise<void> {
  // TikTok shows various overlays that block interactions:
  // - "Introducing keyboard shortcuts!" panel
  // - Cookie banners, login prompts, etc.
  try {
    // Remove keyboard shortcuts overlay via JS (fastest and most reliable)
    await page.evaluate(() => {
      // Remove any overlay/modal-like elements
      document.querySelectorAll('[class*="keyboard-shortcut"], [class*="KeyboardShortcut"]').forEach(el => el.remove());
      // Remove any generic overlays blocking the comment area
      document.querySelectorAll('[class*="DivModalMask"], [class*="modal-mask"]').forEach(el => el.remove());
    });
    await page.waitForTimeout(300);

    // Also try Escape in case there are focus-trapped modals
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } catch {
    // ignore
  }
}

async function leaveTikTokComment(page: Page, text: string): Promise<boolean> {
  try {
    // Dismiss any keyboard shortcuts overlay first
    await dismissOverlays(page);

    // Must click the comment icon first — input is hidden until activated
    const commentIcon = page.locator('[data-e2e="comment-icon"]').first();
    if (!(await commentIcon.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log('[tiktok-outbound] Comment icon not visible');
      return false;
    }

    await commentIcon.click();
    await page.waitForTimeout(1000);

    // Dismiss again in case it appeared after clicking
    await dismissOverlays(page);

    // After clicking, the comment input appears as a contenteditable div
    const commentInput = page
      .locator('[data-e2e="comment-input"] [contenteditable="true"]')
      .or(page.locator('div[role="textbox"]'))
      .first();

    if (!(await commentInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log('[tiktok-outbound] Comment input not found after clicking icon');
      await page.screenshot({ path: '/tmp/tiktok-comment-debug.png' }).catch(() => {});
      return false;
    }

    await commentInput.click({ timeout: 5000, force: true });
    await page.waitForTimeout(500);
    await page.keyboard.type(text, { delay: 15 });
    await page.waitForTimeout(500);

    // Click the "Post" button (data-e2e="comment-post")
    const postBtn = page.locator('[data-e2e="comment-post"]').first();

    if (await postBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Dismiss overlays one more time before clicking Post
      await dismissOverlays(page);
      await postBtn.click({ timeout: 5000, force: true });
      await page.waitForTimeout(1500);
      return true;
    }

    // Fallback: press Enter
    console.log('[tiktok-outbound] Post button not visible, pressing Enter...');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[tiktok-outbound] Comment error: ${msg.slice(0, 100)}`);
    return false;
  }
}
