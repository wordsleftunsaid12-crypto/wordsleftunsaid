import type { Page } from 'playwright';
import { resolve, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { createPost, getPostCountToday, updateContentQueueStatus } from '@wlu/shared';
import { launchYouTube } from './browser.js';
import { assertNoCaptcha, CaptchaDetectedError } from '../../utils/captcha.js';
import { warmupBrowser } from '../warmup.js';

// Reduced from 3 → 2 (Apr 2026) — YouTube is more tolerant but consistency matters.
const MAX_POSTS_PER_DAY = 2;

interface YouTubePublishResult {
  postId: string;
  platformPostId: string | null;
}

/**
 * Publish a Short to YouTube using Playwright browser automation.
 * Videos in 9:16 ≤ 60s are auto-detected as Shorts.
 */
export async function browserPublishYouTubeShort(options: {
  videoPath: string;
  coverImagePath?: string;
  caption: string;
  contentQueueId?: string;
  messageIds?: string[];
  template?: string;
  mood?: string;
  isExploration?: boolean;
  dryRun?: boolean;
}): Promise<YouTubePublishResult> {
  // Enforce daily posting limit
  const todayCount = await getPostCountToday('youtube');
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
    console.log('[youtube-publish] [DRY RUN] Would publish video:');
    console.log(`  Video: ${absoluteVideoPath}`);
    console.log(`  Caption: "${options.caption.slice(0, 100)}..."`);
    return { postId: 'dry-run', platformPostId: null };
  }

  console.log('[youtube-publish] Launching browser...');
  const { context, page } = await launchYouTube();

  try {
    // Warm up: browse YouTube before opening Studio upload
    await warmupBrowser(page, { feedUrl: 'https://www.youtube.com/' });

    console.log('[youtube-publish] Starting video upload...');
    const absoluteCoverPath = options.coverImagePath
      ? resolve(options.coverImagePath)
      : undefined;
    const platformPostUrl = await uploadShort(page, absoluteVideoPath, options.caption, absoluteCoverPath);

    console.log('[youtube-publish] Video posted successfully!');

    // Record in database
    const post = await createPost({
      platform: 'youtube',
      contentQueueId: options.contentQueueId,
      messageIds: options.messageIds ?? [],
      caption: options.caption,
      template: options.template,
      mood: options.mood,
      postType: 'reel',
      isExploration: options.isExploration,
      platformPostUrl,
    });

    if (options.contentQueueId) {
      await updateContentQueueStatus(options.contentQueueId, 'posted');
    }

    await context.close();
    return {
      postId: post.id,
      platformPostId: null,
    };
  } catch (err) {
    // Leave browser open on CAPTCHA so user can solve manually
    if (err instanceof CaptchaDetectedError) {
      throw err;
    }
    await context.close();
    throw err;
  }
}

/**
 * The core video upload flow via YouTube Studio.
 */
async function uploadShort(
  page: Page,
  videoPath: string,
  caption: string,
  coverImagePath?: string,
): Promise<string | undefined> {
  // 1. launchYouTube() already navigated to Studio and verified login.
  //    Just ensure we're on the Studio page (may have been redirected by modals).
  console.log('[youtube-publish] Navigating to YouTube Studio...');
  if (!page.url().includes('studio.youtube.com')) {
    await page.goto('https://studio.youtube.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(5000);
  }

  // Check for verification popups before proceeding
  await assertNoCaptcha(page, 'youtube');
  await page.screenshot({ path: '/tmp/youtube-before-create.png' }).catch(() => {});

  // 2. Click Create → Upload videos (multiple selector strategies)
  console.log('[youtube-publish] Clicking Create...');
  // YouTube Studio redesigns the Create button periodically — try multiple strategies
  const createStrategies = [
    () => page.getByRole('button', { name: /Create/i }).first(),
    () => page.locator('#create-icon').first(),
    () => page.locator('[aria-label="Create"]').first(),
    () => page.locator('ytcp-button#create-icon').first(),
    () => page.locator('[aria-label="Upload"]').first(),
    () => page.locator('[aria-label="Upload videos"]').first(),
  ];

  let createClicked = false;
  for (const getBtn of createStrategies) {
    const btn = getBtn();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('[youtube-publish] Found Create button, clicking...');
      await btn.click({ timeout: 10000 });
      createClicked = true;
      break;
    }
  }

  if (!createClicked) {
    await page.screenshot({ path: '/tmp/youtube-create-not-found.png' }).catch(() => {});
    throw new Error(
      'YouTube Create button not found — UI may have changed. Screenshot: /tmp/youtube-create-not-found.png',
    );
  }

  await page.waitForTimeout(2000);

  const uploadOption = page.getByRole('menuitem', { name: 'Upload videos' }).first();
  if (await uploadOption.isVisible({ timeout: 5000 }).catch(() => false)) {
    await uploadOption.click({ timeout: 10000 });
  } else {
    // Some Create button variants go directly to upload — check if file input appeared
    const fileInputReady = await page.locator('input[type="file"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    if (!fileInputReady) {
      await page.screenshot({ path: '/tmp/youtube-upload-menu-not-found.png' }).catch(() => {});
      throw new Error(
        'YouTube Upload menu item not found. Screenshot: /tmp/youtube-upload-menu-not-found.png',
      );
    }
    console.log('[youtube-publish] Upload input appeared directly (no menu needed)');
  }
  await page.waitForTimeout(3000);

  // 3. Upload file via file input
  console.log(`[youtube-publish] Uploading: ${basename(videoPath)}`);
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(videoPath);
  await page.waitForTimeout(5000);

  // 4. Wait for video processing (YouTube can take 2-5 minutes)
  console.log('[youtube-publish] Waiting for processing...');
  await waitForProcessing(page);

  // 5. Set title (first line of caption, max 100 chars)
  console.log('[youtube-publish] Setting title and description...');
  const title = caption.split('\n')[0].slice(0, 100);
  const titleInput = page.locator('#textbox').first();
  await titleInput.click({ timeout: 10000 });
  await page.keyboard.press('Meta+A');
  await page.waitForTimeout(200);
  await page.keyboard.type(title, { delay: 15 });
  await page.waitForTimeout(1000);

  // 6. Set description (full caption)
  const descBox = page.locator('#textbox').nth(1);
  await descBox.click({ timeout: 10000 });
  await page.waitForTimeout(200);
  await page.keyboard.type(caption, { delay: 10 });
  await page.waitForTimeout(1000);

  // 6b. Upload custom thumbnail if provided
  if (coverImagePath && existsSync(coverImagePath)) {
    console.log('[youtube-publish] Uploading custom thumbnail...');
    await page.screenshot({ path: '/tmp/yt-before-thumbnail.png' }).catch(() => {});

    const thumbBtn = page.getByText('Upload thumbnail', { exact: false })
      .or(page.locator('#still-picker button').first())
      .first();
    const thumbBtnVisible = await thumbBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[youtube-publish] "Upload thumbnail" visible: ${thumbBtnVisible}`);

    if (thumbBtnVisible) {
      const [thumbChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10000 }),
        thumbBtn.click(),
      ]);
      await thumbChooser.setFiles(coverImagePath);
      console.log(`[youtube-publish] Thumbnail set: ${basename(coverImagePath)}`);
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/yt-after-thumbnail.png' }).catch(() => {});
    } else {
      console.warn('[youtube-publish] THUMBNAIL UPLOAD SKIPPED: "Upload thumbnail" not found. Screenshot: /tmp/yt-before-thumbnail.png');
    }
  }

  // 7. Select "Not made for kids"
  console.log('[youtube-publish] Setting audience...');
  const notForKids = page.getByRole('radio', { name: /not made for kids/i }).first();
  await notForKids.click({ timeout: 10000 });
  await page.waitForTimeout(1000);

  // 8. Click Next through steps (Details → Video elements → Checks → Visibility)
  console.log('[youtube-publish] Navigating through upload steps...');
  for (let step = 0; step < 3; step++) {
    await clickNext(page);
    await page.waitForTimeout(2000);
  }

  // 9. Set visibility to Public
  console.log('[youtube-publish] Setting visibility to Public...');
  const publicRadio = page.getByRole('radio', { name: /^Public$/i }).first();
  await publicRadio.click({ timeout: 10000 });
  await page.waitForTimeout(1500);

  // 10. Wait for HD processing to finish before publishing
  console.log('[youtube-publish] Waiting for HD processing to complete...');
  await waitForHdProcessing(page);

  // 11. Take screenshot before publishing
  await page.screenshot({ path: '/tmp/youtube-pre-publish.png' }).catch(() => {});

  // 12. Click Save/Publish
  console.log('[youtube-publish] Publishing...');
  const saveBtn = page.locator('#done-button').first();
  await saveBtn.click({ timeout: 10000 });

  // 13. Wait for confirmation and extract video URL
  console.log('[youtube-publish] Waiting for confirmation...');
  return await waitForConfirmation(page);
}

/**
 * Wait for HD processing to finish on the Visibility step.
 * YouTube shows "Processing up to HD ... X minutes left" in the footer.
 * If we publish before this completes, the video can end up in Drafts.
 */
async function waitForHdProcessing(page: Page): Promise<void> {
  const maxWaitMs = 600000; // 10 minutes
  const pollInterval = 5000;

  // Wait a few seconds for the processing indicator to render before polling.
  // Without this, the check can return false immediately (no text yet) and
  // we'd incorrectly conclude processing is already done.
  await page.waitForTimeout(5000);

  const startTime = Date.now();
  let sawProcessing = false;

  while (Date.now() - startTime < maxWaitMs) {
    const processingText = page.locator('text=/Processing|Uploading|Checking/i').first();
    const isProcessing = await processingText.isVisible({ timeout: 2000 }).catch(() => false);

    if (isProcessing) {
      sawProcessing = true;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const text = await processingText.textContent().catch(() => 'still processing');
      console.log(`[youtube-publish] HD: ${text} (${elapsed}s)`);
    } else if (sawProcessing) {
      // Processing text was visible before but now it's gone — done
      console.log('[youtube-publish] HD processing complete');
      return;
    } else {
      // Never saw processing text — check if the done-button is already enabled
      const doneBtn = page.locator('#done-button').first();
      const isEnabled = await doneBtn.isEnabled({ timeout: 1000 }).catch(() => false);
      if (isEnabled) {
        console.log('[youtube-publish] HD processing complete (button ready)');
        return;
      }
    }

    await page.waitForTimeout(pollInterval);
  }

  await page.screenshot({ path: '/tmp/youtube-hd-timeout.png' }).catch(() => {});
  throw new Error(
    'YouTube HD processing did not complete within 10 minutes. Screenshot: /tmp/youtube-hd-timeout.png',
  );
}

/**
 * Wait for YouTube to finish processing the video.
 * Polls for up to 5 minutes (YouTube is slower than TikTok/IG).
 */
async function waitForProcessing(page: Page): Promise<void> {
  const maxWaitMs = 300000; // 5 minutes
  const pollInterval = 5000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    // Check if title input is available and enabled — means we can proceed
    const titleInput = page.locator('#textbox').first();
    if (await titleInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      const isEditable = await titleInput.isEditable({ timeout: 1000 }).catch(() => false);
      if (isEditable) {
        console.log('[youtube-publish] Upload dialog ready');
        return;
      }
    }

    // Check for errors
    const errorMsg = page.locator('text=/processing failed|upload failed/i').first();
    if (await errorMsg.isVisible({ timeout: 500 }).catch(() => false)) {
      throw new Error('YouTube upload failed');
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[youtube-publish] Waiting for upload dialog... (${elapsed}s)`);
    await page.waitForTimeout(pollInterval);
  }

  await page.screenshot({ path: '/tmp/youtube-processing-timeout.png' }).catch(() => {});
  throw new Error('Video processing timed out after 5 minutes');
}

/**
 * Click the Next button in YouTube Studio's upload flow.
 */
async function clickNext(page: Page): Promise<void> {
  const nextBtn = page.getByRole('button', { name: 'Next', exact: true });
  await nextBtn.click({ timeout: 15000 });
}

/**
 * Wait for YouTube to confirm the upload is complete.
 * Returns the video URL if found in the confirmation dialog.
 */
async function waitForConfirmation(page: Page): Promise<string | undefined> {
  // Wait for confirmation — this MUST succeed for the post to be recorded
  try {
    // YouTube shows "Video published" or a link to the video
    await page
      .locator('text=/Video published|processing complete|successfully uploaded/i')
      .or(page.locator('a[href*="youtube.com/shorts"]'))
      .or(page.locator('a[href*="youtu.be"]'))
      .first()
      .waitFor({ timeout: 120000 });

    console.log('[youtube-publish] Confirmed: Video published!');
  } catch {
    // No confirmation — take a screenshot and FAIL so we don't record a ghost post
    await page.screenshot({ path: '/tmp/youtube-post-result.png' }).catch(() => {});
    throw new Error(
      'YouTube publish failed: no confirmation text appeared after 2 minutes. Screenshot: /tmp/youtube-post-result.png',
    );
  }

  // Try to extract the video URL from the confirmation dialog
  let videoUrl: string | undefined;
  try {
    const shortsLink = page.locator('a[href*="youtube.com/shorts"]').first();
    const youtubeLink = page.locator('a[href*="youtu.be"]').first();

    if (await shortsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      videoUrl = await shortsLink.getAttribute('href') ?? undefined;
    } else if (await youtubeLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      videoUrl = await youtubeLink.getAttribute('href') ?? undefined;
    }

    if (videoUrl) {
      console.log(`[youtube-publish] Video URL: ${videoUrl}`);
    }
  } catch {
    // URL extraction is best-effort
  }

  // Close the upload dialog if there's a close button
  try {
    const closeBtn = page.locator('#close-button, [aria-label="Close"]').first();
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch {
    // No close button
  }

  return videoUrl;
}
