import type { Page } from 'playwright';
import {
  getPostsByPlatform,
  getUnrepliedComments,
  recordComment,
  markCommentReplied,
} from '@wlu/shared';
import { launchInstagram, navigateToProfile } from './browser.js';

const MIN_DELAY_BETWEEN_REPLIES_MS = 30000;
const MAX_REPLIES_PER_HOUR = 30;
const COMMENT_REPLY_MAX_LENGTH = 300;

/** Our Instagram username */
const OUR_USERNAME = 'u.wordsleftunsaid';

/**
 * Fetch new comments from recent Instagram posts via Playwright and store in DB.
 * Returns the number of new comments found.
 */
export async function syncComments(
  options: { maxPosts?: number } = {},
): Promise<number> {
  const { maxPosts = 10 } = options;

  const posts = await getPostsByPlatform('instagram', { limit: maxPosts });
  if (posts.length === 0) {
    console.log('[comments] No posts found to sync comments from');
    return 0;
  }

  console.log('[comments] Launching browser to sync comments...');
  const { context, page } = await launchInstagram();
  let newComments = 0;

  try {
    // Navigate to our profile
    await navigateToProfile(page, OUR_USERNAME);

    // Click on each recent post and scrape comments
    const postLinks = page.locator('article a[href*="/p/"], a[href*="/reel/"]');
    const postCount = Math.min(await postLinks.count(), maxPosts);

    for (let i = 0; i < postCount; i++) {
      try {
        // Go back to profile before each post
        if (i > 0) {
          await navigateToProfile(page, OUR_USERNAME);
        }

        // Click the post
        await postLinks.nth(i).click({ timeout: 10000 });
        await page.waitForTimeout(3000);

        // Match this browser post to a DB post (by order — most recent first)
        const dbPost = posts[i];
        if (!dbPost) continue;

        // Scrape comments from the post detail view
        const comments = await scrapeCommentsFromPost(page);
        for (const comment of comments) {
          // Skip our own comments
          if (comment.username === OUR_USERNAME) continue;

          try {
            await recordComment({
              postId: dbPost.id,
              platformCommentId: `${dbPost.id}-${comment.username}-${comment.text.slice(0, 20)}`,
              username: comment.username,
              commentText: comment.text,
            });
            newComments++;
          } catch {
            // Duplicate — already recorded
          }
        }
      } catch (err) {
        console.warn(`[comments] Failed to scrape post ${i}:`, err);
      }
    }
  } finally {
    await context.close();
  }

  console.log(`[comments] Synced ${newComments} new comment(s)`);
  return newComments;
}

/**
 * Reply to unreplied comments using a reply generator function.
 * Opens a browser session and types replies directly.
 */
export async function replyToUnrepliedComments(options: {
  generateReply: (
    commentText: string,
    username: string,
    postCaption: string | null,
  ) => Promise<string>;
  maxReplies?: number;
  dryRun?: boolean;
}): Promise<number> {
  const {
    generateReply,
    maxReplies = MAX_REPLIES_PER_HOUR,
    dryRun = false,
  } = options;

  const unreplied = await getUnrepliedComments(undefined, {
    limit: maxReplies,
  });

  if (unreplied.length === 0) {
    console.log('[comments] No unreplied comments found');
    return 0;
  }

  // Generate all replies first (before opening browser)
  const repliesWithText: Array<{
    comment: (typeof unreplied)[number];
    replyText: string;
  }> = [];

  for (const comment of unreplied) {
    if (repliesWithText.length >= maxReplies) break;

    try {
      const posts = await getPostsByPlatform('instagram', { limit: 20 });
      const post = posts.find((p) => p.id === comment.postId);

      const replyText = await generateReply(
        comment.commentText,
        comment.username,
        post?.caption ?? null,
      );

      const truncatedReply =
        replyText.length > COMMENT_REPLY_MAX_LENGTH
          ? replyText.slice(0, COMMENT_REPLY_MAX_LENGTH - 3) + '...'
          : replyText;

      if (dryRun) {
        console.log(
          `[comments] [DRY RUN] Would reply to @${comment.username}: "${truncatedReply}"`,
        );
        await markCommentReplied(comment.id, truncatedReply);
      } else {
        repliesWithText.push({ comment, replyText: truncatedReply });
      }
    } catch (err) {
      console.warn(
        `[comments] Failed to generate reply for @${comment.username}:`,
        err,
      );
    }
  }

  if (dryRun) return unreplied.length;
  if (repliesWithText.length === 0) return 0;

  // Open browser and post replies
  console.log(
    `[comments] Launching browser to post ${repliesWithText.length} replies...`,
  );
  const { context, page } = await launchInstagram();
  let repliedCount = 0;

  try {
    await navigateToProfile(page, OUR_USERNAME);

    // Click the first post (most recent)
    const firstPost = page
      .locator('article a[href*="/p/"], a[href*="/reel/"]')
      .first();
    await firstPost.click({ timeout: 10000 });
    await page.waitForTimeout(3000);

    for (const { comment, replyText } of repliesWithText) {
      try {
        await replyToCommentInBrowser(page, comment.username, replyText);
        await markCommentReplied(comment.id, replyText);
        repliedCount++;
        console.log(`[comments] Replied to @${comment.username}`);

        // Delay between replies
        if (repliedCount < repliesWithText.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, MIN_DELAY_BETWEEN_REPLIES_MS),
          );
        }
      } catch (err) {
        console.warn(
          `[comments] Failed to reply to @${comment.username}:`,
          err,
        );
      }
    }
  } finally {
    await context.close();
  }

  console.log(`[comments] Replied to ${repliedCount} comment(s)`);
  return repliedCount;
}

/**
 * Like comments on our own recent posts.
 * Opens each post, clicks the heart icon on comments we haven't liked yet.
 */
export async function likeCommentsOnOwnPosts(
  options: { maxPosts?: number; maxLikesPerPost?: number } = {},
): Promise<number> {
  const { maxPosts = 5, maxLikesPerPost = 5 } = options;

  const posts = await getPostsByPlatform('instagram', { limit: maxPosts });
  if (posts.length === 0) {
    console.log('[comments] No posts to like comments on');
    return 0;
  }

  console.log(`[comments] Launching browser to like comments on ${Math.min(posts.length, maxPosts)} post(s)...`);
  const { context, page } = await launchInstagram();
  let totalLiked = 0;

  try {
    await navigateToProfile(page, OUR_USERNAME);
    await page.waitForTimeout(2000);

    const postLinks = page.locator('a[href*="/p/"], a[href*="/reel/"]');
    const postCount = Math.min(await postLinks.count(), maxPosts);

    for (let i = 0; i < postCount; i++) {
      try {
        if (i > 0) {
          await navigateToProfile(page, OUR_USERNAME);
          await page.waitForTimeout(2000);
        }

        console.log(`[comments] Opening post ${i + 1}/${postCount} to like comments...`);
        await postLinks.nth(i).click({ timeout: 10000 });
        await page.waitForTimeout(3000);

        // Find unliked comment heart buttons (small hearts in comment list)
        const commentLikeBtns = page.locator('ul li svg[aria-label="Like"]');
        const btnCount = Math.min(await commentLikeBtns.count(), maxLikesPerPost);

        let likedOnPost = 0;
        for (let j = 0; j < btnCount; j++) {
          try {
            const btn = commentLikeBtns.nth(j);
            if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
              await btn.click();
              likedOnPost++;
              await page.waitForTimeout(800);
            }
          } catch {
            // Skip this comment
          }
        }

        totalLiked += likedOnPost;
        console.log(`[comments] Liked ${likedOnPost} comment(s) on post ${i + 1}`);

        if (likedOnPost > 0) {
          await page.waitForTimeout(3000);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[comments] Error liking comments on post ${i + 1}: ${msg.slice(0, 100)}`);
        await page.screenshot({ path: `/tmp/ig-comment-like-error-${i}.png` }).catch(() => {});
      }
    }
  } finally {
    await context.close();
  }

  console.log(`[comments] Liked ${totalLiked} comment(s) across ${Math.min(posts.length, maxPosts)} post(s)`);
  return totalLiked;
}

// --- Browser helpers ---

interface ScrapedComment {
  username: string;
  text: string;
}

/**
 * Scrape visible comments from an open post detail view.
 */
async function scrapeCommentsFromPost(page: Page): Promise<ScrapedComment[]> {
  const comments: ScrapedComment[] = [];

  // Load more comments if available
  try {
    const viewAll = page.getByRole('button', {
      name: /View all.*comments/i,
    });
    if (await viewAll.isVisible({ timeout: 2000 }).catch(() => false)) {
      await viewAll.click();
      await page.waitForTimeout(2000);
    }
  } catch {
    // No "view all" button
  }

  // Use page.evaluate for more reliable comment scraping
  const scraped = await page.evaluate(() => {
    const results: Array<{ username: string; text: string }> = [];
    // Comments typically live in the comment section with username links
    const commentItems = document.querySelectorAll(
      'ul ul li, [role="list"] li',
    );

    for (const item of commentItems) {
      const usernameEl = item.querySelector('a[href*="/"]');
      const textSpans = item.querySelectorAll('span');

      if (!usernameEl) continue;
      const href = usernameEl.getAttribute('href') ?? '';
      const username = href.replace(/\//g, '');
      if (!username || username.length > 30) continue;

      // Find the comment text (longest span that isn't the username)
      let longestText = '';
      for (const span of textSpans) {
        const text = span.textContent?.trim() ?? '';
        if (text.length > longestText.length && text !== username) {
          longestText = text;
        }
      }

      if (longestText.length >= 2) {
        results.push({ username, text: longestText });
      }
    }

    return results;
  });

  // Deduplicate
  const seen = new Set<string>();
  for (const comment of scraped) {
    const key = `${comment.username}:${comment.text.slice(0, 50)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    comments.push(comment);
  }

  return comments;
}

/**
 * Reply to a specific comment in the browser by finding the comment,
 * clicking reply, and typing the response.
 */
async function replyToCommentInBrowser(
  page: Page,
  username: string,
  replyText: string,
): Promise<void> {
  // Find the comment by username
  const commentByUser = page.locator(`a[href="/${username}/"]`).first();
  if (!(await commentByUser.isVisible({ timeout: 5000 }).catch(() => false))) {
    throw new Error(`Comment by @${username} not visible on page`);
  }

  // Click "Reply" link near the comment
  const parentLi = commentByUser.locator('xpath=ancestor::li[1]');
  const replyButton = parentLi.getByText('Reply', { exact: true });
  await replyButton.click({ timeout: 5000 });
  await page.waitForTimeout(1000);

  // Type the reply in the comment input
  const commentInput = page
    .locator('[aria-label="Add a comment…"]')
    .or(page.locator('textarea[placeholder*="comment"]'))
    .or(page.locator('form textarea'));

  await commentInput.first().click({ timeout: 5000 });
  await commentInput.first().fill('');
  await page.keyboard.type(replyText, { delay: 30 });
  await page.waitForTimeout(1000);

  // Submit the reply — Instagram uses div[role="button"], not a real <button>
  const postBtn = page.locator('[role="button"]').filter({ hasText: /^Post$/ }).first();
  await postBtn.click({ timeout: 5000 });
  await page.waitForTimeout(3000);
}
