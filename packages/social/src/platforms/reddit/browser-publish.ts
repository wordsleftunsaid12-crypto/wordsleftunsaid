import type { Page } from 'playwright';
import { createPost, getPostCountToday, updateContentQueueStatus, getRecentPosts } from '@wlu/shared';
import { launchReddit } from './browser.js';
import { warmupBrowser } from '../warmup.js';

/** Max 1 Reddit post per day to avoid subreddit spam filters. */
const MAX_POSTS_PER_DAY = 1;

/** Minimum days before posting to the same subreddit again. */
const PER_SUBREDDIT_COOLDOWN_DAYS = 3;

interface RedditPublishResult {
  postId: string;
  platformPostId: string | null;
}

/** Target subreddits for posting, in priority order. */
const TARGET_SUBREDDITS = [
  'UnsentLetters',
  'offmychest',
  'self',
  'TrueOffMyChest',
];

/**
 * Get the subreddit from a Reddit post URL.
 */
function extractSubreddit(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/r\/(\w+)/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Pick the next subreddit that hasn't been posted to recently.
 * Returns the sub with the longest cooldown gap, or the first available.
 */
async function pickSubreddit(): Promise<string> {
  const recentPosts = await getRecentPosts('reddit', 14);
  const lastPostBySub = new Map<string, Date>();

  for (const post of recentPosts) {
    const sub = extractSubreddit(post.platformPostUrl);
    if (sub && !lastPostBySub.has(sub)) {
      lastPostBySub.set(sub, new Date(post.createdAt));
    }
  }

  const now = Date.now();
  const cooldownMs = PER_SUBREDDIT_COOLDOWN_DAYS * 86400000;

  // Find subs that are past their cooldown, prefer the one with the oldest last post
  let bestSub = TARGET_SUBREDDITS[0];
  let bestAge = -1;

  for (const sub of TARGET_SUBREDDITS) {
    const lastPost = lastPostBySub.get(sub.toLowerCase());
    if (!lastPost) {
      // Never posted here (in recent window) — best candidate
      return sub;
    }
    const age = now - lastPost.getTime();
    if (age >= cooldownMs && age > bestAge) {
      bestAge = age;
      bestSub = sub;
    }
  }

  // If nothing is past cooldown, pick the oldest one anyway
  if (bestAge < 0) {
    let oldestAge = -1;
    for (const sub of TARGET_SUBREDDITS) {
      const lastPost = lastPostBySub.get(sub.toLowerCase());
      const age = lastPost ? now - lastPost.getTime() : Infinity;
      if (age > oldestAge) {
        oldestAge = age;
        bestSub = sub;
      }
    }
  }

  return bestSub;
}

/**
 * Publish a text post to Reddit with the message content.
 * Posts to one subreddit per invocation, rotating through subs with a per-sub cooldown.
 */
export async function browserPublishReddit(options: {
  videoPath: string;
  coverImagePath?: string;
  caption: string;
  contentQueueId?: string;
  messageIds?: string[];
  template?: string;
  mood?: string;
  isExploration?: boolean;
  dryRun?: boolean;
  /** The message content to post (used as the post body). */
  messageContent?: string;
  /** The "To" field from the message. */
  messageTo?: string;
  /** The "From" field from the message. */
  messageFrom?: string;
  /** UTM-tracked link to the message page. */
  utmUrl?: string;
}): Promise<RedditPublishResult> {
  const todayCount = await getPostCountToday('reddit');
  if (todayCount >= MAX_POSTS_PER_DAY) {
    throw new Error(
      `Daily posting limit reached (${MAX_POSTS_PER_DAY}). Posted ${todayCount} today.`,
    );
  }

  const subreddit = await pickSubreddit();
  console.log(`[reddit-publish] Selected r/${subreddit} (cooldown-based rotation)`);

  // Use original message content — fall back to caption only as last resort
  const title = options.messageTo
    ? `To ${options.messageTo}`
    : 'An unsent letter';

  const body = options.messageContent ?? options.caption.split('\n')[0];

  // Reddit posts need substance — one-liners look like spam and get removed
  if (body.length < 100) {
    throw new Error(`Message too short for Reddit (${body.length} chars, min 100). Skipping.`);
  }

  // No promotional footer — Reddit bans for self-promotion.
  // Website link belongs in profile bio only.
  const attribution = options.messageFrom ? `\n\n\u2014 *${options.messageFrom}*` : '';

  if (options.dryRun) {
    console.log('[reddit-publish] [DRY RUN] Would post to r/' + subreddit);
    console.log(`  Title: ${title}`);
    console.log(`  Body: "${body.slice(0, 100)}..."`);
    return { postId: 'dry-run', platformPostId: null };
  }

  console.log(`[reddit-publish] Posting to r/${subreddit}...`);

  const { context, page } = await launchReddit();

  try {
    // Warm up: read the subreddit's front page briefly before posting
    await warmupBrowser(page, {
      feedUrl: `https://www.reddit.com/r/${subreddit}/`,
      minMs: 10000,
      maxMs: 30000,
    });

    await submitTextPost(page, subreddit, title, body + attribution);

    console.log('[reddit-publish] Post submitted successfully!');

    // Extract post URL — Reddit navigates to the new post after submission
    const finalUrl = page.url();
    const platformPostUrl = finalUrl.includes('/comments/') ? finalUrl : undefined;

    const post = await createPost({
      platform: 'reddit',
      contentQueueId: options.contentQueueId,
      messageIds: options.messageIds ?? [],
      caption: body,
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
 * Submit a text post to a subreddit via Reddit's web UI.
 */
async function submitTextPost(
  page: Page,
  subreddit: string,
  title: string,
  body: string,
): Promise<void> {
  // Navigate to submit page — use ?type=TEXT to force text post mode
  // Without this, Reddit may redirect to a crosspost form if it detects similar content
  await page.goto(`https://www.reddit.com/r/${subreddit}/submit?type=TEXT`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  // Detect crosspost redirect — Reddit sometimes nudges to /submit?composer_entry=crosspost_nudge
  const currentUrl = page.url();
  if (currentUrl.includes('crosspost_nudge') || (currentUrl.includes('/submit') && !currentUrl.includes(`/r/${subreddit}`))) {
    console.log(`[reddit-publish] Crosspost redirect detected (${currentUrl}), re-navigating...`);
    // Force navigate back with explicit text type
    await page.goto(`https://www.reddit.com/r/${subreddit}/submit?type=TEXT&title=${encodeURIComponent(title)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);
  }

  // Check if we're on the new or old Reddit submit page
  await page.screenshot({ path: '/tmp/reddit-submit-page.png' }).catch(() => {});

  // Check for ban before trying to post
  const pageText = await page.textContent('body').catch(() => '') ?? '';
  if (/you've been banned|banned from contributing|you are banned/i.test(pageText)) {
    throw new Error(
      `Banned from r/${subreddit} — remove from TARGET_SUBREDDITS. Screenshot: /tmp/reddit-submit-page.png`,
    );
  }

  // Enter title
  console.log('[reddit-publish] Entering title...');
  const titleInput = page
    .locator('textarea[name="title"], [data-testid="post-title"] textarea, input[aria-label*="Title"]')
    .first();
  await titleInput.click({ timeout: 10000 });
  await page.keyboard.type(title, { delay: 20 });
  await page.waitForTimeout(500);

  // Enter body text — Reddit uses a Lexical rich text editor.
  // The contenteditable div may be hidden behind a placeholder overlay,
  // so click the placeholder text or use force:true to focus the editor.
  console.log('[reddit-publish] Entering body...');
  const bodyPlaceholder = page.locator('span:has-text("Body text"), [data-placeholder="Body text"]').first();
  const bodyEditable = page.locator('div[contenteditable="true"][data-lexical-editor]').first();

  // A <p> element overlays the placeholder, so use force:true
  if (await bodyPlaceholder.isVisible({ timeout: 3000 }).catch(() => false)) {
    await bodyPlaceholder.click({ force: true });
  } else {
    await bodyEditable.click({ force: true, timeout: 10000 });
  }
  await page.waitForTimeout(500);
  await page.keyboard.type(body, { delay: 10 });
  await page.waitForTimeout(1000);

  // Select post flair if required
  console.log('[reddit-publish] Checking for flair...');
  const flairBtn = page.locator('button:has-text("Add flair"), span:has-text("Add flair")').first();
  if (await flairBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await flairBtn.click({ force: true });
    await page.waitForTimeout(2000);

    // Reddit uses custom <faceplate-radio-input> web components.
    // Click the radio input directly by its role, skipping "No flair" (index 0).
    const flairRadios = page.locator('faceplate-radio-input[role="radio"]');
    const radioCount = await flairRadios.count();
    console.log(`[reddit-publish] Found ${radioCount} flair options`);

    // Pick index 1 (first real flair after "No flair")
    if (radioCount > 1) {
      await flairRadios.nth(1).click({ force: true });
      await page.waitForTimeout(500);
      console.log('[reddit-publish] Flair selected');
    }

    // Click "Add" to confirm — force:true to bypass devvit-wrapper overlay
    await page.waitForTimeout(500);
    const addBtn = page.getByRole('button', { name: /^Add$/i }).first();
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }
  }

  // Screenshot before clicking Post
  await page.screenshot({ path: '/tmp/reddit-pre-post.png' }).catch(() => {});

  // Check for AI content filter or other blocking warnings before submitting
  const prePostText = await page.textContent('body').catch(() => '') ?? '';
  if (/will not be able to post|do not allow AI generated|AI content/i.test(prePostText)) {
    await page.screenshot({ path: '/tmp/reddit-ai-blocked.png' }).catch(() => {});
    throw new Error(
      `Reddit blocked post: AI content filter detected on r/${subreddit}. Screenshot: /tmp/reddit-ai-blocked.png`,
    );
  }

  // Click submit/post
  console.log('[reddit-publish] Clicking Post...');
  const roleBtn = page.getByRole('button', { name: /^Post$/i }).first();
  const submitBtn = page.locator('button[type="submit"]').filter({ hasText: /post/i }).first();
  const postBtn = (await roleBtn.isVisible({ timeout: 5000 }).catch(() => false))
    ? roleBtn
    : submitBtn;
  await postBtn.click({ timeout: 10000, force: true });

  // Wait for navigation to the new post
  await page.waitForTimeout(8000);
  await page.screenshot({ path: '/tmp/reddit-post-result.png' }).catch(() => {});

  const finalUrl = page.url();
  if (finalUrl.includes('/comments/')) {
    console.log(`[reddit-publish] Post live at: ${finalUrl}`);
  } else {
    // Check for post-submit errors (AI filter, spam filter, etc.)
    const postText = await page.textContent('body').catch(() => '') ?? '';
    if (/will not be able to post|do not allow AI generated|AI content|spam filter/i.test(postText)) {
      throw new Error(
        `Reddit blocked post after submit: AI/spam filter on r/${subreddit}. Screenshot: /tmp/reddit-post-result.png`,
      );
    }
    // Still on submit page = post likely failed
    if (finalUrl.includes('/submit')) {
      throw new Error(
        `Reddit post may have failed — still on submit page. URL: ${finalUrl}. Screenshot: /tmp/reddit-post-result.png`,
      );
    }
    console.log(`[reddit-publish] Final URL: ${finalUrl}`);
    console.log('[reddit-publish] Post may have been submitted (check screenshot)');
  }
}
