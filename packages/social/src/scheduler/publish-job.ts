import {
  getNextScheduledItem,
  updateContentQueueStatus,
} from '@wlu/shared';
import { browserPublishReel } from '../platforms/instagram/browser-publish.js';

/**
 * Check for the next scheduled item and publish it if due.
 */
export async function publishNextScheduled(
  options: { platform?: 'instagram' | 'tiktok'; dryRun?: boolean } = {},
): Promise<boolean> {
  const { platform = 'instagram', dryRun = false } = options;

  const item = await getNextScheduledItem(platform);

  if (!item) {
    console.log('[publish-job] No items due for publishing');
    return false;
  }

  console.log(`[publish-job] Publishing: ${item.id} (scheduled for ${item.scheduledFor})`);

  if (dryRun) {
    console.log(`[publish-job] [DRY RUN] Would publish: ${item.videoPath}`);
    console.log(`[publish-job] [DRY RUN] Caption: "${item.caption}"`);
    return true;
  }

  try {
    const result = await browserPublishReel({
      videoPath: item.videoPath,
      caption: `${item.caption ?? ''}\n\n${(item.hashtags ?? []).join(' ')}`.trim(),
      contentQueueId: item.id,
      messageIds: item.messageIds,
      template: item.template,
      mood: item.mood ?? undefined,
      isExploration: item.isExploration,
    });

    console.log(`[publish-job] Published! Post ID: ${result.postId}`);
    return true;
  } catch (err) {
    console.error(`[publish-job] Failed to publish ${item.id}:`, err);
    await updateContentQueueStatus(item.id, 'failed', {
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
