/**
 * Shared Playwright browser utilities for Reddit automation.
 * Uses a persistent session for login persistence.
 */
import { chromium, type BrowserContext, type Page } from 'playwright';
import { resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

export const REDDIT_BROWSER_DATA_DIR = resolve(
  process.env.HOME ?? '.',
  '.wlu-reddit-session',
);

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
}

/**
 * Launch Reddit in a persistent browser context and verify login.
 * Throws if not logged in (user must log in manually first).
 */
export async function launchReddit(): Promise<BrowserSession> {
  if (!existsSync(REDDIT_BROWSER_DATA_DIR)) {
    mkdirSync(REDDIT_BROWSER_DATA_DIR, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(REDDIT_BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto('https://www.reddit.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);

  // Verify logged in by checking for user menu
  const isLoggedIn = await page
    .locator('[id*="USER_DROPDOWN"], button[aria-label*="profile"], [data-testid="avatar"]')
    .first()
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (!isLoggedIn) {
    await page.screenshot({ path: '/tmp/reddit-login-check-fail.png' }).catch(() => {});
    console.error('[reddit] Login check failed. Screenshot: /tmp/reddit-login-check-fail.png');
    await context.close();
    throw new Error(
      'Not logged in to Reddit. Run the login flow first:\n' +
        '  npx tsx packages/social/src/platforms/reddit/browser.ts',
    );
  }

  return { context, page };
}

/**
 * If run directly, launch browser for manual Reddit login.
 */
const isDirectRun = process.argv[1]?.endsWith('reddit/browser.ts') ||
  process.argv[1]?.endsWith('reddit/browser.js');

if (isDirectRun) {
  console.log('Launching Reddit browser for manual login...');
  console.log(`Session stored at: ${REDDIT_BROWSER_DATA_DIR}`);
  console.log('Log in to Reddit, then close the browser window.\n');

  if (!existsSync(REDDIT_BROWSER_DATA_DIR)) {
    mkdirSync(REDDIT_BROWSER_DATA_DIR, { recursive: true });
  }

  const ctx = await chromium.launchPersistentContext(REDDIT_BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const pg = ctx.pages()[0] ?? (await ctx.newPage());
  await pg.goto('https://www.reddit.com/login', { waitUntil: 'domcontentloaded' });

  console.log('Waiting for you to log in...');
  await ctx.waitForEvent('close').catch(() => {});
  console.log('Browser closed. Session saved.');
}
