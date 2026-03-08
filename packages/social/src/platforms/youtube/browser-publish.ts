import type { Page } from 'playwright';
import { resolve, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { createPost, getPostCountToday, updateContentQueueStatus } from '@wlu/shared';
import { launchYouTube } from './browser.js';

const MAX_POSTS_PER_DAY = 3;

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
    console.log('[youtube-publish] Starting video upload...');
    const absoluteCoverPath = options.coverImagePath
      ? resolve(options.coverImagePath)
      : undefined;
    await uploadShort(page, absoluteVideoPath, options.caption, absoluteCoverPath);

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
 * The core video upload flow via YouTube Studio.
 */
async function uploadShort(
  page: Page,
  videoPath: string,
  caption: string,
  coverImagePath?: string,
): Promise<void> {
  // 1. Navigate to YouTube Studio
  console.log('[youtube-publish] Navigating to YouTube Studio...');
  await page.goto('https://studio.youtube.com', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);

  // 2. Click Create → Upload videos
  console.log('[youtube-publish] Clicking Create...');
  const createBtn = page.locator('#create-icon, [aria-label="Create"]').first();
  await createBtn.click({ timeout: 10000 });
  await page.waitForTimeout(2000);

  const uploadOption = page.getByRole('menuitem', { name: 'Upload videos' }).first();
  await uploadOption.click({ timeout: 10000 });
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
    try {
      console.log('[youtube-publish] Uploading custom thumbnail...');
      const thumbBtn = page.getByText('Upload thumbnail', { exact: false })
        .or(page.locator('#still-picker button').first())
        .first();
      if (await thumbBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        const [thumbChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 10000 }),
          thumbBtn.click(),
        ]);
        await thumbChooser.setFiles(coverImagePath);
        console.log(`[youtube-publish] Thumbnail set: ${basename(coverImagePath)}`);
        await page.waitForTimeout(3000);
      }
    } catch (err) {
      console.warn('[youtube-publish] Thumbnail upload failed, continuing without it:', err instanceof Error ? err.message : err);
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

  // 13. Wait for confirmation
  console.log('[youtube-publish] Waiting for confirmation...');
  await waitForConfirmation(page);
}

/**
 * Wait for HD processing to finish on the Visibility step.
 * YouTube shows "Processing up to HD ... X minutes left" in the footer.
 * If we publish before this completes, the video can end up in Drafts.
 */
async function waitForHdProcessing(page: Page): Promise<void> {
  const maxWaitMs = 300000; // 5 minutes
  const pollInterval = 5000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const processingText = page.locator('text=/Processing.*minutes? left/i').first();
    const isProcessing = await processingText.isVisible({ timeout: 1000 }).catch(() => false);

    if (!isProcessing) {
      console.log('[youtube-publish] HD processing complete');
      return;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const text = await processingText.textContent().catch(() => 'still processing');
    console.log(`[youtube-publish] HD: ${text} (${elapsed}s)`)

    await page.waitForTimeout(pollInterval);
  }

  console.warn('[youtube-publish] HD processing did not complete within 5 min, publishing anyway');
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
 */
async function waitForConfirmation(page: Page): Promise<void> {
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
    console.warn('[youtube-publish] No explicit confirmation text, waiting 15s...');
    await page.waitForTimeout(15000);
    await page.screenshot({ path: '/tmp/youtube-post-result.png' }).catch(() => {});
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
}
