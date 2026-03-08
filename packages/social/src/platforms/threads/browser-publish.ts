import type { Page } from 'playwright';
import { createPost, getPostCountToday, updateContentQueueStatus } from '@wlu/shared';
import { launchThreads } from './browser.js';

const MAX_POSTS_PER_DAY = 3;

interface ThreadsPublishResult {
  postId: string;
  platformPostId: string | null;
}

/**
 * Publish a text post to Threads with the message quote + link.
 */
export async function browserPublishThreads(options: {
  videoPath: string;
  coverImagePath?: string;
  caption: string;
  contentQueueId?: string;
  messageIds?: string[];
  template?: string;
  mood?: string;
  isExploration?: boolean;
  dryRun?: boolean;
}): Promise<ThreadsPublishResult> {
  const todayCount = await getPostCountToday('threads');
  if (todayCount >= MAX_POSTS_PER_DAY) {
    throw new Error(
      `Daily posting limit reached (${MAX_POSTS_PER_DAY}). Posted ${todayCount} today.`,
    );
  }

  // Build thread text — short quote + link
  const messageId = options.messageIds?.[0];
  const link = messageId
    ? `https://wordsleftunsaid.netlify.app/messages/${messageId}`
    : 'https://wordsleftunsaid.netlify.app';

  const firstLine = options.caption.split('\n')[0].slice(0, 400);
  const threadText = `${firstLine}\n\n${link}`;

  if (options.dryRun) {
    console.log('[threads-publish] [DRY RUN] Would post:');
    console.log(`  "${threadText}"`);
    return { postId: 'dry-run', platformPostId: null };
  }

  console.log('[threads-publish] Launching browser...');
  const { context, page } = await launchThreads();

  try {
    console.log('[threads-publish] Composing thread...');
    await composeThread(page, threadText);

    console.log('[threads-publish] Thread posted successfully!');

    const post = await createPost({
      platform: 'threads',
      contentQueueId: options.contentQueueId,
      messageIds: options.messageIds ?? [],
      caption: threadText,
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
 * Compose and post a thread via Threads' web UI.
 */
async function composeThread(page: Page, text: string): Promise<void> {
  // Click the create/compose button
  const createBtn = page
    .locator('[aria-label="Create"], [aria-label="New thread"], svg[aria-label="Create"]')
    .first();
  await createBtn.click({ timeout: 10000 });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/tmp/threads-compose.png' }).catch(() => {});

  // Type in the compose area
  const composeArea = page
    .locator('div[contenteditable="true"][role="textbox"]')
    .or(page.locator('p[data-placeholder]'))
    .first();
  await composeArea.click({ timeout: 10000 });
  await page.waitForTimeout(500);

  await page.keyboard.type(text, { delay: 15 });
  await page.waitForTimeout(1000);

  // Click Post button
  const postBtn = page
    .getByRole('button', { name: /^Post$/i })
    .or(page.locator('[data-testid="post-button"]'))
    .first();
  await postBtn.click({ timeout: 10000 });

  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/threads-post-result.png' }).catch(() => {});
  console.log('[threads-publish] Thread posted');
}
