import { InstagramClient } from './client.js';
import {
  getPostsByPlatform,
  saveEngagementMetrics,
  saveFollowerSnapshot,
} from '@wlu/shared';

/**
 * Collect engagement metrics for recent Instagram posts and store in the database.
 * Returns the number of posts with metrics collected.
 */
export async function collectPostMetrics(
  options: { maxPosts?: number } = {},
): Promise<number> {
  const { maxPosts = 20 } = options;
  const client = new InstagramClient();

  const posts = await getPostsByPlatform('instagram', { limit: maxPosts });
  let collected = 0;

  for (const post of posts) {
    if (!post.platformPostId) continue;

    try {
      const insights = await client.getMediaInsights(post.platformPostId);

      const metricsMap: Record<string, number> = {};
      for (const metric of insights.data) {
        const value = metric.values[0]?.value ?? 0;
        metricsMap[metric.name] = value;
      }

      await saveEngagementMetrics({
        postId: post.id,
        likes: metricsMap['likes'] ?? 0,
        comments: metricsMap['comments'] ?? 0,
        shares: metricsMap['shares'] ?? 0,
        views: metricsMap['plays'] ?? 0,
        saves: metricsMap['saved'] ?? 0,
        reach: metricsMap['reach'] ?? 0,
        impressions: metricsMap['impressions'] ?? 0,
      });

      collected++;
    } catch (err) {
      console.warn(
        `[insights] Failed to collect metrics for post ${post.platformPostId}:`,
        err,
      );
    }
  }

  console.log(`[insights] Collected metrics for ${collected} post(s)`);
  return collected;
}

/**
 * Take a snapshot of the account's follower/following counts.
 */
export async function collectFollowerSnapshot(): Promise<{
  followerCount: number;
  followingCount: number;
}> {
  const client = new InstagramClient();
  const profile = await client.getAccountProfile();

  await saveFollowerSnapshot({
    platform: 'instagram',
    followerCount: profile.followers_count,
    followingCount: profile.follows_count,
  });

  console.log(
    `[insights] Follower snapshot: ${profile.followers_count} followers, ${profile.follows_count} following`,
  );

  return {
    followerCount: profile.followers_count,
    followingCount: profile.follows_count,
  };
}
