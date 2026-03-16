import type { Page } from 'playwright';
import { getRecentlyFollowedUsernames } from '@wlu/shared';
import { launchTikTok, navigateToProfile } from '../platforms/tiktok/browser.js';
import { jitteredSleep } from '../scheduler/timing.js';

const OUR_USERNAME = 'u.wordsleftunsaid';

interface UnfollowResult {
  checked: number;
  unfollowed: number;
  errors: number;
}

/**
 * Run a TikTok unfollow session.
 *
 * Opens our following list, visits each profile, checks if they follow us back.
 * Unfollows those who don't. Max 10 per session to stay safe.
 */
export async function runTikTokUnfollowSession(
  options: { dryRun?: boolean; maxUnfollows?: number } = {},
): Promise<UnfollowResult> {
  const { dryRun = false, maxUnfollows = 10 } = options;
  const result: UnfollowResult = { checked: 0, unfollowed: 0, errors: 0 };

  console.log(`[unfollow-tk] Starting session (max: ${maxUnfollows}, dryRun: ${dryRun})`);

  const recentlyFollowed = await getRecentlyFollowedUsernames('tiktok', 7);
  const cooldownSet = new Set(recentlyFollowed.map((u) => u.toLowerCase()));
  if (cooldownSet.size > 0) {
    console.log(`[unfollow-tk] Cooldown: ${cooldownSet.size} accounts followed in the last 7 days`);
  }

  const { context, page } = await launchTikTok();

  try {
    await navigateToProfile(page, OUR_USERNAME);
    await page.waitForTimeout(3000);

    // Click "Following" count to open following list
    const followingLink = page
      .locator('a[href*="/following"], [data-e2e="following-count"]')
      .first();

    if (!(await followingLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      // Fallback: look for text containing "Following"
      const followingText = page.locator('strong, span').filter({ hasText: /Following/i }).first();
      if (await followingText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await followingText.click();
      } else {
        console.log('[unfollow-tk] Could not find "Following" link on profile');
        await page.screenshot({ path: '/tmp/unfollow-tk-debug-profile.png' }).catch(() => {});
        return result;
      }
    } else {
      await followingLink.click();
    }
    await page.waitForTimeout(3000);

    // Collect usernames from following list
    // TikTok shows a list with links to profiles
    const userLinks = page.locator('a[href*="/@"]');
    const linkCount = await userLinks.count();
    console.log(`[unfollow-tk] Found ${linkCount} entries in following list`);

    const usernames: string[] = [];
    for (let i = 0; i < Math.min(linkCount, 40); i++) {
      const href = await userLinks.nth(i).getAttribute('href').catch(() => null);
      if (href) {
        const match = href.match(/@([^/?]+)/);
        if (match && match[1] !== OUR_USERNAME && !usernames.includes(match[1])) {
          usernames.push(match[1]);
        }
      }
    }

    console.log(`[unfollow-tk] Collected ${usernames.length} unique usernames to check`);

    // Visit each profile and check follow-back status
    for (const username of usernames) {
      if (result.unfollowed >= maxUnfollows) {
        console.log(`[unfollow-tk] Reached max unfollows (${maxUnfollows})`);
        break;
      }

      try {
        await navigateToProfile(page, username);
        result.checked++;

        if (cooldownSet.has(username.toLowerCase())) {
          console.log(`[unfollow-tk] @${username} followed recently — cooldown, keeping`);
          continue;
        }

        // Check for "Follow back" text which indicates they follow us
        const followsBack = page
          .locator('[data-e2e="follow-button"], button')
          .filter({ hasText: /follow back/i })
          .first();
        const isFollowBack = await followsBack.isVisible({ timeout: 2000 }).catch(() => false);

        if (isFollowBack) {
          console.log(`[unfollow-tk] @${username} follows us back — keeping`);
          continue;
        }

        // Check if we're following them (button shows "Following")
        const followingBtn = page
          .locator('[data-e2e="follow-button"], button')
          .filter({ hasText: /^Following$/i })
          .first();

        if (!(await followingBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
          console.log(`[unfollow-tk] No "Following" button for @${username} — skipping`);
          continue;
        }

        if (dryRun) {
          console.log(`[unfollow-tk] [DRY RUN] Would unfollow @${username}`);
          result.unfollowed++;
          continue;
        }

        // Click "Following" to unfollow
        await followingBtn.click();
        await page.waitForTimeout(1500);

        // TikTok may show a confirmation — look for "Unfollow" button
        const unfollowConfirm = page
          .locator('button')
          .filter({ hasText: /^Unfollow$/i })
          .first();
        if (await unfollowConfirm.isVisible({ timeout: 2000 }).catch(() => false)) {
          await unfollowConfirm.click();
          await page.waitForTimeout(1000);
        }

        result.unfollowed++;
        console.log(`[unfollow-tk] Unfollowed @${username} (${result.unfollowed}/${maxUnfollows})`);

        await jitteredSleep(4000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[unfollow-tk] Error checking @${username}: ${msg.slice(0, 80)}`);
        result.errors++;
      }
    }
  } finally {
    await context.close();
  }

  console.log(
    `[unfollow-tk] Session complete — checked: ${result.checked}, unfollowed: ${result.unfollowed}, errors: ${result.errors}`,
  );

  return result;
}
