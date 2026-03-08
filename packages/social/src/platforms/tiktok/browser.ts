/**
 * Shared Playwright browser utilities for TikTok automation.
 * All TikTok browser modules share the same persistent session.
 */
import { chromium, type BrowserContext, type Page } from 'playwright';
import { resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

/** Persistent browser profile — stays logged in across sessions */
export const TIKTOK_BROWSER_DATA_DIR = resolve(
  process.env.HOME ?? '.',
  '.wlu-tiktok-session',
);

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
}

/**
 * Launch TikTok in a persistent browser context and verify login.
 * Throws if not logged in (user must log in manually first).
 */
export async function launchTikTok(): Promise<BrowserSession> {
  if (!existsSync(TIKTOK_BROWSER_DATA_DIR)) {
    mkdirSync(TIKTOK_BROWSER_DATA_DIR, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(TIKTOK_BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto('https://www.tiktok.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);

  // Dismiss common modals
  await dismissModals(page);

  // Verify logged in — if redirected to /login, session is invalid
  const currentUrl = page.url();
  const hasLogin = !currentUrl.includes('/login');

  if (!hasLogin) {
    // Take debug screenshot before throwing
    await page.screenshot({ path: '/tmp/tiktok-login-check-fail.png' }).catch(() => {});
    console.error('[tiktok] Login check failed. Screenshot: /tmp/tiktok-login-check-fail.png');
    await context.close();
    throw new Error(
      'Not logged in to TikTok. Run the login flow first:\n' +
        '  npx tsx packages/social/src/platforms/tiktok/browser.ts',
    );
  }

  return { context, page };
}

/**
 * Dismiss common TikTok modals (cookies banner, notifications, etc.).
 */
export async function dismissModals(page: Page): Promise<void> {
  // Cookie consent banner
  try {
    const cookieBanner = page.locator('tiktok-cookie-banner');
    if (await cookieBanner.isVisible({ timeout: 2000 }).catch(() => false)) {
      const declineBtn = cookieBanner.locator('button').filter({ hasText: /decline|reject/i }).first();
      if (await declineBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await declineBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  } catch {
    // No cookie banner
  }

  // Generic "Not now" or "Maybe later" dismissals
  try {
    const notNowBtn = page
      .getByRole('button', { name: /not now|maybe later|skip/i })
      .first();
    if (await notNowBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notNowBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch {
    // No modal
  }
}

/**
 * Navigate to a specific TikTok profile.
 */
export async function navigateToProfile(
  page: Page,
  username: string,
): Promise<void> {
  await page.goto(`https://www.tiktok.com/@${username}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(3000);
}

/**
 * If run directly, launch browser for manual TikTok login.
 */
const isDirectRun = process.argv[1]?.endsWith('tiktok/browser.ts') ||
  process.argv[1]?.endsWith('tiktok/browser.js');

if (isDirectRun) {
  console.log('Launching TikTok browser for manual login...');
  console.log(`Session stored at: ${TIKTOK_BROWSER_DATA_DIR}`);
  console.log('Log in to TikTok, then close the browser window.\n');

  if (!existsSync(TIKTOK_BROWSER_DATA_DIR)) {
    mkdirSync(TIKTOK_BROWSER_DATA_DIR, { recursive: true });
  }

  const ctx = await chromium.launchPersistentContext(TIKTOK_BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const pg = ctx.pages()[0] ?? (await ctx.newPage());
  await pg.goto('https://www.tiktok.com/login', { waitUntil: 'domcontentloaded' });

  console.log('Waiting for you to log in...');
  // Keep alive until user closes the browser
  await ctx.waitForEvent('close').catch(() => {});
  console.log('Browser closed. Session saved.');
}
