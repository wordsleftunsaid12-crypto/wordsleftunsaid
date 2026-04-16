import type { Page } from 'playwright';
import { createPost, getPostCountToday, updateContentQueueStatus } from '@wlu/shared';
import { launchThreads } from './browser.js';

const MAX_POSTS_PER_DAY = 6;

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
  messageContent?: string;
  messageTo?: string;
  messageFrom?: string;
  utmUrl?: string;
}): Promise<ThreadsPublishResult> {
  const todayCount = await getPostCountToday('threads');
  if (todayCount >= MAX_POSTS_PER_DAY) {
    throw new Error(
      `Daily posting limit reached (${MAX_POSTS_PER_DAY}). Posted ${todayCount} today.`,
    );
  }

  // Build thread text — message quote + link
  const messageId = options.messageIds?.[0];
  const link = options.utmUrl ?? (messageId
    ? `https://wordsleftunsent.com/messages/${messageId}`
    : 'https://wordsleftunsent.com');

  // Threads has a 500-character limit. Build the text and truncate the quote if needed.
  const THREADS_CHAR_LIMIT = 500;
  const header = options.messageTo ? `To ${options.messageTo},\n\n` : '';
  const attribution = options.messageFrom ? `\n\n— ${options.messageFrom}` : '';
  const suffix = `${attribution}\n\n${link}`;
  const overhead = header.length + suffix.length + 2; // +2 for quote marks
  const maxQuoteLen = Math.max(80, THREADS_CHAR_LIMIT - overhead);

  const rawQuote = options.messageContent ?? options.caption.split('\n')[0];
  const truncatedQuote = rawQuote.length > maxQuoteLen
    ? rawQuote.slice(0, maxQuoteLen - 3) + '...'
    : rawQuote;
  const threadText = `${header}"${truncatedQuote}"${suffix}`;

  if (options.dryRun) {
    console.log('[threads-publish] [DRY RUN] Would post:');
    console.log(`  "${threadText}"`);
    return { postId: 'dry-run', platformPostId: null };
  }

  console.log('[threads-publish] Launching browser...');
  const { context, page } = await launchThreads();

  try {
    console.log('[threads-publish] Composing thread...');
    await composeThread(page, threadText, options.coverImagePath);

    console.log('[threads-publish] Thread posted successfully!');

    // Extract post URL from profile (newest thread = first post link)
    let platformPostUrl: string | undefined;
    try {
      await page.goto('https://www.threads.net/@u.wordsleftunsent', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.waitForTimeout(5000);
      const firstPost = page.locator('a[href*="/post/"]').first();
      const href = await firstPost.getAttribute('href', { timeout: 5000 }).catch(() => null);
      if (href) {
        platformPostUrl = href.startsWith('http') ? href : `https://www.threads.net${href}`;
        console.log(`[threads-publish] Extracted post URL: ${platformPostUrl}`);
      }
    } catch {
      console.warn('[threads-publish] Could not extract post URL from profile');
    }

    const post = await createPost({
      platform: 'threads',
      contentQueueId: options.contentQueueId,
      messageIds: options.messageIds ?? [],
      caption: threadText,
      template: options.template,
      mood: options.mood,
      postType: 'feed',
      isExploration: options.isExploration,
      platformPostUrl,
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
export async function composeThread(page: Page, text: string, imagePath?: string): Promise<void> {
  // Click the create/compose button
  const createBtn = page
    .locator('[aria-label="Create"], [aria-label="New thread"], svg[aria-label="Create"]')
    .first();
  await createBtn.click({ timeout: 10000 });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/tmp/threads-compose.png' }).catch(() => {});

  // Attach image if provided
  if (imagePath) {
    console.log(`[threads-publish] Attaching image: ${imagePath}`);
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(imagePath);
    await page.waitForTimeout(3000);
    console.log('[threads-publish] Image attached');
  }

  // Type in the compose area
  const composeArea = page
    .locator('div[contenteditable="true"][role="textbox"]')
    .or(page.locator('p[data-placeholder]'))
    .first();
  await composeArea.click({ timeout: 10000 });
  await page.waitForTimeout(500);

  await page.keyboard.type(text, { delay: 15 });
  await page.waitForTimeout(1000);

  // Check character count — Threads shows a negative number when over-limit
  const charCounter = page.locator('span').filter({ hasText: /^-\d+$/ }).first();
  const isOverLimit = await charCounter.isVisible({ timeout: 1000 }).catch(() => false);
  if (isOverLimit) {
    const countText = await charCounter.textContent().catch(() => '');
    await page.screenshot({ path: '/tmp/threads-over-limit.png' }).catch(() => {});
    // Close the compose dialog
    const cancelBtn = page.getByText('Cancel', { exact: true }).first();
    await cancelBtn.click({ timeout: 3000 }).catch(() => {});
    throw new Error(
      `Thread text exceeds character limit (${countText} chars over). Screenshot: /tmp/threads-over-limit.png`,
    );
  }

  // Click Post button
  const postBtn = page
    .getByRole('button', { name: /^Post$/i })
    .first();
  const postFallback = page.locator('[data-testid="post-button"]').first();
  const actualPostBtn = (await postBtn.isVisible({ timeout: 3000 }).catch(() => false))
    ? postBtn
    : postFallback;
  await actualPostBtn.click({ timeout: 10000 });

  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/threads-post-result.png' }).catch(() => {});

  // Verify the compose dialog closed — if still open, the post failed
  const composeStillOpen = await page
    .locator('div[contenteditable="true"][role="textbox"]')
    .first()
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  if (composeStillOpen) {
    throw new Error(
      'Thread may not have posted — compose dialog still open. Screenshot: /tmp/threads-post-result.png',
    );
  }
  console.log('[threads-publish] Thread posted');
}
