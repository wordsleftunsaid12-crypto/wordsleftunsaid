import type { Page } from 'playwright';
import { createPost, getPostCountToday, updateContentQueueStatus } from '@wlu/shared';
import { launchTwitter } from './browser.js';
import { warmupBrowser } from '../warmup.js';

// Reduced from 3 → 2 (Apr 2026) — X allows more but stay conservative.
const MAX_POSTS_PER_DAY = 2;

interface TwitterPublishResult {
  postId: string;
  platformPostId: string | null;
}

/**
 * Publish a tweet/post to X/Twitter with the message quote + link.
 */
export async function browserPublishTwitter(options: {
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
}): Promise<TwitterPublishResult> {
  const todayCount = await getPostCountToday('twitter');
  if (todayCount >= MAX_POSTS_PER_DAY) {
    throw new Error(
      `Daily posting limit reached (${MAX_POSTS_PER_DAY}). Posted ${todayCount} today.`,
    );
  }

  // Build tweet text — message quote + link
  const messageId = options.messageIds?.[0];
  const link = options.utmUrl ?? (messageId
    ? `https://wordsleftunsent.com/messages/${messageId}`
    : 'https://wordsleftunsent.com');

  // Use original message content, fall back to caption first line
  const quote = options.messageContent
    ? `"${options.messageContent.slice(0, 200)}"`
    : options.caption.split('\n')[0].slice(0, 200);
  const attribution = options.messageFrom ? `\n— ${options.messageFrom}` : '';
  const tweetText = `${quote}${attribution}\n\n${link}`;

  if (options.dryRun) {
    console.log('[twitter-publish] [DRY RUN] Would tweet:');
    console.log(`  "${tweetText}"`);
    return { postId: 'dry-run', platformPostId: null };
  }

  console.log('[twitter-publish] Launching browser...');
  const { context, page } = await launchTwitter();

  try {
    // Warm up: scroll home feed before composing
    await warmupBrowser(page, { feedUrl: 'https://x.com/home' });

    console.log('[twitter-publish] Composing tweet...');
    await composeTweet(page, tweetText, options.coverImagePath);

    console.log('[twitter-publish] Tweet posted successfully!');

    // Extract post URL from profile (newest tweet = first status link)
    let platformPostUrl: string | undefined;
    try {
      await page.goto('https://x.com/unsentwords12', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.waitForTimeout(5000);
      const firstTweet = page.locator('a[href*="/unsentwords12/status/"]').first();
      const href = await firstTweet.getAttribute('href', { timeout: 5000 }).catch(() => null);
      if (href) {
        platformPostUrl = href.startsWith('http') ? href : `https://x.com${href}`;
        console.log(`[twitter-publish] Extracted post URL: ${platformPostUrl}`);
      }
    } catch {
      console.warn('[twitter-publish] Could not extract post URL from profile');
    }

    const post = await createPost({
      platform: 'twitter',
      contentQueueId: options.contentQueueId,
      messageIds: options.messageIds ?? [],
      caption: tweetText,
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
 * Compose and post a tweet via X's web UI.
 */
async function composeTweet(page: Page, text: string, imagePath?: string): Promise<void> {
  // Make sure we're on the home page
  if (!page.url().includes('/home')) {
    await page.goto('https://x.com/home', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);
  }

  // Click the compose area
  const composeArea = page
    .locator('[data-testid="tweetTextarea_0"]')
    .or(page.locator('div[role="textbox"][data-testid]'))
    .first();
  await composeArea.click({ timeout: 10000 });
  await page.waitForTimeout(500);

  // Attach image if provided
  if (imagePath) {
    console.log(`[twitter-publish] Attaching image: ${imagePath}`);
    const fileInput = page.locator('input[data-testid="fileInput"]').first();
    await fileInput.setInputFiles(imagePath);
    // Wait for image upload to complete (thumbnail appears)
    await page.waitForTimeout(3000);
    console.log('[twitter-publish] Image attached');
  }

  // Type the tweet
  await page.keyboard.type(text, { delay: 15 });
  await page.waitForTimeout(1000);

  // Click Post button
  const postBtn = page
    .locator('[data-testid="tweetButtonInline"]')
    .or(page.locator('[data-testid="tweetButton"]'))
    .first();
  await postBtn.click({ timeout: 10000 });

  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/twitter-post-result.png' }).catch(() => {});
  console.log('[twitter-publish] Tweet posted');
}
