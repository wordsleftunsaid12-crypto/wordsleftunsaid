import type { Page } from 'playwright';
import { resolve, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { createPost, getPostCountToday, updateContentQueueStatus } from '@wlu/shared';
import { launchPinterest } from './browser.js';

const MAX_POSTS_PER_DAY = 3;

interface PinterestPublishResult {
  postId: string;
  platformPostId: string | null;
}

/**
 * Publish an image pin to Pinterest using the cover frame.
 * Pins link back to the message page on the website.
 */
export async function browserPublishPinterest(options: {
  videoPath: string;
  coverImagePath?: string;
  caption: string;
  contentQueueId?: string;
  messageIds?: string[];
  template?: string;
  mood?: string;
  isExploration?: boolean;
  dryRun?: boolean;
}): Promise<PinterestPublishResult> {
  const todayCount = await getPostCountToday('pinterest');
  if (todayCount >= MAX_POSTS_PER_DAY) {
    throw new Error(
      `Daily posting limit reached (${MAX_POSTS_PER_DAY}). Posted ${todayCount} today.`,
    );
  }

  // Pinterest needs an image — use cover frame or fall back to video path
  const imagePath = options.coverImagePath
    ? resolve(options.coverImagePath)
    : null;

  if (!imagePath || !existsSync(imagePath)) {
    throw new Error(
      'Pinterest requires a cover image (PNG). No coverImagePath provided or file not found.',
    );
  }

  // Build link to message page
  const messageId = options.messageIds?.[0];
  const pinUrl = messageId
    ? `https://wordsleftunsent.com/messages/${messageId}`
    : 'https://wordsleftunsent.com';

  if (options.dryRun) {
    console.log('[pinterest-publish] [DRY RUN] Would create pin:');
    console.log(`  Image: ${imagePath}`);
    console.log(`  Caption: "${options.caption.slice(0, 100)}..."`);
    console.log(`  Link: ${pinUrl}`);
    return { postId: 'dry-run', platformPostId: null };
  }

  console.log('[pinterest-publish] Launching browser...');
  const { context, page } = await launchPinterest();

  try {
    console.log('[pinterest-publish] Creating pin...');
    await createPin(page, imagePath, options.caption, pinUrl);

    console.log('[pinterest-publish] Pin created successfully!');

    const post = await createPost({
      platform: 'pinterest',
      contentQueueId: options.contentQueueId,
      messageIds: options.messageIds ?? [],
      caption: options.caption,
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
 * Create a pin via Pinterest's web UI.
 */
async function createPin(
  page: Page,
  imagePath: string,
  description: string,
  destinationUrl: string,
): Promise<void> {
  // Navigate to pin creation page
  await page.goto('https://www.pinterest.com/pin-creation-tool/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: '/tmp/pinterest-create-pin.png' }).catch(() => {});

  // Upload image
  console.log('[pinterest-publish] Uploading image...');
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(imagePath);
  console.log(`[pinterest-publish] File selected: ${basename(imagePath)}`);
  await page.waitForTimeout(3000);

  // Enter title (use a short excerpt)
  const titleInput = page.locator('textarea[id="pin-draft-title"], input[id="pin-draft-title"]').first();
  if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await titleInput.click();
    const title = description.split('\n')[0].slice(0, 100);
    await page.keyboard.type(title, { delay: 15 });
    await page.waitForTimeout(500);
  }

  // Enter description
  console.log('[pinterest-publish] Adding description...');
  const descInput = page
    .locator('textarea[id="pin-draft-description"], div[contenteditable="true"]')
    .first();
  if (await descInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await descInput.click();
    await page.keyboard.type(description, { delay: 10 });
    await page.waitForTimeout(500);
  }

  // Enter destination URL
  console.log('[pinterest-publish] Adding destination URL...');
  const urlInput = page
    .locator('input[id="pin-draft-link"], input[placeholder*="link"], input[aria-label*="link"]')
    .first();
  if (await urlInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await urlInput.click();
    await page.keyboard.type(destinationUrl, { delay: 10 });
    await page.waitForTimeout(500);
  }

  // Select board (or let it default to "Words Left Unsaid" if it exists)
  // Pinterest defaults to the last-used board

  // Click Publish
  console.log('[pinterest-publish] Clicking Publish...');
  const publishBtn = page
    .getByRole('button', { name: /publish/i })
    .or(page.locator('button[data-test-id="board-dropdown-save-button"]'))
    .first();
  await publishBtn.click({ timeout: 10000 });

  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/pinterest-post-result.png' }).catch(() => {});
  console.log('[pinterest-publish] Pin published');
}
