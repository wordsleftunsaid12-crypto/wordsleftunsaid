import type { Page } from 'playwright';
import {
  recordOutboundEngagement,
  getOutboundEngagementCountToday,
} from '@wlu/shared';
import { jitteredSleep } from '../scheduler/timing.js';
import { launchReddit } from '../platforms/reddit/browser.js';

/**
 * Conservative daily limits for Reddit engagement.
 * Reddit is aggressive about detecting bot-like behavior.
 */
const LIMITS = {
  maxUpvotesPerDay: 10,
  maxCommentsPerDay: 2,
  minDelayBetweenActions: 8000, // 8 seconds between actions
} as const;

const OWN_ACCOUNTS = ['UnsaidWords', 'Proud-Minute4849', 'wordsleftunsent'];

/** Subreddits to engage in — related communities. */
const TARGET_SUBREDDITS = [
  'UnsentLetters',
  'unsentletters',
  'offmychest',
  'TrueOffMyChest',
  'letters',
  'self',
  'mentalhealth',
  'grief',
];

/**
 * Empathetic comment templates for Reddit (longer form, more personal).
 */
const COMMENT_TEMPLATES = [
  'This really resonated with me. Thank you for sharing.',
  'I felt every word of this. You put into words what so many of us feel but can\'t say.',
  'Sending you strength. Writing it out takes real courage.',
  'I\'ve been carrying something similar. It helps knowing I\'m not alone.',
  'The honesty here is beautiful. Some words need to be said, even if they never reach the person.',
  'This hit close to home. Thank you for being brave enough to share.',
];

interface RedditOutboundResult {
  upvotes: number;
  comments: number;
  errors: number;
}

/**
 * Run an outbound engagement session on Reddit.
 * Browses relevant subreddits, upvotes resonant posts, and leaves thoughtful comments.
 */
export async function runRedditOutboundSession(options: {
  dryRun?: boolean;
} = {}): Promise<RedditOutboundResult> {
  const { dryRun = false } = options;
  const result: RedditOutboundResult = { upvotes: 0, comments: 0, errors: 0 };

  const todayUpvotes = await getOutboundEngagementCountToday('like', 'reddit');
  const todayComments = await getOutboundEngagementCountToday('comment', 'reddit');

  if (todayUpvotes >= LIMITS.maxUpvotesPerDay && todayComments >= LIMITS.maxCommentsPerDay) {
    console.log('[reddit-outbound] Daily limits reached, skipping session');
    return result;
  }

  const remainingUpvotes = LIMITS.maxUpvotesPerDay - todayUpvotes;
  const remainingComments = LIMITS.maxCommentsPerDay - todayComments;

  console.log(`[reddit-outbound] Starting session (${remainingUpvotes} upvotes, ${remainingComments} comments remaining)`);

  if (dryRun) {
    console.log('[reddit-outbound] [DRY RUN] Would browse subreddits and engage');
    return result;
  }

  const { context, page } = await launchReddit();

  try {
    // Pick a random subreddit
    const subreddit = TARGET_SUBREDDITS[Math.floor(Math.random() * TARGET_SUBREDDITS.length)];
    console.log(`[reddit-outbound] Browsing r/${subreddit}...`);

    await page.goto(`https://www.reddit.com/r/${subreddit}/new/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(4000);

    // Collect post links
    const postLinks = await page.locator('a[href*="/comments/"]').evaluateAll(
      (els: HTMLAnchorElement[]) => els
        .map(el => el.href)
        .filter(href => href.includes('/comments/'))
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 8),
    );

    console.log(`[reddit-outbound] Found ${postLinks.length} posts`);

    let commentIndex = 0;

    for (const postUrl of postLinks) {
      if (result.upvotes >= remainingUpvotes && result.comments >= remainingComments) break;

      try {
        await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(3000);

        // Check author — skip our own posts
        const author = await page.locator('[data-testid="post_author_link"], a[href*="/user/"]').first()
          .textContent()
          .catch(() => '');
        if (OWN_ACCOUNTS.some(a => author?.includes(a))) {
          console.log('[reddit-outbound] Skipping own post');
          continue;
        }

        // Upvote the post
        if (result.upvotes < remainingUpvotes) {
          const upvoteBtn = page.locator('button[aria-label="upvote"], button[aria-label*="Upvote"]').first();
          if (await upvoteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            const isUpvoted = await upvoteBtn.getAttribute('aria-pressed').catch(() => 'false');
            if (isUpvoted !== 'true') {
              await upvoteBtn.click({ force: true });
              result.upvotes++;
              await recordOutboundEngagement({
                actionType: 'like',
                platform: 'reddit',
                targetUsername: author?.replace(/^u\//, '') ?? 'unknown',
                targetPostUrl: postUrl,
                targetHashtag: subreddit,
              });
              console.log(`[reddit-outbound] Upvoted post by ${author}`);
            }
          }
          await jitteredSleep(LIMITS.minDelayBetweenActions);
        }

        // Comment on the first post only
        if (result.comments < remainingComments && commentIndex === 0) {
          const comment = COMMENT_TEMPLATES[Math.floor(Math.random() * COMMENT_TEMPLATES.length)];
          const commentBox = page.locator('div[contenteditable="true"][data-lexical-editor]').first();
          if (await commentBox.isVisible({ timeout: 3000 }).catch(() => false)) {
            await commentBox.click({ force: true });
            await page.waitForTimeout(500);
            await page.keyboard.type(comment, { delay: 20 });
            await page.waitForTimeout(1000);

            // Click Comment button
            const commentBtn = page.getByRole('button', { name: /^Comment$/i }).first();
            if (await commentBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await commentBtn.click({ force: true });
              result.comments++;
              await recordOutboundEngagement({
                actionType: 'comment',
                platform: 'reddit',
                targetUsername: author?.replace(/^u\//, '') ?? 'unknown',
                targetPostUrl: postUrl,
                targetHashtag: subreddit,
                commentText: comment,
              });
              console.log(`[reddit-outbound] Commented on post by ${author}`);
            }
            await jitteredSleep(LIMITS.minDelayBetweenActions * 2);
          }
        }

        commentIndex++;
      } catch (err) {
        result.errors++;
        console.warn('[reddit-outbound] Error on post:', err instanceof Error ? err.message : err);
      }
    }
  } finally {
    await context.close();
  }

  console.log(`[reddit-outbound] Session complete: ${result.upvotes} upvotes, ${result.comments} comments, ${result.errors} errors`);
  return result;
}
