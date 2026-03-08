import type { Page } from 'playwright';
import { createPost, getPostCountToday, updateContentQueueStatus } from '@wlu/shared';
import { launchTwitter } from './browser.js';

const MAX_POSTS_PER_DAY = 3;

interface TwitterPublishResult {
  postId: string;
  platformPostId: string | null;
}

/**
 * Publish a tweet/post to X/Twitter with the message quote + link.
 */
export async function browserPublishTwitter(options: {
  videoPath: string;
  coverImagePath?: string;
  caption: string;
  contentQueueId?: string;
  messageIds?: string[];
  template?: string;
  mood?: string;
  isExploration?: boolean;
  dryRun?: boolean;
}): Promise<TwitterPublishResult> {
  const todayCount = await getPostCountToday('twitter');
  if (todayCount >= MAX_POSTS_PER_DAY) {
    throw new Error(
      `Daily posting limit reached (${MAX_POSTS_PER_DAY}). Posted ${todayCount} today.`,
    );
  }

  // Build tweet text — short quote + link
  const messageId = options.messageIds?.[0];
  const link = messageId
    ? `https://wordsleftunsent.com/messages/${messageId}`
    : 'https://wordsleftunsent.com';

  // Extract a short quote from the caption (first line, truncated)
  const firstLine = options.caption.split('\n')[0].slice(0, 200);
  const tweetText = `${firstLine}\n\n${link}`;

  if (options.dryRun) {
    console.log('[twitter-publish] [DRY RUN] Would tweet:');
    console.log(`  "${tweetText}"`);
    return { postId: 'dry-run', platformPostId: null };
  }

  console.log('[twitter-publish] Launching browser...');
  const { context, page } = await launchTwitter();

  try {
    console.log('[twitter-publish] Composing tweet...');
    await composeTweet(page, tweetText);

    console.log('[twitter-publish] Tweet posted successfully!');

    const post = await createPost({
      platform: 'twitter',
      contentQueueId: options.contentQueueId,
      messageIds: options.messageIds ?? [],
      caption: tweetText,
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
 * Compose and post a tweet via X's web UI.
 */
async function composeTweet(page: Page, text: string): Promise<void> {
  // Make sure we're on the home page
  if (!page.url().includes('/home')) {
    await page.goto('https://x.com/home', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);
  }

  // Click the compose area
  const composeArea = page
    .locator('[data-testid="tweetTextarea_0"]')
    .or(page.locator('div[role="textbox"][data-testid]'))
    .first();
  await composeArea.click({ timeout: 10000 });
  await page.waitForTimeout(500);

  // Type the tweet
  await page.keyboard.type(text, { delay: 15 });
  await page.waitForTimeout(1000);

  // Click Post button
  const postBtn = page
    .locator('[data-testid="tweetButtonInline"]')
    .or(page.locator('[data-testid="tweetButton"]'))
    .first();
  await postBtn.click({ timeout: 10000 });

  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/twitter-post-result.png' }).catch(() => {});
  console.log('[twitter-publish] Tweet posted');
}
