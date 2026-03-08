import { chromium, type Page } from 'playwright';
import { resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import {
  getPostsByPlatform,
  saveEngagementMetrics,
  getLatestMetrics,
} from '@wlu/shared';

const BROWSER_DATA_DIR = resolve(
  process.env.HOME ?? '.',
  '.wlu-instagram-session',
);

/**
 * Collect engagement metrics for recent Instagram posts via Playwright.
 * Opens the browser, navigates to our profile, and scrapes post metrics.
 */
export async function collectInstagramMetrics(
  options: { maxPosts?: number } = {},
): Promise<number> {
  const { maxPosts = 20 } = options;

  const posts = await getPostsByPlatform('instagram', { limit: maxPosts });
  if (posts.length === 0) {
    console.log('[collect] No posts to collect metrics for');
    return 0;
  }

  // Filter to posts that need fresh metrics (older than 2 hours)
  const postsNeedingMetrics = [];
  for (const post of posts) {
    const existing = await getLatestMetrics(post.id);
    if (existing) {
      const measuredAt = new Date(existing.measuredAt).getTime();
      if (Date.now() - measuredAt < 2 * 3600000) {
        continue;
      }
    }
    postsNeedingMetrics.push(post);
  }

  if (postsNeedingMetrics.length === 0) {
    console.log('[collect] All metrics are fresh (< 2 hours old)');
    return 0;
  }

  console.log(
    `[collect] Collecting metrics for ${postsNeedingMetrics.length} post(s)...`,
  );

  if (!existsSync(BROWSER_DATA_DIR)) {
    mkdirSync(BROWSER_DATA_DIR, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] ?? (await context.newPage());
  let collected = 0;

  try {
    // Navigate to our profile
    await page.goto('https://www.instagram.com/u.wordsleftunsent/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    const postLinks = page.locator(
      'article a[href*="/p/"], article a[href*="/reel/"]',
    );
    const postCount = Math.min(
      await postLinks.count(),
      postsNeedingMetrics.length,
    );

    for (let i = 0; i < postCount; i++) {
      try {
        // Navigate back to profile
        if (i > 0) {
          await page.goto('https://www.instagram.com/u.wordsleftunsent/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          await page.waitForTimeout(3000);
        }

        // Click into the post
        await postLinks.nth(i).click({ timeout: 10000 });
        await page.waitForTimeout(3000);

        const dbPost = postsNeedingMetrics[i];
        if (!dbPost) continue;

        const metrics = await scrapePostMetrics(page);

        await saveEngagementMetrics({
          postId: dbPost.id,
          likes: metrics.likes,
          comments: metrics.comments,
          shares: metrics.shares,
          views: metrics.views,
          saves: 0,
          reach: 0,
          impressions: 0,
        });

        collected++;
        console.log(
          `[collect] Post ${i + 1}: ${metrics.likes} likes, ${metrics.comments} comments, ${metrics.views} views`,
        );
      } catch (err) {
        console.warn(`[collect] Failed for post ${i}:`, err);
      }
    }
  } finally {
    await context.close();
  }

  console.log(`[collect] Collected metrics for ${collected} post(s)`);
  return collected;
}

interface PostMetrics {
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

/**
 * Scrape engagement metrics from the currently open post detail view.
 */
async function scrapePostMetrics(page: Page): Promise<PostMetrics> {
  const metrics: PostMetrics = {
    likes: 0,
    comments: 0,
    shares: 0,
    views: 0,
  };

  try {
    const likesText = await page
      .locator('section span:has-text("like")')
      .or(page.locator('a:has-text("like")'))
      .first()
      .textContent({ timeout: 3000 })
      .catch(() => '');

    if (likesText) {
      const likesMatch = likesText.match(/([\d,]+)/);
      if (likesMatch) {
        metrics.likes = parseInt(likesMatch[1].replace(/,/g, ''), 10);
      }
    }
  } catch {
    // Likes not found
  }

  try {
    const viewsText = await page
      .locator('span:has-text("play"), span:has-text("view")')
      .first()
      .textContent({ timeout: 3000 })
      .catch(() => '');

    if (viewsText) {
      const viewsMatch = viewsText.match(/([\d,]+)/);
      if (viewsMatch) {
        metrics.views = parseInt(viewsMatch[1].replace(/,/g, ''), 10);
      }
    }
  } catch {
    // Views not found
  }

  try {
    const commentsText = await page
      .locator('span:has-text("comment")')
      .first()
      .textContent({ timeout: 3000 })
      .catch(() => '');

    if (commentsText) {
      const commentsMatch = commentsText.match(/([\d,]+)/);
      if (commentsMatch) {
        metrics.comments = parseInt(commentsMatch[1].replace(/,/g, ''), 10);
      }
    }
  } catch {
    // Comments not found
  }

  return metrics;
}
