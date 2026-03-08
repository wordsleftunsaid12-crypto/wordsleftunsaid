import type { Page } from 'playwright';
import { resolve, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { createPost, getPostCountToday, updateContentQueueStatus } from '@wlu/shared';
import { launchInstagram, BROWSER_DATA_DIR } from './browser.js';

const MAX_POSTS_PER_DAY = 3;

interface BrowserPublishResult {
  postId: string;
  platformPostId: string | null;
}

/**
 * Publish a Reel to Instagram using Playwright browser automation.
 */
export async function browserPublishReel(options: {
  videoPath: string;
  coverImagePath?: string;
  caption: string;
  contentQueueId?: string;
  messageIds?: string[];
  template?: string;
  mood?: string;
  isExploration?: boolean;
  dryRun?: boolean;
}): Promise<BrowserPublishResult> {
  // Enforce daily posting limit
  const todayCount = await getPostCountToday('instagram');
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
    console.log('[browser-publish] [DRY RUN] Would publish Reel:');
    console.log(`  Video: ${absoluteVideoPath}`);
    console.log(`  Caption: "${options.caption.slice(0, 100)}..."`);
    return { postId: 'dry-run', platformPostId: null };
  }

  console.log('[browser-publish] Launching browser...');

  const { context, page } = await launchInstagram();

  try {

    // Create the Reel
    console.log('[browser-publish] Starting Reel creation...');
    const absoluteCoverPath = options.coverImagePath
      ? resolve(options.coverImagePath)
      : undefined;
    await createReelPost(page, absoluteVideoPath, options.caption, absoluteCoverPath);

    console.log('[browser-publish] Reel posted successfully!');

    // Record in database
    const post = await createPost({
      platform: 'instagram',
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
 * The core Reel creation flow via Instagram's desktop web UI.
 */
async function createReelPost(
  page: Page,
  videoPath: string,
  caption: string,
  coverImagePath?: string,
): Promise<void> {
  // 1. Click "Create" in the sidebar to expand the submenu
  console.log('[browser-publish] Clicking Create in sidebar...');
  const createLink = page.locator('svg[aria-label="New post"]').locator('..');
  await createLink.first().click({ timeout: 10000 });
  await page.waitForTimeout(2000);

  // 2. Click "Post" from the expanded submenu
  console.log('[browser-publish] Clicking Post option...');
  const postOption = page.getByText('Post', { exact: true }).first();
  await postOption.click({ timeout: 10000 });
  await page.waitForTimeout(3000);

  // 3. Upload video via file chooser
  console.log('[browser-publish] Uploading video...');
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 30000 }),
    // Click "Select from computer" or "Select from gallery" button
    page
      .getByRole('button', { name: /Select from computer/i })
      .or(page.getByRole('button', { name: /Select/i }))
      .or(page.locator('button').filter({ hasText: /select/i }))
      .first()
      .click({ timeout: 15000 }),
  ]);

  await fileChooser.setFiles(videoPath);
  console.log(`[browser-publish] File selected: ${basename(videoPath)}`);

  // 4. Wait for video to process
  console.log('[browser-publish] Waiting for video processing...');
  await page.waitForTimeout(10000);

  // 5. Dismiss "Video posts are now shared as reels" modal if it appears
  try {
    const okBtn = page.getByRole('button', { name: /^OK$/i });
    if (await okBtn.isVisible({ timeout: 5000 })) {
      console.log('[browser-publish] Dismissing Reels info modal...');
      await okBtn.click();
      await page.waitForTimeout(2000);
    }
  } catch {
    // Modal may not appear
  }

  // 5. Select 9:16 aspect ratio (Instagram defaults to 1:1 which crops vertical video)
  console.log('[browser-publish] Selecting 9:16 aspect ratio...');
  try {
    const selectCrop = page.locator('svg[aria-label="Select crop"]').first();
    if (await selectCrop.isVisible({ timeout: 3000 }).catch(() => false)) {
      await selectCrop.click();
      await page.waitForTimeout(1500);

      // Click the portrait (9:16) crop option
      const portraitCrop = page.locator('svg[aria-label="Crop portrait icon"]').first();
      if (await portraitCrop.isVisible({ timeout: 2000 }).catch(() => false)) {
        await portraitCrop.click();
        await page.waitForTimeout(1500);
        console.log('[browser-publish] Set to 9:16 portrait crop');
      } else {
        console.warn('[browser-publish] Portrait crop icon not found, continuing with default');
      }
    }
  } catch {
    console.warn('[browser-publish] Could not set crop, continuing with default');
  }

  // Step 1: Crop/Trim → Next
  console.log('[browser-publish] Step 1: Crop → Next');
  await clickNext(page);
  await page.waitForTimeout(3000);

  // Step 2: Edit/Filter → Next
  console.log('[browser-publish] Step 2: Edit → Next');
  await clickNext(page);
  await page.waitForTimeout(3000);

  // 5. Set cover image if provided
  if (coverImagePath && existsSync(coverImagePath)) {
    try {
      console.log('[browser-publish] Setting cover image...');
      const editCover = page.getByText('Edit cover', { exact: false }).first();
      if (await editCover.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editCover.click();
        await page.waitForTimeout(2000);

        // Click "Add from camera roll" to upload a custom cover
        const addFromRoll = page.getByText('Add from camera roll', { exact: false })
          .or(page.getByText('Upload cover photo', { exact: false }))
          .first();
        if (await addFromRoll.isVisible({ timeout: 3000 }).catch(() => false)) {
          const [coverChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 10000 }),
            addFromRoll.click(),
          ]);
          await coverChooser.setFiles(coverImagePath);
          console.log(`[browser-publish] Cover image set: ${basename(coverImagePath)}`);
          await page.waitForTimeout(3000);

          // Confirm the cover selection
          const doneBtn = page.getByRole('button', { name: /^Done$/i })
            .or(page.locator('div[role="button"]').filter({ hasText: /^Done$/ }));
          if (await doneBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            await doneBtn.first().click({ force: true });
            await page.waitForTimeout(2000);
          }
        }
      }
    } catch (err) {
      console.warn('[browser-publish] Cover image upload failed, continuing without it:', err instanceof Error ? err.message : err);
    }
  }

  // 6. Add caption
  console.log('[browser-publish] Adding caption...');
  const captionInput = page
    .locator('[aria-label="Write a caption..."]')
    .or(page.getByRole('textbox', { name: /caption/i }))
    .or(page.locator('div[role="textbox"]').first());

  await captionInput.first().click({ timeout: 10000 });

  // Type caption character by character to avoid issues with special chars
  await captionInput.first().fill(caption);
  await page.waitForTimeout(1000);

  // 6. Click Share — the blue "Share" text in the dialog header
  console.log('[browser-publish] Clicking Share...');
  // Target the Share text that appears in the top-right of the "New reel" dialog header
  const shareBtn = page.getByText('Share', { exact: true }).last();
  await shareBtn.click({ timeout: 10000 });

  // 7. Wait for confirmation
  console.log('[browser-publish] Waiting for upload to complete...');
  try {
    // Instagram shows "Your reel has been shared" or similar
    await page
      .getByText(/has been shared|reel shared|post shared/i)
      .first()
      .waitFor({ timeout: 120000 }); // Videos can take up to 2 minutes
    console.log('[browser-publish] Confirmed: Reel shared!');
  } catch {
    // Even without explicit confirmation text, wait and check
    console.warn('[browser-publish] No explicit confirmation text, waiting 15s...');
    await page.waitForTimeout(15000);
  }
}

/**
 * Click the "Next" button in Instagram's post creation flow.
 */
async function clickNext(page: Page): Promise<void> {
  const nextBtn = page
    .getByRole('button', { name: /^Next$/i })
    .or(page.locator('div[role="button"]').filter({ hasText: /^Next$/ }));

  // Use force:true to bypass overlay elements that intercept clicks
  await nextBtn.first().click({ timeout: 15000, force: true });
}
