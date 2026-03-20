import type { Page } from 'playwright';
import { resolve, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createPost, getPostCountToday, updateContentQueueStatus } from '@wlu/shared';
import { launchPinterest } from './browser.js';

const execFileAsync = promisify(execFile);
const MAX_POSTS_PER_DAY = 3;
const PINTEREST_BOARD_NAME = 'Unsent Letters';

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

  // Pinterest needs an image — use cover frame or extract from video
  let imagePath = options.coverImagePath
    ? resolve(options.coverImagePath)
    : null;

  if (!imagePath || !existsSync(imagePath)) {
    // Auto-extract cover from video if available
    const videoPath = options.videoPath ? resolve(options.videoPath) : null;
    if (videoPath && existsSync(videoPath)) {
      const autocover = videoPath.replace(/\.mp4$/i, '-cover.png');
      console.log('[pinterest-publish] No cover image found, extracting from video...');
      // Extract at ~0.67s (frame 20 at 30fps) to get past the loop fade-in from black
      await execFileAsync('ffmpeg', ['-y', '-ss', '0.67', '-i', videoPath, '-vframes', '1', '-q:v', '1', autocover]);
      imagePath = autocover;
      console.log(`[pinterest-publish] Cover extracted: ${basename(autocover)}`);
    } else {
      throw new Error(
        'Pinterest requires a cover image (PNG). No coverImagePath or videoPath provided, or files not found.',
      );
    }
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
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/tmp/pinterest-create-pin.png' }).catch(() => {});

  // 1. Upload image FIRST — use filechooser event since Pinterest uses a
  //    drag-and-drop zone without a standard <input type="file"> element.
  console.log('[pinterest-publish] Uploading image...');

  // Try the standard file input first (may exist as hidden element)
  const fileInput = page.locator('input[type="file"]').first();
  const hasFileInput = await fileInput.count() > 0;

  if (hasFileInput) {
    await fileInput.setInputFiles(imagePath);
  } else {
    // Click the upload area and handle the file chooser dialog
    const uploadArea = page.locator('[data-test-id="storyboard-upload-input"]').first();
    const uploadZone = page.locator('button:has-text("Choose a file"), div:has-text("Choose a file")').first();
    const uploadTarget = (await uploadArea.isVisible({ timeout: 2000 }).catch(() => false))
      ? uploadArea
      : uploadZone;

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 10000 }),
      uploadTarget.click({ timeout: 10000 }),
    ]);
    await fileChooser.setFiles(imagePath);
  }

  console.log(`[pinterest-publish] File selected: ${basename(imagePath)}`);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/pinterest-after-upload.png' }).catch(() => {});

  // 2. Enter title
  console.log('[pinterest-publish] Adding title...');
  const titleInput = page.locator('input[placeholder*="title" i], [data-test-id="pin-draft-title"]').first();
  if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await titleInput.click();
    const title = description.split('\n')[0].slice(0, 100);
    await page.keyboard.type(title, { delay: 15 });
    await page.waitForTimeout(500);
    console.log(`[pinterest-publish] Title set: "${title.slice(0, 50)}..."`);
  }

  // 3. Enter description
  console.log('[pinterest-publish] Adding description...');
  const descInput = page.locator('div[contenteditable="true"], textarea[placeholder*="description" i], [data-test-id="pin-draft-description"]').first();
  if (await descInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await descInput.click();
    await page.keyboard.type(description.slice(0, 500), { delay: 10 });
    await page.waitForTimeout(500);
  }

  // 4. Enter destination URL
  console.log('[pinterest-publish] Adding destination URL...');
  const urlInput = page.locator('input[placeholder*="link" i], input[aria-label*="link" i], [data-test-id="pin-draft-link"]').first();
  if (await urlInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await urlInput.click();
    await urlInput.fill(destinationUrl);
    await page.waitForTimeout(500);
  }

  // 5. Select board — required before publishing
  console.log('[pinterest-publish] Selecting board...');
  await selectBoard(page);

  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/pinterest-pre-publish.png' }).catch(() => {});

  // 6. Click Publish — scroll to top first (Publish button is at top-right)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  console.log('[pinterest-publish] Clicking Publish...');
  const publishByRole = page.getByRole('button', { name: /^Publish$/i }).first();
  const publishByText = page.locator('button:has-text("Publish")').first();
  const publishByTestId = page.locator('[data-test-id="board-dropdown-save-button"]').first();

  let published = false;
  for (const btn of [publishByRole, publishByText, publishByTestId]) {
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click({ force: true });
      published = true;
      console.log('[pinterest-publish] Clicked Publish button');
      break;
    }
  }

  if (!published) {
    await page.screenshot({ path: '/tmp/pinterest-publish-failed.png' }).catch(() => {});
    throw new Error(
      'Pinterest Publish button not found. Screenshot: /tmp/pinterest-publish-failed.png',
    );
  }

  await page.waitForTimeout(6000);
  await page.screenshot({ path: '/tmp/pinterest-post-result.png' }).catch(() => {});

  // After a successful publish, Pinterest either:
  // 1. Navigates to the pin page (URL contains /pin/)
  // 2. Stays on pin-creation-tool but resets the form (title is empty)
  // Check both to determine success.
  const finalUrl = page.url();
  if (finalUrl.includes('/pin/')) {
    console.log('[pinterest-publish] Pin published (navigated to pin page)');
    return;
  }

  // Pinterest often stays on pin-creation-tool after publish — the form
  // resets to empty. Check if the title input is now empty as proof.
  const titleAfter = await page
    .locator('input[placeholder*="title" i]')
    .first()
    .inputValue()
    .catch(() => '');
  if (titleAfter === '') {
    console.log('[pinterest-publish] Pin published (form reset — confirmed)');
    return;
  }

  throw new Error(
    'Pinterest pin may have been saved as draft — form not reset. Screenshot: /tmp/pinterest-post-result.png',
  );
}

/**
 * Select the "Unsent Letters" board.
 * Must be done before publishing — Pinterest saves as draft without a board.
 *
 * IMPORTANT: The board must already exist. Creating a board from the
 * pin-creation-tool navigates away from the page, losing the pin.
 * The board should be created once manually or via the Create → Board flow.
 *
 * The board picker opens as a popover with a search input. CRITICAL: Do NOT
 * use `input[placeholder*="Search"]` — it matches the GLOBAL Pinterest
 * search bar (top of page), not the popover's search. Instead, look for
 * the board name in the popover's list or use keyboard to type in the
 * focused search within the popover.
 */
async function selectBoard(page: Page): Promise<void> {
  // Scroll down to make the board dropdown visible
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  // Click the "Choose a board" dropdown
  const dropdownSelectors = [
    '[data-test-id="board-dropdown-select-button"]',
    'div:has-text("Choose a board") >> nth=0',
    'button:has-text("Choose a board")',
  ];

  let dropdownFound = false;
  for (const sel of dropdownSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click({ force: true });
      dropdownFound = true;
      console.log('[pinterest-publish] Board dropdown opened');
      break;
    }
  }

  if (!dropdownFound) {
    console.warn('[pinterest-publish] Board dropdown not found — may use default');
    await page.screenshot({ path: '/tmp/pinterest-no-board-dropdown.png' }).catch(() => {});
    return;
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/pinterest-board-picker.png' }).catch(() => {});

  // The popover shows "All boards" with our board listed. Try clicking it
  // directly — no need to search if it's already visible.
  const boardResult = page.getByText(PINTEREST_BOARD_NAME, { exact: true }).first();
  if (await boardResult.isVisible({ timeout: 2000 }).catch(() => false)) {
    await boardResult.click({ force: true });
    console.log('[pinterest-publish] Selected board: Unsent Letters (direct click)');
    await page.waitForTimeout(1000);
    return;
  }

  // Board not immediately visible — type in the popover's search via
  // keyboard (NOT input.fill() which hits the global search bar).
  console.log('[pinterest-publish] Board not visible in list, typing to filter...');
  await page.keyboard.type(PINTEREST_BOARD_NAME, { delay: 30 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/pinterest-board-typed.png' }).catch(() => {});

  if (await boardResult.isVisible({ timeout: 3000 }).catch(() => false)) {
    await boardResult.click({ force: true });
    console.log('[pinterest-publish] Selected board: Unsent Letters (after search)');
    await page.waitForTimeout(1000);
    return;
  }

  // Board not found — close popover and throw
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/pinterest-board-not-found.png' }).catch(() => {});
  throw new Error(
    `Pinterest board "${PINTEREST_BOARD_NAME}" not found. Create it first via Pinterest UI. Screenshot: /tmp/pinterest-board-not-found.png`,
  );
}
