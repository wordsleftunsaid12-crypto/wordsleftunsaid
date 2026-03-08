/**
 * Shared Playwright browser utilities for YouTube automation.
 * All YouTube browser modules share the same persistent session.
 */
import { chromium, type BrowserContext, type Page } from 'playwright';
import { resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

/** Persistent browser profile — stays logged in across sessions */
export const YOUTUBE_BROWSER_DATA_DIR = resolve(
  process.env.HOME ?? '.',
  '.wlu-youtube-session',
);

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
}

/**
 * Launch YouTube Studio in a persistent browser context and verify login.
 * Throws if not logged in (user must log in manually first).
 */
export async function launchYouTube(): Promise<BrowserSession> {
  if (!existsSync(YOUTUBE_BROWSER_DATA_DIR)) {
    mkdirSync(YOUTUBE_BROWSER_DATA_DIR, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(YOUTUBE_BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto('https://studio.youtube.com', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);

  // Dismiss common modals
  await dismissModals(page);

  // Verify logged in — Studio redirects to accounts.google.com if not signed in
  const currentUrl = page.url();
  const isLoggedIn =
    currentUrl.includes('studio.youtube.com') &&
    !currentUrl.includes('accounts.google.com');

  if (!isLoggedIn) {
    await page.screenshot({ path: '/tmp/youtube-login-check-fail.png' }).catch(() => {});
    console.error('[youtube] Login check failed. Screenshot: /tmp/youtube-login-check-fail.png');
    await context.close();
    throw new Error(
      'Not logged in to YouTube. Run the login flow first:\n' +
        '  npx tsx packages/social/src/platforms/youtube/browser.ts',
    );
  }

  return { context, page };
}

/**
 * Dismiss common YouTube Studio modals (cookie consent, notifications, tips).
 */
export async function dismissModals(page: Page): Promise<void> {
  // Google cookie consent
  try {
    const acceptBtn = page
      .locator('button')
      .filter({ hasText: /accept all|i agree/i })
      .first();
    if (await acceptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await acceptBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch {
    // No cookie consent
  }

  // "Got it" / "Dismiss" type modals
  try {
    const gotItBtn = page
      .getByRole('button', { name: /got it|dismiss|not now|skip|no thanks/i })
      .first();
    if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch {
    // No modal
  }
}

/**
 * If run directly, launch browser for manual YouTube/Google login.
 */
const isDirectRun = process.argv[1]?.endsWith('youtube/browser.ts') ||
  process.argv[1]?.endsWith('youtube/browser.js');

if (isDirectRun) {
  console.log('Launching YouTube browser for manual login...');
  console.log(`Session stored at: ${YOUTUBE_BROWSER_DATA_DIR}`);
  console.log('Log in to your Google/YouTube account, then close the browser window.\n');

  if (!existsSync(YOUTUBE_BROWSER_DATA_DIR)) {
    mkdirSync(YOUTUBE_BROWSER_DATA_DIR, { recursive: true });
  }

  const ctx = await chromium.launchPersistentContext(YOUTUBE_BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const pg = ctx.pages()[0] ?? (await ctx.newPage());
  await pg.goto('https://accounts.google.com', { waitUntil: 'domcontentloaded' });

  console.log('Waiting for you to log in...');
  await ctx.waitForEvent('close').catch(() => {});
  console.log('Browser closed. Session saved.');
}
