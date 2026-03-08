/**
 * Shared Playwright browser utilities for Threads automation.
 * Threads may share session with Instagram (same Meta account).
 */
import { chromium, type BrowserContext, type Page } from 'playwright';
import { resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

export const THREADS_BROWSER_DATA_DIR = resolve(
  process.env.HOME ?? '.',
  '.wlu-threads-session',
);

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
}

/**
 * Launch Threads in a persistent browser context and verify login.
 */
export async function launchThreads(): Promise<BrowserSession> {
  if (!existsSync(THREADS_BROWSER_DATA_DIR)) {
    mkdirSync(THREADS_BROWSER_DATA_DIR, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(THREADS_BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto('https://www.threads.net/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);

  // Verify logged in — check for compose/create button
  const isLoggedIn = await page
    .locator('[aria-label="Create"], [aria-label="New thread"], svg[aria-label="Create"]')
    .first()
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (!isLoggedIn) {
    // Also check if we're on a login page
    const onLogin = page.url().includes('/login');
    if (onLogin || !isLoggedIn) {
      await page.screenshot({ path: '/tmp/threads-login-check-fail.png' }).catch(() => {});
      console.error('[threads] Login check failed. Screenshot: /tmp/threads-login-check-fail.png');
      await context.close();
      throw new Error(
        'Not logged in to Threads. Run the login flow first:\n' +
          '  npx tsx packages/social/src/platforms/threads/browser.ts',
      );
    }
  }

  return { context, page };
}

/**
 * If run directly, launch browser for manual Threads login.
 */
const isDirectRun = process.argv[1]?.endsWith('threads/browser.ts') ||
  process.argv[1]?.endsWith('threads/browser.js');

if (isDirectRun) {
  console.log('Launching Threads browser for manual login...');
  console.log(`Session stored at: ${THREADS_BROWSER_DATA_DIR}`);
  console.log('Log in to Threads (uses Instagram account), then close the browser window.\n');

  if (!existsSync(THREADS_BROWSER_DATA_DIR)) {
    mkdirSync(THREADS_BROWSER_DATA_DIR, { recursive: true });
  }

  const ctx = await chromium.launchPersistentContext(THREADS_BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const pg = ctx.pages()[0] ?? (await ctx.newPage());
  await pg.goto('https://www.threads.net/login', { waitUntil: 'domcontentloaded' });

  console.log('Waiting for you to log in...');
  await ctx.waitForEvent('close').catch(() => {});
  console.log('Browser closed. Session saved.');
}
