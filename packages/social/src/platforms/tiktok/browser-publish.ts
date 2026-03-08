import type { Page } from 'playwright';
import { resolve, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { createPost, getPostCountToday, updateContentQueueStatus } from '@wlu/shared';
import { launchTikTok } from './browser.js';

const MAX_POSTS_PER_DAY = 3;

interface TikTokPublishResult {
  postId: string;
  platformPostId: string | null;
}

/**
 * Publish a video to TikTok using Playwright browser automation.
 */
export async function browserPublishTikTok(options: {
  videoPath: string;
  coverImagePath?: string;
  caption: string;
  contentQueueId?: string;
  messageIds?: string[];
  template?: string;
  mood?: string;
  isExploration?: boolean;
  dryRun?: boolean;
}): Promise<TikTokPublishResult> {
  // Enforce daily posting limit
  const todayCount = await getPostCountToday('tiktok');
  if (todayCount >= MAX_POSTS_PER_DAY) {
    throw new Error(
      `Daily posting limit reached (${MAX_POSTS_PER_DAY}). Posted ${todayCount} today.`,
    );
  }

  const absoluteVideoPath = resolve(options.videoPath);
  if (!existsSync(absoluteVideoPath)) {
    throw new Error(`Video file not found: ${absoluteVideoPath}`);
  }

  if (options.dryRun) {
    console.log('[tiktok-publish] [DRY RUN] Would publish video:');
    console.log(`  Video: ${absoluteVideoPath}`);
    console.log(`  Caption: "${options.caption.slice(0, 100)}..."`);
    return { postId: 'dry-run', platformPostId: null };
  }

  console.log('[tiktok-publish] Launching browser...');

  const { context, page } = await launchTikTok();

  try {
    console.log('[tiktok-publish] Starting video upload...');
    const absoluteCoverPath = options.coverImagePath
      ? resolve(options.coverImagePath)
      : undefined;
    await uploadVideo(page, absoluteVideoPath, options.caption, absoluteCoverPath);

    console.log('[tiktok-publish] Video posted successfully!');

    // Record in database
    const post = await createPost({
      platform: 'tiktok',
      contentQueueId: options.contentQueueId,
      messageIds: options.messageIds ?? [],
      caption: options.caption,
      template: options.template,
      mood: options.mood,
      postType: 'reel',
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
 * The core video upload flow via TikTok's Creator Center web UI.
 */
async function uploadVideo(
  page: Page,
  videoPath: string,
  caption: string,
  coverImagePath?: string,
): Promise<void> {
  // 1. Navigate to Creator Center upload page
  console.log('[tiktok-publish] Navigating to Creator Center...');
  await page.goto('https://www.tiktok.com/creator-center/upload?lang=en', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);

  // Sometimes TikTok redirects to a different upload page — handle both
  const currentUrl = page.url();
  if (currentUrl.includes('/tiktokstudio/upload') || currentUrl.includes('/upload')) {
    console.log(`[tiktok-publish] On upload page: ${currentUrl}`);
  }

  // 2. Upload video via file input
  console.log('[tiktok-publish] Uploading video...');
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(videoPath);
  console.log(`[tiktok-publish] File selected: ${basename(videoPath)}`);

  // 3. Wait for video to process (can take up to 3 minutes)
  console.log('[tiktok-publish] Waiting for video processing...');
  await waitForVideoProcessing(page);

  // 4. Dismiss any modal overlays (split window, tips, etc.)
  await dismissUploadModals(page);

  // 5. Dismiss react-joyride tour overlay if present
  await dismissJoyrideTour(page);

  // 6. Enter caption
  console.log('[tiktok-publish] Adding caption...');
  await enterCaption(page, caption);

  // 6b. Set cover image if provided
  if (coverImagePath && existsSync(coverImagePath)) {
    try {
      console.log('[tiktok-publish] Setting cover image...');
      const editCover = page.locator('div[data-e2e="edit_video_cover"]')
        .or(page.getByText('Edit cover', { exact: false }))
        .or(page.locator('[class*="cover"]').filter({ hasText: /cover/i }))
        .first();
      if (await editCover.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editCover.click();
        await page.waitForTimeout(2000);

        // Look for upload button in the cover editor
        const uploadCover = page.getByText('Upload cover', { exact: false })
          .or(page.locator('button').filter({ hasText: /upload/i }))
          .first();
        if (await uploadCover.isVisible({ timeout: 3000 }).catch(() => false)) {
          const [coverChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 10000 }),
            uploadCover.click(),
          ]);
          await coverChooser.setFiles(coverImagePath);
          console.log(`[tiktok-publish] Cover image set: ${basename(coverImagePath)}`);
          await page.waitForTimeout(3000);

          // Confirm
          const saveBtn = page.locator('button').filter({ hasText: /^(save|confirm|done)$/i }).first();
          if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await saveBtn.click();
            await page.waitForTimeout(2000);
          }
        }
      }
    } catch (err) {
      console.warn('[tiktok-publish] Cover image upload failed, continuing without it:', err instanceof Error ? err.message : err);
    }
  }

  // 7. Dismiss any lingering modals (e.g. from cover editor)
  await dismissUploadModals(page);

  // 8. Click Post/Publish
  console.log('[tiktok-publish] Clicking Post...');
  await clickPublish(page);

  // 8. Wait for confirmation
  console.log('[tiktok-publish] Waiting for upload confirmation...');
  await waitForConfirmation(page);
}

/**
 * Wait for TikTok to finish processing the uploaded video.
 * Polls for up to 180 seconds.
 */
async function waitForVideoProcessing(page: Page): Promise<void> {
  const maxWaitMs = 180000;
  const pollInterval = 3000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    // Check if the post button exists and is enabled — means processing is done
    const postBtn = page.locator('button[data-e2e="post_video_button"]');
    if (await postBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      const isDisabled = await postBtn.getAttribute('data-disabled').catch(() => null);
      if (isDisabled !== 'true') {
        console.log('[tiktok-publish] Video processing complete');
        return;
      }
    }

    // Also check for the TUXButton primary (alternative UI)
    const altPostBtn = page.locator('.TUXButton--primary').first();
    if (await altPostBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      console.log('[tiktok-publish] Video processing complete (alt UI)');
      return;
    }

    // Check for error states
    const errorText = await page
      .locator('text=/failed|error|try again/i')
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (errorText) {
      throw new Error('TikTok reported an upload error');
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    if (elapsed % 15 === 0) {
      console.log(`[tiktok-publish] Still processing... (${elapsed}s)`);
    }
    await page.waitForTimeout(pollInterval);
  }

  // If we got here, take a screenshot for debugging
  await page.screenshot({ path: '/tmp/tiktok-processing-timeout.png' }).catch(() => {});
  throw new Error('Video processing timed out after 180 seconds');
}

/**
 * Enter the caption/description in TikTok's content-editable field.
 */
async function enterCaption(page: Page, caption: string): Promise<void> {
  const descriptionInput = page
    .locator('div[contenteditable="true"]')
    .or(page.locator('[data-e2e="upload-caption"]'))
    .first();

  await descriptionInput.click({ timeout: 10000 });
  await page.waitForTimeout(500);

  // Select all existing text and replace
  await page.keyboard.press('Meta+A');
  await page.waitForTimeout(200);

  // Type caption character by character for reliability
  await page.keyboard.type(caption, { delay: 15 });
  await page.waitForTimeout(1000);
}

/**
 * Click the Post/Publish button on TikTok's upload page.
 */
async function clickPublish(page: Page): Promise<void> {
  // Primary: data-e2e attribute
  const postBtn = page.locator('button[data-e2e="post_video_button"]');
  if (await postBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    const isDisabled = await postBtn.getAttribute('data-disabled').catch(() => null);
    if (isDisabled === 'true') {
      console.log('[tiktok-publish] Post button disabled, waiting...');
      await page.waitForTimeout(5000);
    }
    try {
      await postBtn.click({ timeout: 10000 });
    } catch {
      // Modal overlay might be intercepting — force click
      console.log('[tiktok-publish] Click intercepted, force-clicking...');
      await postBtn.click({ force: true, timeout: 10000 });
    }
    return;
  }

  // Fallback: TUXButton primary class
  const altBtn = page.locator('.TUXButton--primary').first();
  if (await altBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    try {
      await altBtn.click({ timeout: 10000 });
    } catch {
      await altBtn.click({ force: true, timeout: 10000 });
    }
    return;
  }

  // Last resort: button with "Post" text
  const textBtn = page.getByRole('button', { name: /^Post$/i }).first();
  await textBtn.click({ force: true, timeout: 10000 });
}

/**
 * Wait for TikTok to confirm the post was published.
 */
async function waitForConfirmation(page: Page): Promise<void> {
  try {
    // Look for "Post now" confirmation button if it appears
    const postNowBtn = page.locator('button').filter({ hasText: /post now/i }).first();
    if (await postNowBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('[tiktok-publish] Clicking "Post now" confirmation...');
      await postNowBtn.click();
      await page.waitForTimeout(3000);
    }
  } catch {
    // No confirmation button needed
  }

  try {
    // Wait for success message
    await page
      .locator('text=/uploaded|published|posted|Your video is being/i')
      .first()
      .waitFor({ timeout: 120000 });
    console.log('[tiktok-publish] Confirmed: Video posted!');
  } catch {
    // Even without confirmation text, wait and check
    console.warn('[tiktok-publish] No explicit confirmation text, waiting 15s...');
    await page.waitForTimeout(15000);

    // Take a screenshot for verification
    await page.screenshot({ path: '/tmp/tiktok-post-result.png' }).catch(() => {});
  }
}

/**
 * Dismiss react-joyride guided tour overlay if present.
 * TikTok shows a walkthrough tour on first visits to the upload page.
 */
async function dismissJoyrideTour(page: Page): Promise<void> {
  const joyrideOverlay = page.locator('#react-joyride-portal .react-joyride__overlay');
  if (!(await joyrideOverlay.isVisible({ timeout: 2000 }).catch(() => false))) {
    return;
  }

  console.log('[tiktok-publish] Dismissing guided tour overlay...');
  await page.screenshot({ path: '/tmp/tiktok-joyride.png' }).catch(() => {});

  // Try "Skip" button first (most common for joyride tours)
  const skipBtn = page.locator('#react-joyride-portal button').filter({ hasText: /skip|close|got it|done/i }).first();
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    const text = await skipBtn.textContent().catch(() => '');
    console.log(`[tiktok-publish] Clicking tour button: "${text?.trim()}"`);
    await skipBtn.click();
    await page.waitForTimeout(1000);
    return;
  }

  // Try clicking the overlay itself to dismiss
  await joyrideOverlay.click({ force: true });
  await page.waitForTimeout(1000);

  // If still present, try clicking through all "Next" steps rapidly
  for (let step = 0; step < 10; step++) {
    const nextBtn = page.locator('#react-joyride-portal button').filter({ hasText: /next|skip|close|done|got it/i }).first();
    if (!(await nextBtn.isVisible({ timeout: 1000 }).catch(() => false))) break;
    await nextBtn.click();
    await page.waitForTimeout(500);
  }

  // Final check — try Escape
  if (await joyrideOverlay.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }
}

/**
 * Dismiss any modal overlays that appear after video upload/processing.
 * Known modals: "Turn on automatic content checks?", split video prompt, tips.
 */
async function dismissUploadModals(page: Page): Promise<void> {
  const maxAttempts = 5;

  for (let i = 0; i < maxAttempts; i++) {
    // Check if any floating portal / modal overlay is blocking
    const overlay = page.locator('[data-floating-ui-portal] .TUXModal-overlay, [data-floating-ui-portal] [class*="modal"]').first();
    if (!(await overlay.isVisible({ timeout: 2000 }).catch(() => false))) {
      break;
    }

    console.log(`[tiktok-publish] Modal detected (attempt ${i + 1}), dismissing...`);
    await page.screenshot({ path: `/tmp/tiktok-modal-${i}.png` }).catch(() => {});

    // Strategy: click the X close button inside the floating portal
    const closeX = page.locator('[data-floating-ui-portal] [aria-label="Close"]')
      .or(page.locator('[data-floating-ui-portal] svg').locator('..').filter({ hasText: '' }).first());

    // Try "Cancel" or "Turn on" inside the portal — either dismisses the modal
    const portalButtons = page.locator('[data-floating-ui-portal] button');
    const btnCount = await portalButtons.count();

    let dismissed = false;
    for (let b = 0; b < btnCount; b++) {
      const btn = portalButtons.nth(b);
      const text = (await btn.textContent().catch(() => '') ?? '').trim();
      // Prefer "Cancel", "Turn on", "Not now", "Close", "OK", "Got it"
      if (/^(cancel|turn on|not now|close|ok|got it|skip|dismiss)$/i.test(text)) {
        console.log(`[tiktok-publish] Clicking portal button: "${text}"`);
        await btn.click();
        await page.waitForTimeout(1500);
        dismissed = true;
        break;
      }
    }

    if (!dismissed) {
      // Try X close button
      if (await closeX.isVisible({ timeout: 500 }).catch(() => false)) {
        console.log('[tiktok-publish] Clicking X close button');
        await closeX.click();
        await page.waitForTimeout(1500);
      } else {
        console.log('[tiktok-publish] Pressing Escape');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1500);
      }
    }
  }
}
