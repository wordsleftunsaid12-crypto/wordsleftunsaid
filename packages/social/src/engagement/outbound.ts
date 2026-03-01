import type { Page } from 'playwright';
import {
  recordOutboundEngagement,
  getOutboundEngagementCountToday,
} from '@wlu/shared';
import { getTargetHashtags, pickRandomHashtag } from './targeting.js';
import { jitteredSleep } from '../scheduler/timing.js';
import { launchInstagram, navigateToHashtag } from '../platforms/instagram/browser.js';

/**
 * Strict daily limits for outbound engagement.
 * Intentionally very conservative to minimize ban risk.
 */
const LIMITS = {
  maxLikesPerDay: 10,
  maxFollowsPerDay: 5,
  maxCommentsPerDay: 3,
  minDelayBetweenActions: 15000, // 15 seconds between actions
} as const;

/**
 * Thoughtful comment templates for different types of content.
 * These sound genuine and personal — not generic bot spam.
 */
const COMMENT_TEMPLATES = [
  'This really hit home. Thank you for putting it into words.',
  'Needed to see this today. Some feelings are so hard to articulate.',
  'The courage it takes to share this is beautiful.',
  'This is so raw and real. More people need to hear this.',
  'Something about this just stopped me scrolling. Really powerful.',
  'Wow, this captures that feeling perfectly.',
  'I think about this more often than I\'d like to admit.',
  'There\'s so much strength in vulnerability like this.',
  'This one is going to stay with me for a while.',
  'Thank you for sharing. It\'s comforting to know others feel this way too.',
];

interface OutboundResult {
  likes: number;
  follows: number;
  comments: number;
  commentLikes: number;
  errors: number;
}

/**
 * Run an outbound engagement session using Playwright browser automation.
 *
 * For each post we visit, we:
 * 1. Like the post
 * 2. Like 1-2 comments on it
 * 3. Optionally follow the author
 * 4. Optionally leave a thoughtful comment
 *
 * Progress is logged at every step. Screenshots are taken on errors.
 */
export async function runOutboundSession(
  options: {
    dryRun?: boolean;
    generateComment?: (postDescription: string) => Promise<string>;
  } = {},
): Promise<OutboundResult> {
  const { dryRun = false } = options;

  // Check current daily counts
  const [likesToday, followsToday, commentsToday] = await Promise.all([
    getOutboundEngagementCountToday('like'),
    getOutboundEngagementCountToday('follow'),
    getOutboundEngagementCountToday('comment'),
  ]);

  const remaining = {
    likes: Math.max(0, LIMITS.maxLikesPerDay - likesToday),
    follows: Math.max(0, LIMITS.maxFollowsPerDay - followsToday),
    comments: Math.max(0, LIMITS.maxCommentsPerDay - commentsToday),
  };

  console.log(
    `[outbound] Daily remaining — likes: ${remaining.likes}, follows: ${remaining.follows}, comments: ${remaining.comments}`,
  );

  if (remaining.likes === 0 && remaining.follows === 0 && remaining.comments === 0) {
    console.log('[outbound] Daily limits reached. Skipping session.');
    return { likes: 0, follows: 0, comments: 0, commentLikes: 0, errors: 0 };
  }

  const hashtags = await getTargetHashtags();
  const targetHashtag = pickRandomHashtag(hashtags);
  console.log(`[outbound] Target hashtag: #${targetHashtag}`);

  if (dryRun) {
    console.log(`[outbound] [DRY RUN] Would engage with #${targetHashtag}`);
    console.log(
      `[outbound] [DRY RUN] Plan: ${Math.min(remaining.likes, 5)} likes, ${Math.min(remaining.follows, 2)} follows, ${Math.min(remaining.comments, 1)} comments`,
    );
    return { likes: 0, follows: 0, comments: 0, commentLikes: 0, errors: 0 };
  }

  console.log('[outbound] Launching browser...');
  const { context, page } = await launchInstagram();
  const result: OutboundResult = { likes: 0, follows: 0, comments: 0, commentLikes: 0, errors: 0 };
  const visitedUrls = new Set<string>();

  try {
    console.log(`[outbound] Navigating to #${targetHashtag}...`);
    await navigateToHashtag(page, targetHashtag);

    const postLinks = page.locator('a[href*="/p/"]');
    const postCount = await postLinks.count();

    if (postCount === 0) {
      console.log('[outbound] No posts found — taking debug screenshot');
      await page.screenshot({ path: '/tmp/ig-outbound-debug.png' }).catch(() => {});
      return result;
    }

    console.log(`[outbound] Found ${postCount} posts`);

    // Engage with up to 5 unique posts per session
    const maxToScan = Math.min(postCount, 10); // scan more to find 5 unique
    const targetUnique = 5;
    const likesToDo = Math.min(remaining.likes, targetUnique);
    const followsToDo = Math.min(remaining.follows, 2);
    const commentsToDo = Math.min(remaining.comments, 1);
    let uniqueVisited = 0;

    for (let i = 0; i < maxToScan && uniqueVisited < targetUnique; i++) {
      try {
        // Navigate back to hashtag page before each post (except the first)
        if (i > 0) {
          console.log(`[outbound] Navigating back to #${targetHashtag}...`);
          await navigateToHashtag(page, targetHashtag);
        }

        // Get the href before clicking to check for duplicates
        const href = await postLinks.nth(i).getAttribute('href', { timeout: 5000 }).catch(() => null);
        if (href && visitedUrls.has(href)) {
          console.log(`[outbound] Skipping already-visited post ${href}`);
          continue;
        }

        console.log(`[outbound] Opening post ${i + 1} (unique: ${uniqueVisited + 1}/${targetUnique})...`);
        await postLinks.nth(i).click({ timeout: 10000 });
        await page.waitForTimeout(3000);

        // Get post author
        const username = await getPostUsername(page);
        const postUrl = page.url();
        visitedUrls.add(href ?? postUrl);
        uniqueVisited++;
        console.log(`[outbound] Post by @${username ?? 'unknown'} — ${postUrl}`);

        if (!username) {
          console.log('[outbound] Could not get username, skipping');
          continue;
        }

        // --- Action 1: Like the post ---
        if (result.likes < likesToDo) {
          console.log(`[outbound] Liking post by @${username}...`);
          const liked = await likePost(page);
          if (liked) {
            await recordOutboundEngagement({
              actionType: 'like',
              targetUsername: username,
              targetPostUrl: postUrl,
              targetHashtag: targetHashtag,
            });
            result.likes++;
            console.log(`[outbound] Liked! (${result.likes}/${likesToDo})`);
          } else {
            console.log('[outbound] Already liked or button not found');
          }
          await jitteredSleep(LIMITS.minDelayBetweenActions);
        }

        // --- Action 2: Like 1-2 comments on the post ---
        console.log('[outbound] Looking for comments to like...');
        const commentLikeCount = await likeCommentsOnPost(page, 2);
        result.commentLikes += commentLikeCount;
        if (commentLikeCount > 0) {
          console.log(`[outbound] Liked ${commentLikeCount} comment(s)`);
          await jitteredSleep(LIMITS.minDelayBetweenActions);
        } else {
          console.log('[outbound] No comment like buttons found');
        }

        // --- Action 3: Follow (every 2nd-3rd post) ---
        if (result.follows < followsToDo && i % 2 === 1) {
          console.log(`[outbound] Checking follow for @${username}...`);
          const followed = await followUser(page);
          if (followed) {
            await recordOutboundEngagement({
              actionType: 'follow',
              targetUsername: username,
              targetPostUrl: postUrl,
              targetHashtag: targetHashtag,
            });
            result.follows++;
            console.log(`[outbound] Followed @${username} (${result.follows}/${followsToDo})`);
          } else {
            console.log('[outbound] Already following or no button');
          }
          await jitteredSleep(LIMITS.minDelayBetweenActions);
        }

        // --- Action 4: Leave a comment (first post only) ---
        if (result.comments < commentsToDo && i === 0) {
          console.log('[outbound] Writing a comment...');
          const commentText = options.generateComment
            ? await options.generateComment(await getPostDescription(page))
            : pickComment();

          const commented = await leaveComment(page, commentText);
          if (commented) {
            await recordOutboundEngagement({
              actionType: 'comment',
              targetUsername: username,
              targetPostUrl: postUrl,
              targetHashtag: targetHashtag,
              commentText,
            });
            result.comments++;
            console.log(`[outbound] Commented: "${commentText.slice(0, 60)}"`);
          } else {
            console.log('[outbound] Could not post comment');
            result.errors++;
          }
          await jitteredSleep(LIMITS.minDelayBetweenActions);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[outbound] Error on post ${i + 1}: ${msg.slice(0, 100)}`);
        await page.screenshot({ path: `/tmp/ig-outbound-error-${i}.png` }).catch(() => {});
        result.errors++;
      }
    }
  } finally {
    await context.close();
  }

  console.log(
    `[outbound] Session complete — ${result.likes} likes, ${result.commentLikes} comment likes, ${result.follows} follows, ${result.comments} comments, ${result.errors} errors`,
  );

  return result;
}

// --- Browser action helpers ---

/**
 * Pick a random thoughtful comment from templates.
 */
function pickComment(): string {
  return COMMENT_TEMPLATES[Math.floor(Math.random() * COMMENT_TEMPLATES.length)];
}

/**
 * Extract the post author's username from the post detail page.
 */
async function getPostUsername(page: Page): Promise<string | null> {
  try {
    const usernameLink = page
      .locator('header a[href*="/"]')
      .or(page.locator('article header a'))
      .first();

    const href = await usernameLink.getAttribute('href', { timeout: 5000 });
    if (!href) return null;
    return href.replace(/\//g, '') || null;
  } catch {
    return null;
  }
}

/**
 * Like the currently open post by clicking the heart icon.
 */
async function likePost(page: Page): Promise<boolean> {
  try {
    const unlikeBtn = page.locator('svg[aria-label="Unlike"]').first();
    if (await unlikeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      return false; // Already liked
    }

    const likeBtn = page.locator('svg[aria-label="Like"]').first();
    if (await likeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await likeBtn.click();
      await page.waitForTimeout(1000);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Like comments on the currently open post.
 * Clicks the small heart icon next to individual comments.
 */
async function likeCommentsOnPost(page: Page, maxLikes: number): Promise<number> {
  let liked = 0;

  try {
    // Comment like buttons are small heart SVGs within comment list items
    const commentLikeBtns = page.locator('ul li svg[aria-label="Like"]');
    const count = Math.min(await commentLikeBtns.count(), maxLikes);

    for (let i = 0; i < count; i++) {
      try {
        const btn = commentLikeBtns.nth(i);
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          liked++;
          await page.waitForTimeout(800);
        }
      } catch {
        // Skip this comment
      }
    }
  } catch {
    // No comments or couldn't find like buttons
  }

  return liked;
}

/**
 * Follow the user on the currently open post.
 */
async function followUser(page: Page): Promise<boolean> {
  try {
    const followBtn = page
      .locator('header')
      .getByRole('button', { name: 'Follow' });

    if (await followBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await followBtn.click();
      await page.waitForTimeout(2000);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Leave a comment on the currently open post.
 */
async function leaveComment(page: Page, text: string): Promise<boolean> {
  try {
    // Instagram sometimes hides the comment input — click the comment icon first
    const commentIcon = page.locator('svg[aria-label="Comment"]').first();
    if (await commentIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
      await commentIcon.click();
      await page.waitForTimeout(1000);
    }

    const commentInput = page
      .locator('[aria-label="Add a comment\u2026"]')
      .or(page.locator('[aria-label="Add a comment..."]'))
      .or(page.locator('textarea[placeholder*="comment" i]'))
      .or(page.locator('form textarea'));

    const input = commentInput.first();
    if (!(await input.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log('[outbound] Comment input not visible — taking screenshot');
      await page.screenshot({ path: '/tmp/ig-comment-input-debug.png' }).catch(() => {});
      return false;
    }

    await input.click();
    await page.waitForTimeout(500);
    // Use keyboard.type for more reliable input (fill doesn't always trigger Instagram's handlers)
    await input.fill('');
    await page.keyboard.type(text, { delay: 30 });
    await page.waitForTimeout(1000);

    // Instagram uses div[role="button"] with text "Post", not a real <button>
    const postBtn = page.locator('[role="button"]').filter({ hasText: /^Post$/ }).first();
    if (!(await postBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      // Fallback: try pressing Enter
      console.log('[outbound] Post button not visible, pressing Enter...');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      return true;
    }

    await postBtn.click();
    await page.waitForTimeout(3000);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[outbound] leaveComment error: ${msg.slice(0, 150)}`);
    await page.screenshot({ path: '/tmp/ig-comment-error.png' }).catch(() => {});
    return false;
  }
}

/**
 * Get a brief description of the currently open post for comment generation.
 */
async function getPostDescription(page: Page): Promise<string> {
  try {
    const captionSpans = page.locator('article span');
    const count = await captionSpans.count();

    let longestText = '';
    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await captionSpans.nth(i).textContent().catch(() => '');
      if (text && text.length > longestText.length) {
        longestText = text;
      }
    }

    return longestText || 'An Instagram post about unspoken feelings';
  } catch {
    return 'An Instagram post about unspoken feelings';
  }
}
