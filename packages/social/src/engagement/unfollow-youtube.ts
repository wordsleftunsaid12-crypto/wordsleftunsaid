import type { Page } from 'playwright';
import { getRecentlyFollowedUsernames } from '@wlu/shared';
import { launchYouTube } from '../platforms/youtube/browser.js';
import { jitteredSleep } from '../scheduler/timing.js';

interface UnsubscribeResult {
  checked: number;
  unsubscribed: number;
  errors: number;
}

/**
 * Run a YouTube unsubscribe session.
 *
 * Opens the subscriptions page, checks each channel's subscriber count
 * relative to ours. Unsubscribes from channels that haven't subscribed back
 * (i.e. large channels that won't notice/reciprocate).
 * Max 5 per session.
 */
export async function runYouTubeUnsubscribeSession(
  options: { dryRun?: boolean; maxUnsubscribes?: number } = {},
): Promise<UnsubscribeResult> {
  const { dryRun = false, maxUnsubscribes = 5 } = options;
  const result: UnsubscribeResult = { checked: 0, unsubscribed: 0, errors: 0 };

  console.log(`[unfollow-yt] Starting session (max: ${maxUnsubscribes}, dryRun: ${dryRun})`);

  const recentlyFollowed = await getRecentlyFollowedUsernames('youtube', 7);
  const cooldownSet = new Set(recentlyFollowed.map((u) => u.toLowerCase()));
  if (cooldownSet.size > 0) {
    console.log(`[unfollow-yt] Cooldown: ${cooldownSet.size} channels subscribed in the last 7 days`);
  }

  const { context, page } = await launchYouTube();

  try {
    // Navigate to the subscriptions management page
    await page.goto('https://www.youtube.com/feed/channels', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(5000);

    // Collect channel entries — each has a subscribe/subscribed button
    // YouTube shows channels with "Subscribed" buttons
    const channelEntries = page.locator('ytd-channel-renderer, ytd-grid-channel-renderer');
    const entryCount = await channelEntries.count();
    console.log(`[unfollow-yt] Found ${entryCount} subscriptions`);

    if (entryCount === 0) {
      // Try alternate layout — YouTube sometimes uses different renderers
      console.log('[unfollow-yt] No channels found with primary selector, trying alternate');
      await page.screenshot({ path: '/tmp/unfollow-yt-debug.png' }).catch(() => {});
      return result;
    }

    for (let i = 0; i < Math.min(entryCount, 30); i++) {
      if (result.unsubscribed >= maxUnsubscribes) {
        console.log(`[unfollow-yt] Reached max unsubscribes (${maxUnsubscribes})`);
        break;
      }

      try {
        const entry = channelEntries.nth(i);
        result.checked++;

        // Get channel name
        const channelLink = entry.locator('a[href*="/@"], a[href*="/channel/"]').first();
        const channelName = await channelLink.textContent({ timeout: 3000 }).catch(() => null);
        const href = await channelLink.getAttribute('href').catch(() => null);

        if (!channelName) continue;
        const name = channelName.trim();

        // Check cooldown
        if (cooldownSet.has(name.toLowerCase()) || cooldownSet.has(name.replace(/^@/, '').toLowerCase())) {
          console.log(`[unfollow-yt] ${name} subscribed recently — cooldown, keeping`);
          continue;
        }

        // Check subscriber count — skip small channels (they might be peers/supporters)
        const subCountText = await entry
          .locator('#subscribers, #subscriber-count, span')
          .filter({ hasText: /subscriber/i })
          .first()
          .textContent({ timeout: 2000 })
          .catch(() => '');

        const subCount = parseSubscriberCount(subCountText ?? '');

        // Keep channels under 10K subscribers (small creators, potential community)
        if (subCount > 0 && subCount < 10000) {
          console.log(`[unfollow-yt] ${name} has ${subCount} subs (small creator) — keeping`);
          continue;
        }

        if (dryRun) {
          console.log(`[unfollow-yt] [DRY RUN] Would unsubscribe from ${name} (${subCountText?.trim()})`);
          result.unsubscribed++;
          continue;
        }

        // Find and click the "Subscribed" button
        const subscribedBtn = entry
          .locator('button')
          .filter({ hasText: /^Subscribed$/i })
          .first();

        if (!(await subscribedBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
          continue;
        }

        await subscribedBtn.click();
        await page.waitForTimeout(1500);

        // Confirm unsubscribe in the dialog
        const unsubConfirm = page
          .locator('button')
          .filter({ hasText: /^Unsubscribe$/i })
          .first();

        if (await unsubConfirm.isVisible({ timeout: 3000 }).catch(() => false)) {
          await unsubConfirm.click();
          await page.waitForTimeout(1000);
          result.unsubscribed++;
          console.log(`[unfollow-yt] Unsubscribed from ${name} (${result.unsubscribed}/${maxUnsubscribes})`);
        } else {
          // Dismiss if no confirm dialog
          await page.keyboard.press('Escape');
        }

        await jitteredSleep(3000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[unfollow-yt] Error on entry ${i}: ${msg.slice(0, 80)}`);
        result.errors++;
      }
    }
  } finally {
    await context.close();
  }

  console.log(
    `[unfollow-yt] Session complete — checked: ${result.checked}, unsubscribed: ${result.unsubscribed}, errors: ${result.errors}`,
  );

  return result;
}

/**
 * Parse YouTube subscriber count strings like "1.2K subscribers", "500 subscribers", "1M subscribers".
 */
function parseSubscriberCount(text: string): number {
  const match = text.match(/([\d.]+)\s*([KMB]?)/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const multiplier = match[2].toUpperCase();
  if (multiplier === 'K') return num * 1000;
  if (multiplier === 'M') return num * 1000000;
  if (multiplier === 'B') return num * 1000000000;
  return num;
}
