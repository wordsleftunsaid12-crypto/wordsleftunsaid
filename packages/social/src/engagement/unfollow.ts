import type { Page } from 'playwright';
import { getRecentlyFollowedUsernames } from '@wlu/shared';
import { launchInstagram, navigateToProfile } from '../platforms/instagram/browser.js';
import { jitteredSleep } from '../scheduler/timing.js';

const OUR_USERNAME = 'u.wordsleftunsaid';

interface UnfollowResult {
  checked: number;
  unfollowed: number;
  errors: number;
}

/**
 * Run an Instagram unfollow session.
 *
 * Opens our following list, visits each profile, checks if they follow us back.
 * Unfollows those who don't. Max 15 per session to stay safe.
 */
export async function runUnfollowSession(
  options: { dryRun?: boolean; maxUnfollows?: number } = {},
): Promise<UnfollowResult> {
  const { dryRun = false, maxUnfollows = 15 } = options;
  const result: UnfollowResult = { checked: 0, unfollowed: 0, errors: 0 };

  console.log(`[unfollow] Starting session (max: ${maxUnfollows}, dryRun: ${dryRun})`);

  // Get recently followed usernames to avoid follow/unfollow churn
  const recentlyFollowed = await getRecentlyFollowedUsernames('instagram', 7);
  const cooldownSet = new Set(recentlyFollowed.map(u => u.toLowerCase()));
  if (cooldownSet.size > 0) {
    console.log(`[unfollow] Cooldown: ${cooldownSet.size} accounts followed in the last 7 days will be skipped`);
  }

  const { context, page } = await launchInstagram();

  try {
    // Navigate to our profile
    await navigateToProfile(page, OUR_USERNAME);
    await page.waitForTimeout(2000);

    // Click "following" count to open the following list
    // Try multiple selectors — IG layout changes frequently
    const followingLink = page.locator('a[href*="/following"]').first()
      .or(page.locator('header section ul li').filter({ hasText: /following/i }).first())
      .or(page.locator('header').getByText(/following/i).first());

    if (!(await followingLink.first().isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log('[unfollow] Could not find "following" link on profile');
      await page.screenshot({ path: '/tmp/unfollow-debug-profile.png' }).catch(() => {});
      return result;
    }

    await followingLink.first().click();
    await page.waitForTimeout(2000);

    // Wait for the following list dialog to appear
    const dialog = page.locator('[role="dialog"]').first();
    if (!(await dialog.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log('[unfollow] Following list dialog did not appear');
      await page.screenshot({ path: '/tmp/unfollow-debug-dialog.png' }).catch(() => {});
      return result;
    }

    // Scroll the list to load more entries
    for (let scroll = 0; scroll < 8; scroll++) {
      await dialog.locator('div').first().evaluate((el) => {
        // Scroll the scrollable container within the dialog
        const scrollable = el.closest('[style*="overflow"]') ?? el.parentElement;
        if (scrollable) scrollable.scrollTop += 500;
      }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    // Collect usernames from the following list
    // Each entry has a link to the user's profile
    const userLinks = dialog.locator('a[href*="/"]').filter({ hasText: /\w/ });
    const linkCount = await userLinks.count();
    console.log(`[unfollow] Found ${linkCount} entries in following list`);

    const usernames: string[] = [];
    for (let i = 0; i < Math.min(linkCount, 50); i++) {
      const href = await userLinks.nth(i).getAttribute('href').catch(() => null);
      if (href) {
        const match = href.match(/\/([^/]+)\/?$/);
        if (match && match[1] !== OUR_USERNAME && !usernames.includes(match[1])) {
          usernames.push(match[1]);
        }
      }
    }

    console.log(`[unfollow] Collected ${usernames.length} unique usernames to check`);

    // Close the dialog
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Visit each profile and check if they follow us back
    for (const username of usernames) {
      if (result.unfollowed >= maxUnfollows) {
        console.log(`[unfollow] Reached max unfollows (${maxUnfollows})`);
        break;
      }

      try {
        await navigateToProfile(page, username);
        result.checked++;

        // Skip recently followed accounts (7-day cooldown)
        if (cooldownSet.has(username.toLowerCase())) {
          console.log(`[unfollow] @${username} followed recently — cooldown, keeping`);
          continue;
        }

        // Check if "follows you" badge is visible
        const followsYou = page.locator('text=Follows you').first();
        const isFollowBack = await followsYou.isVisible({ timeout: 2000 }).catch(() => false);

        if (isFollowBack) {
          console.log(`[unfollow] @${username} follows us back — keeping`);
          continue;
        }

        // Not following back — unfollow
        if (dryRun) {
          console.log(`[unfollow] [DRY RUN] Would unfollow @${username}`);
          result.unfollowed++;
          continue;
        }

        // Click the "Following" button (which will show unfollow option)
        const followingBtn = page
          .locator('header')
          .getByRole('button', { name: /following/i })
          .first();

        if (!(await followingBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
          console.log(`[unfollow] No "Following" button for @${username} — skipping`);
          continue;
        }

        await followingBtn.click();
        await page.waitForTimeout(1500);

        // Debug screenshot (uncomment if needed)
        // await page.screenshot({ path: `/tmp/unfollow-confirm-${username}.png` }).catch(() => {});

        // Click "Unfollow" in the confirmation dialog/bottom sheet
        // Instagram shows a bottom sheet with several options including "Unfollow"
        const unfollowConfirm = page
          .locator('button')
          .filter({ hasText: /^Unfollow$/i })
          .or(page.locator('[role="dialog"] button').filter({ hasText: /unfollow/i }))
          .or(page.getByRole('button', { name: /unfollow/i }))
          .first();

        if (await unfollowConfirm.isVisible({ timeout: 3000 }).catch(() => false)) {
          await unfollowConfirm.click();
          await page.waitForTimeout(1000);
          result.unfollowed++;
          console.log(`[unfollow] Unfollowed @${username} (${result.unfollowed}/${maxUnfollows})`);
        } else {
          console.log(`[unfollow] Unfollow confirmation not found for @${username}`);
          await page.keyboard.press('Escape');
        }

        await jitteredSleep(4000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[unfollow] Error checking @${username}: ${msg.slice(0, 80)}`);
        result.errors++;
      }
    }
  } finally {
    await context.close();
  }

  console.log(
    `[unfollow] Session complete — checked: ${result.checked}, unfollowed: ${result.unfollowed}, errors: ${result.errors}`,
  );

  return result;
}
