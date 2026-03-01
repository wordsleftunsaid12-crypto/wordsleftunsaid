/**
 * Shared Playwright browser utilities for Instagram automation.
 * All Instagram browser modules share the same persistent session.
 */
import { chromium, type BrowserContext, type Page } from 'playwright';
import { resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

/** Persistent browser profile — stays logged in across sessions */
export const BROWSER_DATA_DIR = resolve(
  process.env.HOME ?? '.',
  '.wlu-instagram-session',
);

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
}

/**
 * Launch Instagram in a persistent browser context and verify login.
 * Throws if not logged in (user must log in manually first).
 */
export async function launchInstagram(): Promise<BrowserSession> {
  if (!existsSync(BROWSER_DATA_DIR)) {
    mkdirSync(BROWSER_DATA_DIR, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto('https://www.instagram.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);

  // Verify logged in
  const hasHome = await page.locator('svg[aria-label="Home"]').count();
  if (hasHome === 0) {
    await context.close();
    throw new Error(
      'Not logged in to Instagram. Run the login flow first (npx tsx packages/social/src/index.ts login).',
    );
  }

  // Dismiss common modals
  await dismissModals(page);

  return { context, page };
}

/**
 * Dismiss common Instagram modals (notifications, etc.).
 */
export async function dismissModals(page: Page): Promise<void> {
  try {
    const notNowBtn = page.getByRole('button', { name: 'Not Now' });
    if (await notNowBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notNowBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch {
    // No modal
  }
}

/**
 * Navigate to a specific Instagram profile.
 */
export async function navigateToProfile(
  page: Page,
  username: string,
): Promise<void> {
  await page.goto(`https://www.instagram.com/${username}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(3000);
}

/**
 * Navigate to a hashtag explore page.
 * Instagram redirects /explore/tags/ to /explore/search/keyword/, so we
 * use the search URL directly and wait for posts to load.
 */
export async function navigateToHashtag(
  page: Page,
  hashtag: string,
): Promise<void> {
  const tag = hashtag.replace(/^#/, '');
  await page.goto(
    `https://www.instagram.com/explore/search/keyword/?q=%23${tag}`,
    { waitUntil: 'domcontentloaded', timeout: 30000 },
  );
  // Wait for post grid to render after redirect
  await page.waitForTimeout(5000);
}
