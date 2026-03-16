import {
  getNextScheduledItem,
  updateContentQueueStatus,
  createContentQueueItem,
  hasPostForMessages,
  hasQueueItemForMessages,
  getMessageById,
} from '@wlu/shared';
import type { Message, Platform } from '@wlu/shared';
import { browserPublishReel } from '../platforms/instagram/browser-publish.js';
import { buildUtmUrl } from '../utils/utm.js';

/** Platforms to auto-cross-post to after a successful publish. */
const CROSS_POST_TARGETS: Record<string, string[]> = {
  instagram: ['tiktok', 'youtube', 'reddit', 'pinterest', 'twitter', 'threads'],
  tiktok: [],
  youtube: [],
  reddit: [],
  pinterest: [],
  twitter: [],
  threads: [],
};

/** Platforms that include clickable links in their posts (get UTM tracking). */
const LINK_PLATFORMS = new Set(['reddit', 'twitter', 'threads', 'pinterest']);

/** Default hashtags appended to TikTok posts for discovery. */
const TIKTOK_DEFAULT_HASHTAGS = [
  '#wordsleftunsent',
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
  options: { platform?: Platform; dryRun?: boolean } = {},
): Promise<boolean> {
  const { platform = 'instagram', dryRun = false } = options;

  const item = await getNextScheduledItem(platform);

  if (!item) {
    return false;
  }

  console.log(`[publish-job] Publishing: ${item.id} (scheduled for ${item.scheduledFor})`);

  if (dryRun) {
    console.log(`[publish-job] [DRY RUN] Would publish: ${item.videoPath}`);
    console.log(`[publish-job] [DRY RUN] Caption: "${item.caption}"`);
    return true;
  }

  try {
    // Fetch original message for text-based platforms (Reddit, Twitter, Threads, Pinterest)
    let sourceMessage: Message | null = null;
    if (item.messageIds?.length) {
      sourceMessage = await getMessageById(item.messageIds[0]);
    }

    // For TikTok, ensure posts always have discovery hashtags
    let hashtagString = (item.hashtags ?? []).join(' ');
    if (platform === 'tiktok' && !hashtagString) {
      hashtagString = TIKTOK_DEFAULT_HASHTAGS.join(' ');
    }

    const rawCaption = `${item.caption ?? ''}\n\n${hashtagString}`.trim();

    // Build UTM-tracked URL for text platforms that include links
    const messageId = item.messageIds?.[0];
    const baseUrl = messageId
      ? `https://wordsleftunsent.com/messages/${messageId}`
      : 'https://wordsleftunsent.com';
    const utmUrl = LINK_PLATFORMS.has(platform)
      ? buildUtmUrl(baseUrl, platform, item.id)
      : undefined;

    const publishOptions = {
      videoPath: item.videoPath,
      coverImagePath: item.coverImagePath ?? undefined,
      caption: rawCaption,
      contentQueueId: item.id,
      messageIds: item.messageIds,
      template: item.template,
      mood: item.mood ?? undefined,
      isExploration: item.isExploration,
      // Original message fields for text-based platforms
      messageContent: sourceMessage?.content,
      messageTo: sourceMessage?.to,
      messageFrom: sourceMessage?.from,
      // UTM-tracked URL for platforms that include links
      utmUrl,
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
    } else if (platform === 'reddit') {
      const { browserPublishReddit } = await import(
        '../platforms/reddit/browser-publish.js'
      );
      result = await browserPublishReddit(publishOptions);
    } else if (platform === 'pinterest') {
      const { browserPublishPinterest } = await import(
        '../platforms/pinterest/browser-publish.js'
      );
      result = await browserPublishPinterest(publishOptions);
    } else if (platform === 'twitter') {
      const { browserPublishTwitter } = await import(
        '../platforms/twitter/browser-publish.js'
      );
      result = await browserPublishTwitter(publishOptions);
    } else if (platform === 'threads') {
      const { browserPublishThreads } = await import(
        '../platforms/threads/browser-publish.js'
      );
      result = await browserPublishThreads(publishOptions);
    } else {
      result = await browserPublishReel(publishOptions);
    }

    console.log(`[publish-job] Published! Post ID: ${result.postId}`);

    // Cross-post: queue the same video for other platforms (with dedup)
    const targets = CROSS_POST_TARGETS[platform] ?? [];
    for (const target of targets) {
      const targetPlatform = target as import('@wlu/shared').Platform;
      try {
        const alreadyPosted = await hasPostForMessages(targetPlatform, item.messageIds);
        if (alreadyPosted) {
          console.log(`[publish-job] Skipping cross-post → ${target} (already posted)`);
          continue;
        }
        const alreadyQueued = await hasQueueItemForMessages(targetPlatform, item.messageIds);
        if (alreadyQueued) {
          console.log(`[publish-job] Skipping cross-post → ${target} (already queued)`);
          continue;
        }

        const crossPost = await createContentQueueItem({
          videoPath: item.videoPath,
          coverImagePath: item.coverImagePath ?? undefined,
          messageIds: item.messageIds,
          template: item.template,
          mood: item.mood ?? undefined,
          platform: targetPlatform,
          isExploration: item.isExploration,
        });
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
    const msg = err instanceof Error ? err.message : String(err);

    // Rate-limited items stay scheduled — they'll retry next cycle/day
    if (msg.includes('Daily posting limit')) {
      console.log(`[publish-job] ${platform} daily limit reached — skipping ${item.id.slice(0, 8)}`);
      return false;
    }

    console.error(`[publish-job] Failed to publish ${item.id}:`, msg);
    await updateContentQueueStatus(item.id, 'failed', {
      errorMessage: msg,
    });
    return false;
  }
}
