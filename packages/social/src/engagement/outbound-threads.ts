import type { Page } from 'playwright';
import {
  recordOutboundEngagement,
  getOutboundEngagementCountToday,
} from '@wlu/shared';
import { jitteredSleep } from '../scheduler/timing.js';
import { launchThreads } from '../platforms/threads/browser.js';

/**
 * Conservative daily limits for Threads engagement.
 * Threads is Meta-owned — same aggressive bot detection as Instagram.
 */
const LIMITS = {
  maxLikesPerDay: 12,
  maxCommentsPerDay: 2,
  minDelayBetweenActions: 6000, // 6 seconds between actions
} as const;

const OWN_ACCOUNTS = ['u.wordsleftunsaid', 'wordsleftunsent'];

/** Search terms to find relatable content on Threads. */
const SEARCH_QUERIES = [
  'unsent letter',
  'words left unsaid',
  'things i never told you',
  'dear person i love',
  'letting go',
  'healing words',
];

/**
 * Empathetic comment templates for Threads (casual, warm tone).
 */
const COMMENT_TEMPLATES = [
  'this really resonated with me.',
  'felt every word.',
  'needed to read this today. thank you.',
  'the honesty here is beautiful.',
  'some things just need to be said, even if only here.',
  'this stopped me scrolling. so real.',
];

interface ThreadsOutboundResult {
  likes: number;
  comments: number;
  errors: number;
}

/**
 * Run an outbound engagement session on Threads.
 * Searches for related content, likes posts, and leaves thoughtful comments.
 */
export async function runThreadsOutboundSession(options: {
  dryRun?: boolean;
} = {}): Promise<ThreadsOutboundResult> {
  const { dryRun = false } = options;
  const result: ThreadsOutboundResult = { likes: 0, comments: 0, errors: 0 };

  const [todayLikes, todayComments] = await Promise.all([
    getOutboundEngagementCountToday('like', 'threads'),
    getOutboundEngagementCountToday('comment', 'threads'),
  ]);

  const remaining = {
    likes: Math.max(0, LIMITS.maxLikesPerDay - todayLikes),
    comments: Math.max(0, LIMITS.maxCommentsPerDay - todayComments),
  };

  if (remaining.likes === 0 && remaining.comments === 0) {
    console.log('[threads-outbound] Daily limits reached, skipping session');
    return result;
  }

  console.log(
    `[threads-outbound] Starting session (${remaining.likes} likes, ${remaining.comments} comments remaining)`,
  );

  if (dryRun) {
    console.log('[threads-outbound] [DRY RUN] Would search and engage');
    return result;
  }

  const { context, page } = await launchThreads();

  try {
    // Pick a random search query
    const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
    console.log(`[threads-outbound] Searching: "${query}"`);

    // Navigate to search
    await page.goto(`https://www.threads.net/search?q=${encodeURIComponent(query)}&serp_type=default`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(4000);

    // Collect post links from search results
    const postLinks = await page.locator('a[href*="/post/"]').evaluateAll(
      (els: HTMLAnchorElement[]) => els
        .map(el => el.href)
        .filter(href => href.includes('/post/'))
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 8),
    );

    console.log(`[threads-outbound] Found ${postLinks.length} posts`);

    let commentIndex = 0;

    for (const postUrl of postLinks) {
      if (result.likes >= remaining.likes && result.comments >= remaining.comments) break;

      try {
        await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(3000);

        // Extract author from URL (threads.net/@username/post/...)
        const urlMatch = postUrl.match(/threads\.net\/@([^/]+)\/post/);
        const author = urlMatch?.[1] ?? 'unknown';

        // Skip own accounts
        if (OWN_ACCOUNTS.some(a => author.toLowerCase() === a.toLowerCase())) {
          console.log('[threads-outbound] Skipping own post');
          continue;
        }

        // Like the post
        if (result.likes < remaining.likes) {
          const liked = await likeThreadsPost(page);
          if (liked) {
            result.likes++;
            await recordOutboundEngagement({
              actionType: 'like',
              platform: 'threads',
              targetUsername: author,
              targetPostUrl: postUrl,
              targetHashtag: query,
            });
            console.log(`[threads-outbound] Liked post by @${author} (${result.likes}/${remaining.likes})`);
          }
          await jitteredSleep(LIMITS.minDelayBetweenActions);
        }

        // Comment on first post only
        if (result.comments < remaining.comments && commentIndex === 0) {
          const comment = COMMENT_TEMPLATES[Math.floor(Math.random() * COMMENT_TEMPLATES.length)];
          const commented = await replyToThreadsPost(page, comment);
          if (commented) {
            result.comments++;
            await recordOutboundEngagement({
              actionType: 'comment',
              platform: 'threads',
              targetUsername: author,
              targetPostUrl: postUrl,
              targetHashtag: query,
              commentText: comment,
            });
            console.log(`[threads-outbound] Replied to @${author}: "${comment}"`);
          }
          await jitteredSleep(LIMITS.minDelayBetweenActions * 2);
        }

        commentIndex++;
      } catch (err) {
        result.errors++;
        console.warn('[threads-outbound] Error on post:', err instanceof Error ? err.message : err);
      }
    }
  } finally {
    await context.close();
  }

  console.log(
    `[threads-outbound] Session complete: ${result.likes} likes, ${result.comments} comments, ${result.errors} errors`,
  );
  return result;
}

// --- Browser helpers ---

async function likeThreadsPost(page: Page): Promise<boolean> {
  try {
    // Threads uses svg[aria-label="Like"] similar to Instagram
    const likeBtn = page.locator('svg[aria-label="Like"]').first();
    if (!(await likeBtn.isVisible({ timeout: 3000 }).catch(() => false))) return false;

    await likeBtn.click();
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;
  }
}

async function replyToThreadsPost(page: Page, text: string): Promise<boolean> {
  try {
    // Click reply icon to open reply input
    const replyIcon = page.locator('svg[aria-label="Reply"]').first();
    if (await replyIcon.isVisible({ timeout: 3000 }).catch(() => false)) {
      await replyIcon.click();
      await page.waitForTimeout(1500);
    }

    // Look for the reply text area (contenteditable or textarea)
    const replyInput = page.locator('[contenteditable="true"]').first()
      .or(page.locator('textarea').first());

    if (!(await replyInput.isVisible({ timeout: 3000 }).catch(() => false))) return false;

    await replyInput.click();
    await page.waitForTimeout(500);
    await page.keyboard.type(text, { delay: 20 });
    await page.waitForTimeout(1000);

    // Click Post button
    const postBtn = page.getByText('Post', { exact: true }).last();
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
