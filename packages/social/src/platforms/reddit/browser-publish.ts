import type { Page } from 'playwright';
import { createPost, getPostCountToday, updateContentQueueStatus } from '@wlu/shared';
import { launchReddit } from './browser.js';

const MAX_POSTS_PER_DAY = 1; // Reddit is strict — keep volume very low

interface RedditPublishResult {
  postId: string;
  platformPostId: string | null;
}

/** Target subreddits for posting, in priority order. */
const TARGET_SUBREDDITS = [
  'UnsentLetters',
  'offmychest',
  'TrueOffMyChest',
];

/**
 * Publish a text post to Reddit with the message content.
 * Posts to one subreddit per invocation (round-robin style based on day).
 */
export async function browserPublishReddit(options: {
  videoPath: string;
  coverImagePath?: string;
  caption: string;
  contentQueueId?: string;
  messageIds?: string[];
  template?: string;
  mood?: string;
  isExploration?: boolean;
  dryRun?: boolean;
  /** The message content to post (used as the post body). */
  messageContent?: string;
  /** The "To" field from the message. */
  messageTo?: string;
}): Promise<RedditPublishResult> {
  const todayCount = await getPostCountToday('reddit');
  if (todayCount >= MAX_POSTS_PER_DAY) {
    throw new Error(
      `Daily posting limit reached (${MAX_POSTS_PER_DAY}). Posted ${todayCount} today.`,
    );
  }

  // Pick subreddit (rotate by day of month)
  const dayOfMonth = new Date().getDate();
  const subreddit = TARGET_SUBREDDITS[dayOfMonth % TARGET_SUBREDDITS.length];

  // Use message content if provided, otherwise extract from caption
  const title = options.messageTo
    ? `To ${options.messageTo}`
    : 'Words left unsaid';

  const body = options.messageContent ?? options.caption;
  const footer = '\n\n---\n*Read more anonymous messages at [wordsleftunsaid.netlify.app](https://wordsleftunsaid.netlify.app)*';

  if (options.dryRun) {
    console.log('[reddit-publish] [DRY RUN] Would post to r/' + subreddit);
    console.log(`  Title: ${title}`);
    console.log(`  Body: "${body.slice(0, 100)}..."`);
    return { postId: 'dry-run', platformPostId: null };
  }

  console.log(`[reddit-publish] Posting to r/${subreddit}...`);

  const { context, page } = await launchReddit();

  try {
    await submitTextPost(page, subreddit, title, body + footer);

    console.log('[reddit-publish] Post submitted successfully!');

    const post = await createPost({
      platform: 'reddit',
      contentQueueId: options.contentQueueId,
      messageIds: options.messageIds ?? [],
      caption: body,
      template: options.template,
      mood: options.mood,
      postType: 'feed',
      isExploration: options.isExploration,
    });

    if (options.contentQueueId) {
      await updateContentQueueStatus(options.contentQueueId, 'posted');
    }

    return {
      postId: post.id,
      platformPostId: null,
    };
  } finally {
    await context.close();
  }
}

/**
 * Submit a text post to a subreddit via Reddit's web UI.
 */
async function submitTextPost(
  page: Page,
  subreddit: string,
  title: string,
  body: string,
): Promise<void> {
  // Navigate to submit page
  await page.goto(`https://www.reddit.com/r/${subreddit}/submit`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  // Check if we're on the new or old Reddit submit page
  await page.screenshot({ path: '/tmp/reddit-submit-page.png' }).catch(() => {});

  // Enter title
  console.log('[reddit-publish] Entering title...');
  const titleInput = page
    .locator('textarea[name="title"], [data-testid="post-title"] textarea, input[aria-label*="Title"]')
    .first();
  await titleInput.click({ timeout: 10000 });
  await page.keyboard.type(title, { delay: 20 });
  await page.waitForTimeout(500);

  // Enter body text
  console.log('[reddit-publish] Entering body...');
  const bodyInput = page
    .locator('div[contenteditable="true"], textarea[name="body"], [data-testid="post-body"] textarea')
    .first();
  await bodyInput.click({ timeout: 10000 });
  await page.keyboard.type(body, { delay: 10 });
  await page.waitForTimeout(1000);

  // Click submit/post
  console.log('[reddit-publish] Clicking Post...');
  const postBtn = page
    .getByRole('button', { name: /^Post$/i })
    .or(page.locator('button[type="submit"]').filter({ hasText: /post/i }))
    .first();
  await postBtn.click({ timeout: 10000 });

  // Wait for navigation to the new post
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/reddit-post-result.png' }).catch(() => {});

  const finalUrl = page.url();
  if (finalUrl.includes('/comments/')) {
    console.log(`[reddit-publish] Post live at: ${finalUrl}`);
  } else {
    console.log('[reddit-publish] Post may have been submitted (check screenshot)');
  }
}
