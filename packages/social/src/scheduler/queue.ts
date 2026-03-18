import {
  getContentQueue,
  updateContentQueueStatus,
  getScheduleConfig,
  getLatestStrategyBrief,
  getOverdueItems,
} from '@wlu/shared';
import type { StrategyBrief, Platform } from '@wlu/shared';

/** Per-platform default posting hours in Pacific Time (America/Los_Angeles). */
const PLATFORM_DEFAULTS: Record<Platform, number[]> = {
  instagram: [7, 12, 17],
  tiktok: [10, 14, 19],
  youtube: [14, 17],
  reddit: [8, 18],
  pinterest: [20, 21],
  twitter: [8, 12, 17],
  threads: [7, 9, 12, 15, 19, 21],
};

/** Default timezone when no config exists. */
const DEFAULT_TZ = 'America/Los_Angeles';

/**
 * Convert an hour in a given timezone to UTC for today's date.
 * Returns the UTC hour (0-23).
 */
function convertHourToUtc(localHour: number, timezone: string): number {
  // Create a date at localHour in the given timezone, then extract UTC hour
  const now = new Date();
  const dateStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  // Use Intl to compute the offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });

  // Find offset: create a date at noon UTC, check what hour it is locally
  const noonUtc = new Date(`${dateStr}T12:00:00Z`);
  const localNoonStr = formatter.format(noonUtc);
  const localNoon = parseInt(localNoonStr, 10);
  const offsetHours = localNoon - 12; // positive = ahead of UTC

  // Convert local hour to UTC
  let utcHour = localHour - offsetHours;
  if (utcHour < 0) utcHour += 24;
  if (utcHour >= 24) utcHour -= 24;
  return utcHour;
}

/**
 * Assign scheduled posting times to captioned items in the content queue.
 * Uses schedule config and strategy briefs to pick optimal times.
 * Returns the number of items scheduled.
 */
export async function scheduleCaptionedItems(
  options: { platform?: Platform; dryRun?: boolean } = {},
): Promise<number> {
  const { platform = 'instagram', dryRun = false } = options;

  const captionedItems = await getContentQueue({ status: 'captioned', platform });
  if (captionedItems.length === 0) {
    return 0;
  }

  // Get preferred posting times (UTC)
  const preferredHours = await getPreferredPostingHours(platform);
  const nextSlots = computeNextSlots(preferredHours, captionedItems.length);

  let scheduled = 0;

  for (let i = 0; i < captionedItems.length; i++) {
    const item = captionedItems[i];
    const scheduledFor = nextSlots[i];

    if (!scheduledFor) break;

    try {
      if (dryRun) {
        console.log(
          `[queue] [DRY RUN] ${item.id} → ${scheduledFor.toISOString()}`,
        );
      } else {
        await updateContentQueueStatus(item.id, 'scheduled', {
          scheduledFor: scheduledFor.toISOString(),
        });
        console.log(`[queue] Scheduled ${item.id} for ${scheduledFor.toISOString()}`);
      }
      scheduled++;
    } catch (err) {
      console.warn(`[queue] Failed to schedule ${item.id}:`, err);
    }
  }

  console.log(`[queue] Scheduled ${scheduled} item(s)`);
  return scheduled;
}

/**
 * Get the next N available posting time slots (in UTC).
 * Distributes posts across preferred hours with no more than 1 post per slot.
 */
function computeNextSlots(preferredHoursUtc: number[], count: number): Date[] {
  const slots: Date[] = [];
  const now = new Date();

  // Start from the current hour (floored)
  const currentDate = new Date(now);
  currentDate.setUTCMinutes(0, 0, 0);

  // If we're past the halfway mark of this hour, skip to next
  if (now.getUTCMinutes() > 30) {
    currentDate.setUTCHours(currentDate.getUTCHours() + 1);
  }

  // Look ahead up to 7 days for available slots
  const maxDate = new Date(now.getTime() + 7 * 86400000);

  while (slots.length < count && currentDate < maxDate) {
    const hour = currentDate.getUTCHours();

    if (preferredHoursUtc.includes(hour)) {
      // Add jitter: ±15 minutes to avoid posting at exact hours
      const jitterMs = (Math.random() - 0.5) * 30 * 60000;
      const slot = new Date(currentDate.getTime() + jitterMs);

      // Only schedule in the future
      if (slot > now) {
        slots.push(slot);
      }
    }

    currentDate.setUTCHours(currentDate.getUTCHours() + 1);
  }

  return slots;
}

/**
 * Determine preferred posting hours (in UTC) from:
 * 1. schedule_config table (user-controlled, primary)
 * 2. Strategy brief bestPostingHours (learned from engagement)
 * 3. Per-platform hardcoded defaults
 */
async function getPreferredPostingHours(
  platform: Platform,
): Promise<number[]> {
  try {
    // 1. Check schedule_config (highest priority)
    const configs = await getScheduleConfig(platform);
    if (configs.length > 0) {
      const hours = configs
        .filter((c) => c.preferredHour !== null)
        .map((c) => convertHourToUtc(c.preferredHour as number, c.timezone));
      if (hours.length > 0) {
        console.log(`[queue] Using schedule_config hours for ${platform}: ${hours.join(', ')} UTC`);
        return hours;
      }
    }

    // 2. Check strategy brief (learned hours)
    const briefRecord = await getLatestStrategyBrief();
    if (briefRecord) {
      const brief = briefRecord.brief as unknown as StrategyBrief;
      if (brief.bestPostingHours && brief.bestPostingHours.length > 0) {
        return brief.bestPostingHours;
      }
    }
  } catch (err) {
    console.warn('[queue] Failed to fetch posting hours config:', err instanceof Error ? err.message : err);
  }

  // 3. Per-platform defaults (converted from Pacific to UTC)
  const localHours = PLATFORM_DEFAULTS[platform] ?? [12, 18, 20];
  return localHours.map((h) => convertHourToUtc(h, DEFAULT_TZ));
}

/**
 * Catch up missed slots after the computer was off.
 * Reschedules overdue items to the next available preferred-hour slots.
 */
export async function catchUpMissedSlots(
  platform: Platform,
): Promise<number> {
  const overdue = await getOverdueItems(platform);
  if (overdue.length === 0) return 0;

  console.log(`[queue] Found ${overdue.length} overdue items for ${platform}`);

  const preferredHours = await getPreferredPostingHours(platform);
  // Request slots for ALL overdue items — they'll spread across multiple days
  // if needed. The daily publish limit handles per-day throttling.
  const newSlots = computeNextSlots(preferredHours, overdue.length);

  let rescheduled = 0;

  for (let i = 0; i < overdue.length; i++) {
    const item = overdue[i];
    const newSlot = newSlots[i];

    if (!newSlot) {
      // Shouldn't happen (computeNextSlots looks 7 days ahead), but just in case
      console.log(`[queue] No available slot for ${item.id.slice(0, 8)} — keeping scheduled`);
      continue;
    }

    try {
      await updateContentQueueStatus(item.id, 'scheduled', {
        scheduledFor: newSlot.toISOString(),
      });
      console.log(`[queue] Rescheduled ${item.id.slice(0, 8)} → ${newSlot.toISOString()}`);
      rescheduled++;
    } catch (err) {
      console.warn(`[queue] Failed to reschedule ${item.id}:`, err);
    }
  }

  if (rescheduled > 0) {
    console.log(`[queue] Rescheduled ${rescheduled} overdue item(s) for ${platform}`);
  }
  return rescheduled;
}

/**
 * Get a summary of the current queue state.
 */
export async function getQueueStatus(
  platform?: Platform,
): Promise<{
  pending: number;
  qa_passed: number;
  captioned: number;
  scheduled: number;
  posted: number;
  failed: number;
}> {
  const statuses = ['pending', 'qa_passed', 'captioned', 'scheduled', 'posted', 'failed'] as const;
  const counts: Record<string, number> = {};

  for (const status of statuses) {
    const items = await getContentQueue({ status, platform, limit: 1000 });
    counts[status] = items.length;
  }

  return counts as {
    pending: number;
    qa_passed: number;
    captioned: number;
    scheduled: number;
    posted: number;
    failed: number;
  };
}
