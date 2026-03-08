import 'dotenv/config';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const BROWSER_DATA_DIR = resolve(process.env.HOME ?? '.', '.wlu-instagram-session');
if (!existsSync(BROWSER_DATA_DIR)) mkdirSync(BROWSER_DATA_DIR, { recursive: true });

async function main() {
  console.log('[delete] Launching browser...');
  const context = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = context.pages()[0] ?? await context.newPage();

  try {
    console.log('[delete] Navigating to profile...');
    await page.goto('https://www.instagram.com/u.wordsleftunsent/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(5000);

    // Count posts
    const postLinks = page.locator('a[href*="/p/"], a[href*="/reel/"]');
    const postCount = await postLinks.count();
    console.log(`[delete] Found ${postCount} posts to delete`);

    for (let i = 0; i < postCount; i++) {
      // Always click the first post (since we delete and go back)
      console.log(`[delete] Opening post ${i + 1}/${postCount}...`);
      await page.goto('https://www.instagram.com/u.wordsleftunsent/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.waitForTimeout(3000);

      const links = page.locator('a[href*="/p/"], a[href*="/reel/"]');
      const count = await links.count();
      if (count === 0) {
        console.log('[delete] No more posts found');
        break;
      }

      await links.first().click({ timeout: 10000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `/tmp/ig-delete-${i}-before.png` });

      // Click the three-dot menu
      console.log('[delete] Opening menu...');
      const moreBtn = page.locator('svg[aria-label="More options"]').first();
      if (!(await moreBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
        console.log('[delete] More options button not found, taking screenshot');
        await page.screenshot({ path: `/tmp/ig-delete-${i}-nomenu.png` });
        continue;
      }
      await moreBtn.click();
      await page.waitForTimeout(1500);

      // Click "Delete"
      console.log('[delete] Clicking Delete...');
      const deleteBtn = page.getByRole('button', { name: 'Delete' });
      if (!(await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
        // Try text-based selector
        const deleteBtnAlt = page.locator('button:has-text("Delete")').first();
        if (await deleteBtnAlt.isVisible({ timeout: 2000 }).catch(() => false)) {
          await deleteBtnAlt.click();
        } else {
          console.log('[delete] Delete button not found, taking screenshot');
          await page.screenshot({ path: `/tmp/ig-delete-${i}-nodelete.png` });
          await page.keyboard.press('Escape');
          continue;
        }
      } else {
        await deleteBtn.click();
      }
      await page.waitForTimeout(1500);

      // Confirm deletion
      console.log('[delete] Confirming delete...');
      const confirmBtn = page.getByRole('button', { name: 'Delete' });
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
      } else {
        // Try any button with "Delete" text
        const confirmAlt = page.locator('button:has-text("Delete")').first();
        if (await confirmAlt.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmAlt.click();
        }
      }
      await page.waitForTimeout(3000);

      console.log(`[delete] Deleted post ${i + 1}`);
      await page.screenshot({ path: `/tmp/ig-delete-${i}-after.png` });
    }

    console.log('[delete] Done!');
  } finally {
    await context.close();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
