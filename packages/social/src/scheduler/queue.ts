import {
  getContentQueue,
  updateContentQueueStatus,
  getScheduleConfig,
  getLatestStrategyBrief,
} from '@wlu/shared';
import type { ContentQueueItem, StrategyBrief } from '@wlu/shared';

/**
 * Assign scheduled posting times to captioned items in the content queue.
 * Uses schedule config and strategy briefs to pick optimal times.
 * Returns the number of items scheduled.
 */
export async function scheduleCaptionedItems(
  options: { platform?: 'instagram' | 'tiktok'; dryRun?: boolean } = {},
): Promise<number> {
  const { platform = 'instagram', dryRun = false } = options;

  const captionedItems = await getContentQueue({ status: 'captioned', platform });
  if (captionedItems.length === 0) {
    console.log('[queue] No captioned items to schedule');
    return 0;
  }

  // Get preferred posting times
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
 * Get the next N available posting time slots.
 * Distributes posts across preferred hours with no more than 1 post per slot.
 */
function computeNextSlots(preferredHours: number[], count: number): Date[] {
  const slots: Date[] = [];
  const now = new Date();

  // Start from the next available hour
  let currentDate = new Date(now);
  currentDate.setMinutes(0, 0, 0);

  // If the current hour has passed, move to next
  if (now.getMinutes() > 30) {
    currentDate.setHours(currentDate.getHours() + 1);
  }

  // Look ahead up to 7 days for available slots
  const maxDate = new Date(now.getTime() + 7 * 86400000);

  while (slots.length < count && currentDate < maxDate) {
    const hour = currentDate.getHours();

    if (preferredHours.includes(hour)) {
      // Add jitter: ±15 minutes to avoid posting at exact hours
      const jitterMs = (Math.random() - 0.5) * 30 * 60000;
      const slot = new Date(currentDate.getTime() + jitterMs);

      // Only schedule in the future
      if (slot > now) {
        slots.push(slot);
      }
    }

    currentDate.setHours(currentDate.getHours() + 1);
  }

  return slots;
}

/**
 * Determine preferred posting hours from schedule config and strategy briefs.
 * Falls back to sensible defaults if no data is available.
 */
async function getPreferredPostingHours(
  platform: 'instagram' | 'tiktok',
): Promise<number[]> {
  // Default posting hours (EST-friendly: 7am, 12pm, 5pm, 8pm)
  const defaults = [7, 12, 17, 20];

  try {
    // Check strategy brief first (learned optimal hours)
    const briefRecord = await getLatestStrategyBrief();
    if (briefRecord) {
      const brief = briefRecord.brief as unknown as StrategyBrief;
      if (brief.bestPostingHours && brief.bestPostingHours.length > 0) {
        return brief.bestPostingHours;
      }
    }

    // Fall back to schedule config
    const configs = await getScheduleConfig(platform);
    if (configs.length > 0) {
      const hours = configs
        .filter((c) => c.preferredHour !== null)
        .map((c) => c.preferredHour as number);
      if (hours.length > 0) return hours;
    }
  } catch {
    // Use defaults on any error
  }

  return defaults;
}

/**
 * Get a summary of the current queue state.
 */
export async function getQueueStatus(
  platform?: 'instagram' | 'tiktok',
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
