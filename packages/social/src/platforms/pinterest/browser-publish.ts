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
  messageContent?: string;
  messageTo?: string;
  messageFrom?: string;
  utmUrl?: string;
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

  // Build link to message page (with UTM if available)
  const messageId = options.messageIds?.[0];
  const pinUrl = options.utmUrl ?? (messageId
    ? `https://wordsleftunsent.com/messages/${messageId}`
    : 'https://wordsleftunsent.com');

  // Build pin description from message content (not IG caption)
  const quote = options.messageContent ?? options.caption.split('\n')[0];
  const header = options.messageTo ? `To ${options.messageTo},\n\n` : '';
  const attribution = options.messageFrom ? `\n\n— ${options.messageFrom}` : '';
  const pinDescription = `${header}"${quote}"${attribution}\n\nRead more at wordsleftunsent.com`;

  if (options.dryRun) {
    console.log('[pinterest-publish] [DRY RUN] Would create pin:');
    console.log(`  Image: ${imagePath}`);
    console.log(`  Description: "${pinDescription.slice(0, 100)}..."`);
    console.log(`  Link: ${pinUrl}`);
    return { postId: 'dry-run', platformPostId: null };
  }

  console.log('[pinterest-publish] Launching browser...');
  const { context, page } = await launchPinterest();

  try {
    console.log('[pinterest-publish] Creating pin...');
    await createPin(page, imagePath, pinDescription, pinUrl);

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

  // Enter title — use placeholder text to find input
  console.log('[pinterest-publish] Adding title...');
  const titleInput = page.locator('input[placeholder="Add a title"], textarea[id="pin-draft-title"], input[id="pin-draft-title"]').first();
  if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await titleInput.click();
    const title = description.split('\n')[0].slice(0, 100);
    await page.keyboard.type(title, { delay: 15 });
    await page.waitForTimeout(500);
    console.log(`[pinterest-publish] Title set: "${title.slice(0, 50)}..."`);
  }

  // Enter description
  console.log('[pinterest-publish] Adding description...');
  const descInput = page.locator('div[data-placeholder="Add a detailed description"]')
    .or(page.locator('textarea[id="pin-draft-description"]'))
    .or(page.locator('div[contenteditable="true"]'))
    .first();
  if (await descInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await descInput.click();
    await page.keyboard.type(description, { delay: 10 });
    await page.waitForTimeout(500);
  }

  // Enter destination URL
  console.log('[pinterest-publish] Adding destination URL...');
  const urlInput = page.locator('input[placeholder*="link"], input[id="pin-draft-link"], input[aria-label*="link"]').first();
  if (await urlInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await urlInput.click();
    await urlInput.fill(destinationUrl);
    await page.waitForTimeout(500);
  }

  // Select board — required for publishing.
  // Pinterest's board picker is a custom dropdown, not a standard <select>.
  console.log('[pinterest-publish] Selecting board...');
  const boardSelect = page.getByText('Choose a board').first()
    .or(page.locator('[data-test-id="board-dropdown"]').first());
  if (await boardSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await boardSelect.click({ force: true });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/pinterest-board-picker.png' }).catch(() => {});

    // Look for an existing board or create one
    const existingBoard = page.getByText('Unsent Letters', { exact: false }).first();
    if (await existingBoard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await existingBoard.click();
      console.log('[pinterest-publish] Selected existing board: Unsent Letters');
    } else {
      // Create new board
      const createBoard = page.getByText('Create board', { exact: false }).first();
      if (await createBoard.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createBoard.click();
        await page.waitForTimeout(1000);
        const boardNameInput = page.locator('input[placeholder*="board name" i], input[id*="boardName"], input[name*="board"]').first();
        if (await boardNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await boardNameInput.fill('Unsent Letters');
          await page.waitForTimeout(500);
          const createBtn = page.getByRole('button', { name: /^Create$/i }).first();
          if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await createBtn.click({ force: true });
            await page.waitForTimeout(2000);
            console.log('[pinterest-publish] Created new board: Unsent Letters');
          }
        }
      } else {
        // No boards at all — just click the first option if any
        const anyBoard = page.locator('[data-test-id="board-row"]').first();
        if (await anyBoard.isVisible({ timeout: 2000 }).catch(() => false)) {
          await anyBoard.click();
          console.log('[pinterest-publish] Selected first available board');
        }
      }
    }
    await page.waitForTimeout(1000);
  } else {
    console.log('[pinterest-publish] Board dropdown not found, may use default');
  }

  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/pinterest-pre-publish.png' }).catch(() => {});

  // Click Publish
  console.log('[pinterest-publish] Clicking Publish...');
  const publishBtn = page.getByRole('button', { name: /^Publish$/i }).first();
  await publishBtn.click({ timeout: 10000, force: true });

  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/pinterest-post-result.png' }).catch(() => {});
  console.log('[pinterest-publish] Pin published');
}
