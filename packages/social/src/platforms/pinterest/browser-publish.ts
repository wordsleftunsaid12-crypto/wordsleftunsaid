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
  // Pinterest's board picker opens as a dropdown with Search + "Create board".
  console.log('[pinterest-publish] Selecting board...');
  const boardDropdown = page.locator('button:has-text("Choose a board"), [data-test-id="board-dropdown"], div:has-text("Choose a board") >> visible=true').first();
  if (await boardDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
    await boardDropdown.click({ force: true });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/pinterest-board-picker.png' }).catch(() => {});

    // Type board name in the search box to filter
    const searchInput = page.locator('input[placeholder="Search"]').first();
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('Unsent Letters');
      await page.waitForTimeout(1500);
    }

    // Check if "Unsent Letters" board appears in results
    const existingBoard = page.getByText('Unsent Letters', { exact: false }).first();
    if (await existingBoard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await existingBoard.click();
      console.log('[pinterest-publish] Selected existing board: Unsent Letters');
    } else {
      // Board doesn't exist — create it
      console.log('[pinterest-publish] Board not found, creating "Unsent Letters"...');
      const createBoard = page.getByText('Create board', { exact: false }).first();
      if (await createBoard.isVisible({ timeout: 3000 }).catch(() => false)) {
        await createBoard.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: '/tmp/pinterest-create-board.png' }).catch(() => {});

        // The create-board dialog may pre-fill with search text or show an input
        // Try multiple selectors for the board name input
        const boardInput = page.locator('input[type="text"]').last();
        if (await boardInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await boardInput.clear();
          await boardInput.fill('Unsent Letters');
          await page.waitForTimeout(500);
        }

        // Click Create button
        const createBtn = page.getByRole('button', { name: /Create/i }).first();
        if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await createBtn.click({ force: true });
          await page.waitForTimeout(3000);
          console.log('[pinterest-publish] Created board: Unsent Letters');
        } else {
          console.warn('[pinterest-publish] Create button not found');
        }
      } else {
        console.warn('[pinterest-publish] Create board option not found');
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
