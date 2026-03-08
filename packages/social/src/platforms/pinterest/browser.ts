/**
 * Shared Playwright browser utilities for Pinterest automation.
 */
import { chromium, type BrowserContext, type Page } from 'playwright';
import { resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

export const PINTEREST_BROWSER_DATA_DIR = resolve(
  process.env.HOME ?? '.',
  '.wlu-pinterest-session',
);

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
}

/**
 * Launch Pinterest in a persistent browser context and verify login.
 */
export async function launchPinterest(): Promise<BrowserSession> {
  if (!existsSync(PINTEREST_BROWSER_DATA_DIR)) {
    mkdirSync(PINTEREST_BROWSER_DATA_DIR, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(PINTEREST_BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto('https://www.pinterest.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(5000);

  // Verify logged in — Pinterest shows a profile icon when logged in
  const isLoggedIn = await page
    .locator('[data-test-id="header-profile"], [aria-label="Your profile"]')
    .first()
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (!isLoggedIn) {
    await page.screenshot({ path: '/tmp/pinterest-login-check-fail.png' }).catch(() => {});
    console.error('[pinterest] Login check failed. Screenshot: /tmp/pinterest-login-check-fail.png');
    await context.close();
    throw new Error(
      'Not logged in to Pinterest. Run the login flow first:\n' +
        '  npx tsx packages/social/src/platforms/pinterest/browser.ts',
    );
  }

  return { context, page };
}

/**
 * If run directly, launch browser for manual Pinterest login.
 */
const isDirectRun = process.argv[1]?.endsWith('pinterest/browser.ts') ||
  process.argv[1]?.endsWith('pinterest/browser.js');

if (isDirectRun) {
  console.log('Launching Pinterest browser for manual login...');
  console.log(`Session stored at: ${PINTEREST_BROWSER_DATA_DIR}`);
  console.log('Log in to Pinterest, then close the browser window.\n');

  if (!existsSync(PINTEREST_BROWSER_DATA_DIR)) {
    mkdirSync(PINTEREST_BROWSER_DATA_DIR, { recursive: true });
  }

  const ctx = await chromium.launchPersistentContext(PINTEREST_BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const pg = ctx.pages()[0] ?? (await ctx.newPage());
  await pg.goto('https://www.pinterest.com/login/', { waitUntil: 'domcontentloaded' });

  console.log('Waiting for you to log in...');
  await ctx.waitForEvent('close').catch(() => {});
  console.log('Browser closed. Session saved.');
}
