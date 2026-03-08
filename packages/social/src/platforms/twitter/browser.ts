/**
 * Shared Playwright browser utilities for X/Twitter automation.
 */
import { chromium, type BrowserContext, type Page } from 'playwright';
import { resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

export const TWITTER_BROWSER_DATA_DIR = resolve(
  process.env.HOME ?? '.',
  '.wlu-twitter-session',
);

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
}

/**
 * Launch X/Twitter in a persistent browser context and verify login.
 */
export async function launchTwitter(): Promise<BrowserSession> {
  if (!existsSync(TWITTER_BROWSER_DATA_DIR)) {
    mkdirSync(TWITTER_BROWSER_DATA_DIR, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(TWITTER_BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto('https://x.com/home', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);

  // Verify logged in — X redirects to /login if not authenticated
  const currentUrl = page.url();
  const isLoggedIn = !currentUrl.includes('/login') && !currentUrl.includes('/i/flow');

  if (!isLoggedIn) {
    await page.screenshot({ path: '/tmp/twitter-login-check-fail.png' }).catch(() => {});
    console.error('[twitter] Login check failed. Screenshot: /tmp/twitter-login-check-fail.png');
    await context.close();
    throw new Error(
      'Not logged in to X/Twitter. Run the login flow first:\n' +
        '  npx tsx packages/social/src/platforms/twitter/browser.ts',
    );
  }

  return { context, page };
}

/**
 * If run directly, launch browser for manual X/Twitter login.
 */
const isDirectRun = process.argv[1]?.endsWith('twitter/browser.ts') ||
  process.argv[1]?.endsWith('twitter/browser.js');

if (isDirectRun) {
  console.log('Launching X/Twitter browser for manual login...');
  console.log(`Session stored at: ${TWITTER_BROWSER_DATA_DIR}`);
  console.log('Log in to X, then close the browser window.\n');

  if (!existsSync(TWITTER_BROWSER_DATA_DIR)) {
    mkdirSync(TWITTER_BROWSER_DATA_DIR, { recursive: true });
  }

  const ctx = await chromium.launchPersistentContext(TWITTER_BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const pg = ctx.pages()[0] ?? (await ctx.newPage());
  await pg.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded' });

  console.log('Waiting for you to log in...');
  await ctx.waitForEvent('close').catch(() => {});
  console.log('Browser closed. Session saved.');
}
