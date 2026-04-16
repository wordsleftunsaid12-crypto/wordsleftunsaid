import {
  getNextScheduledItem,
  updateContentQueueStatus,
  createContentQueueItem,
  hasPostForMessages,
  hasQueueItemForMessages,
  hasAnyQueueItemForVideo,
  getMessageById,
  getLastPostTime,
  MAX_CONTENT_LENGTH,
} from '@wlu/shared';
import type { Message, Platform } from '@wlu/shared';
import { browserPublishReel } from '../platforms/instagram/browser-publish.js';
import { buildUtmUrl } from '../utils/utm.js';
import { getNextSlotForPlatform } from './queue.js';

/** Minimum hours between posts on the same platform. */
const MIN_POST_INTERVAL_HOURS = 2;

/** Platforms to auto-cross-post to after a successful publish. Threads disabled. */
const CROSS_POST_TARGETS: Record<string, string[]> = {
  instagram: ['tiktok', 'youtube', 'reddit', 'pinterest', 'twitter'],
  tiktok: [],
  youtube: [],
  reddit: [],
  pinterest: [],
  twitter: [],
};

/** Platforms that include clickable links in their posts (get UTM tracking). */
const LINK_PLATFORMS = new Set(['reddit', 'twitter', 'pinterest']);

/**
 * Fallback TikTok hashtags — only used when the content queue item
 * somehow arrives with no hashtags. Picks a rotated subset to avoid
 * identical fallback strings across posts.
 */
const TIKTOK_FALLBACK_ANCHOR = '#wordsleftunsent';
const TIKTOK_FALLBACK_POOL = [
  '#fyp', '#foryou', '#foryoupage', '#relatable', '#emotional', '#unsentletters',
  '#deepquotes', '#mentalhealthawareness', '#heartbreak', '#healing',
  '#breakuptok', '#sadtok', '#softgirlera',
];

function buildTikTokFallbackHashtags(): string[] {
  const pool = [...TIKTOK_FALLBACK_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const n = 5 + Math.floor(Math.random() * 3); // 5-7 tags
  return [TIKTOK_FALLBACK_ANCHOR, ...pool.slice(0, n - 1)];
}

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

  // Enforce minimum interval between posts on the same platform
  const lastPostTime = await getLastPostTime(platform);
  if (lastPostTime) {
    const hoursSinceLastPost = (Date.now() - lastPostTime.getTime()) / 3600000;
    if (hoursSinceLastPost < MIN_POST_INTERVAL_HOURS) {
      const waitMins = Math.ceil((MIN_POST_INTERVAL_HOURS - hoursSinceLastPost) * 60);
      console.log(
        `[publish-job] Skipping ${platform} — last post ${Math.round(hoursSinceLastPost * 60)}m ago, need ${MIN_POST_INTERVAL_HOURS}h gap (${waitMins}m remaining)`,
      );
      return false;
    }
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

    // Guard: reject items with message content too long for their specific template
    const templateMaxLen = MAX_CONTENT_LENGTH[item.template ?? ''] ?? 160;
    if (sourceMessage && sourceMessage.content.length > templateMaxLen) {
      console.warn(
        `[publish-job] Message too long (${sourceMessage.content.length} > ${templateMaxLen} chars for ${item.template}), marking as failed: ${item.id}`,
      );
      await updateContentQueueStatus(item.id, 'failed', {
        errorMessage: `Message content too long (${sourceMessage.content.length} chars, max ${templateMaxLen} for ${item.template})`,
      });
      return false;
    }

    // For TikTok, ensure posts always have discovery hashtags
    let hashtagString = (item.hashtags ?? []).join(' ');
    if (platform === 'tiktok' && !hashtagString) {
      hashtagString = buildTikTokFallbackHashtags().join(' ');
    }

    let rawCaption = `${item.caption ?? ''}\n\n${hashtagString}`.trim();

    // YouTube: append subscribe CTA to description
    if (platform === 'youtube') {
      rawCaption += '\n\nSubscribe for more unsent letters \u2764\uFE0F';
    }

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
      // Threads publishing disabled — requires selfie verification.
      // Any remaining threads items in the queue should be skipped.
      console.log(`[publish-job] Threads is disabled — marking ${item.id.slice(0, 8)} as failed`);
      await updateContentQueueStatus(item.id, 'failed', {
        errorMessage: 'Threads disabled: requires selfie human verification',
      });
      return false;
    } else {
      result = await browserPublishReel(publishOptions);
    }

    console.log(`[publish-job] Published! Post ID: ${result.postId}`);

    // Cross-post: queue the same video for other platforms (with dedup).
    // Stretch the targets across several hours — we use a rolling "earliest
    // allowed time" so each subsequent cross-post is scheduled at least
    // 90-180 minutes after the previous one. This avoids the pattern where
    // Instagram publishes → all 4 cross-posts land in the same preferred-hour
    // cluster, which reads as bot activity to the platforms.
    const targets = CROSS_POST_TARGETS[platform] ?? [];
    let rollingFloor = new Date(Date.now() + 90 * 60000); // start at least 90m out
    for (const target of targets) {
      const targetPlatform = target as import('@wlu/shared').Platform;
      try {
        // Dedup: check by messageIds first, fall back to videoPath for items with empty messageIds
        const hasMessageIds = item.messageIds && item.messageIds.length > 0;
        if (hasMessageIds) {
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
        } else if (item.videoPath) {
          // Fallback: dedup by video file path when messageIds are empty
          const alreadyExists = await hasAnyQueueItemForVideo(targetPlatform, item.videoPath);
          if (alreadyExists) {
            console.log(`[publish-job] Skipping cross-post → ${target} (video already queued/posted)`);
            continue;
          }
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
        const nextSlot = await getNextSlotForPlatform(targetPlatform, rollingFloor);
        await updateContentQueueStatus(crossPost.id, 'scheduled', {
          caption: item.caption ?? undefined,
          hashtags: item.hashtags ?? undefined,
          scheduledFor: nextSlot.toISOString(),
        });
        // Advance the floor by 90-180 random minutes from the slot we just
        // scheduled — the next cross-post target lands at least that far after.
        const gapMs = (90 + Math.random() * 90) * 60000;
        rollingFloor = new Date(nextSlot.getTime() + gapMs);
        console.log(`[publish-job] Cross-posted → ${target} scheduled for ${nextSlot.toISOString()} (${crossPost.id.slice(0, 8)})`);
      } catch (err) {
        console.warn(`[publish-job] Cross-post to ${target} failed:`, err instanceof Error ? err.message : err);
      }
    }

    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Rate-limited items get rescheduled to tomorrow to stop retry loops
    if (msg.includes('Daily posting limit')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0); // 10 AM tomorrow
      await updateContentQueueStatus(item.id, 'scheduled', {
        scheduledFor: tomorrow.toISOString(),
      });
      console.log(`[publish-job] ${platform} daily limit reached — rescheduled ${item.id.slice(0, 8)} to ${tomorrow.toISOString()}`);
      return false;
    }

    console.error(`[publish-job] Failed to publish ${item.id}:`, msg);
    await updateContentQueueStatus(item.id, 'failed', {
      errorMessage: msg,
    });
    return false;
  }
}
