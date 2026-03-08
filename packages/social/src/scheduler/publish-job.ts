import {
  getNextScheduledItem,
  updateContentQueueStatus,
  createContentQueueItem,
  hasPostForMessages,
  hasQueueItemForMessages,
} from '@wlu/shared';
import { browserPublishReel } from '../platforms/instagram/browser-publish.js';

/** Platforms to auto-cross-post to after a successful publish. */
const CROSS_POST_TARGETS: Record<string, string[]> = {
  instagram: ['tiktok', 'youtube'],
  tiktok: ['instagram', 'youtube'],
  youtube: ['instagram', 'tiktok'],
};

/** CTA domain kept clean — no UTM params in captions (users type URLs manually). */

/** Default hashtags appended to TikTok posts for discovery. */
const TIKTOK_DEFAULT_HASHTAGS = [
  '#wordsleftunsaid',
  '#fyp',
  '#relatable',
  '#emotional',
  '#unsentletters',
  '#deepquotes',
  '#mentalhealthawareness',
];

/**
 * Check for the next scheduled item and publish it if due.
 */
export async function publishNextScheduled(
  options: { platform?: 'instagram' | 'tiktok' | 'youtube'; dryRun?: boolean } = {},
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
    // For TikTok, ensure posts always have discovery hashtags
    let hashtagString = (item.hashtags ?? []).join(' ');
    if (platform === 'tiktok' && !hashtagString) {
      hashtagString = TIKTOK_DEFAULT_HASHTAGS.join(' ');
    }

    const rawCaption = `${item.caption ?? ''}\n\n${hashtagString}`.trim();
    const publishOptions = {
      videoPath: item.videoPath,
      coverImagePath: item.coverImagePath ?? undefined,
      caption: rawCaption,
      contentQueueId: item.id,
      messageIds: item.messageIds,
      template: item.template,
      mood: item.mood ?? undefined,
      isExploration: item.isExploration,
    };

    let result: { postId: string; platformPostId: string | null };

    if (platform === 'tiktok') {
      const { browserPublishTikTok } = await import(
        '../platforms/tiktok/browser-publish.js'
      );
      result = await browserPublishTikTok(publishOptions);
    } else if (platform === 'youtube') {
      const { browserPublishYouTubeShort } = await import(
        '../platforms/youtube/browser-publish.js'
      );
      result = await browserPublishYouTubeShort(publishOptions);
    } else {
      result = await browserPublishReel(publishOptions);
    }

    console.log(`[publish-job] Published! Post ID: ${result.postId}`);

    // Cross-post: queue the same video for other platforms (with dedup)
    const targets = CROSS_POST_TARGETS[platform] ?? [];
    for (const target of targets) {
      const targetPlatform = target as 'instagram' | 'tiktok' | 'youtube';
      try {
        // Skip if already posted on target platform
        const alreadyPosted = await hasPostForMessages(targetPlatform, item.messageIds);
        if (alreadyPosted) {
          console.log(`[publish-job] Skipping cross-post → ${target} (already posted)`);
          continue;
        }
        // Skip if already queued on target platform
        const alreadyQueued = await hasQueueItemForMessages(targetPlatform, item.messageIds);
        if (alreadyQueued) {
          console.log(`[publish-job] Skipping cross-post → ${target} (already queued)`);
          continue;
        }

        const crossPost = await createContentQueueItem({
          videoPath: item.videoPath,
          messageIds: item.messageIds,
          template: item.template,
          mood: item.mood ?? undefined,
          platform: targetPlatform,
          isExploration: item.isExploration,
        });
        // Copy caption and hashtags, set as scheduled for now
        await updateContentQueueStatus(crossPost.id, 'scheduled', {
          caption: item.caption ?? undefined,
          hashtags: item.hashtags ?? undefined,
          scheduledFor: new Date().toISOString(),
        });
        console.log(`[publish-job] Cross-posted → ${target} queue (${crossPost.id.slice(0, 8)})`);
      } catch (err) {
        console.warn(`[publish-job] Cross-post to ${target} failed:`, err instanceof Error ? err.message : err);
      }
    }

    return true;
  } catch (err) {
    console.error(`[publish-job] Failed to publish ${item.id}:`, err);
    await updateContentQueueStatus(item.id, 'failed', {
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
