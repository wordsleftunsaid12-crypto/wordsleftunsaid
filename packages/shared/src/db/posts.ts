import { getServiceClient } from './client.js';
import type { Post, Platform, CommentTracking, OutboundEngagement, ScheduleConfig } from '../types/social.js';
import type { EngagementMetric, FollowerSnapshot } from '../types/analytics.js';

const DEFAULT_PAGE_SIZE = 20;

// Row mappers: snake_case DB → camelCase TypeScript
type Row = Record<string, unknown>;

function mapPost(row: Row): Post {
  return {
    id: row.id as string,
    platform: row.platform as Platform,
    platformPostId: row.platform_post_id as string | null,
    platformMediaUrl: row.platform_media_url as string | null,
    contentQueueId: row.content_queue_id as string | null,
    messageIds: (row.message_ids as string[]) ?? [],
    caption: row.caption as string | null,
    hashtags: (row.hashtags as string[]) ?? [],
    template: row.template as string | null,
    mood: row.mood as string | null,
    postType: row.post_type as Post['postType'],
    isExploration: row.is_exploration as boolean,
    postedAt: row.posted_at as string,
    createdAt: row.created_at as string,
  };
}

function mapMetric(row: Row): EngagementMetric {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    likes: row.likes as number,
    comments: row.comments as number,
    shares: row.shares as number,
    views: row.views as number,
    saves: row.saves as number,
    reach: row.reach as number,
    impressions: row.impressions as number,
    measuredAt: row.measured_at as string,
  };
}

function mapComment(row: Row): CommentTracking {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    platformCommentId: row.platform_comment_id as string,
    username: row.username as string,
    commentText: row.comment_text as string,
    replied: row.replied as boolean,
    replyText: row.reply_text as string | null,
    repliedAt: row.replied_at as string | null,
    createdAt: row.created_at as string,
  };
}

function mapOutbound(row: Row): OutboundEngagement {
  return {
    id: row.id as string,
    platform: (row.platform as Platform) ?? 'instagram',
    actionType: row.action_type as OutboundEngagement['actionType'],
    targetUsername: row.target_username as string,
    targetPostUrl: row.target_post_url as string | null,
    targetHashtag: row.target_hashtag as string | null,
    commentText: row.comment_text as string | null,
    resultedInFollowback: row.resulted_in_followback as boolean,
    createdAt: row.created_at as string,
  };
}

function mapFollower(row: Row): FollowerSnapshot {
  return {
    id: row.id as string,
    platform: row.platform as string,
    followerCount: row.follower_count as number,
    followingCount: row.following_count as number,
    measuredAt: row.measured_at as string,
  };
}

function mapScheduleConfig(row: Row): ScheduleConfig {
  return {
    id: row.id as string,
    platform: row.platform as Platform,
    dayOfWeek: row.day_of_week as number | null,
    preferredHour: row.preferred_hour as number | null,
    timezone: row.timezone as string,
    postsPerDay: row.posts_per_day as number,
    active: row.active as boolean,
    createdAt: row.created_at as string,
  };
}

// --- Posts ---

export async function createPost(input: {
  platform: Platform;
  platformPostId?: string;
  platformMediaUrl?: string;
  contentQueueId?: string;
  messageIds: string[];
  caption?: string;
  hashtags?: string[];
  template?: string;
  mood?: string;
  postType?: string;
  isExploration?: boolean;
}): Promise<Post> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('posts')
    .insert({
      platform: input.platform,
      platform_post_id: input.platformPostId ?? null,
      platform_media_url: input.platformMediaUrl ?? null,
      content_queue_id: input.contentQueueId ?? null,
      message_ids: input.messageIds,
      caption: input.caption ?? null,
      hashtags: input.hashtags ?? [],
      template: input.template ?? null,
      mood: input.mood ?? null,
      post_type: input.postType ?? 'reel',
      is_exploration: input.isExploration ?? false,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create post: ${error.message}`);
  return mapPost(data as Row);
}

export async function getPostsByPlatform(
  platform: Platform,
  filters: { limit?: number; offset?: number } = {},
): Promise<Post[]> {
  const { limit = DEFAULT_PAGE_SIZE, offset = 0 } = filters;
  const client = getServiceClient();

  const { data, error } = await client
    .from('posts')
    .select('*')
    .eq('platform', platform)
    .order('posted_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to fetch posts: ${error.message}`);
  return (data as Row[]).map(mapPost);
}

export async function getRecentPosts(
  daysBack: number = 7,
  filters: { limit?: number } = {},
): Promise<Post[]> {
  const { limit = DEFAULT_PAGE_SIZE } = filters;
  const client = getServiceClient();
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();

  const { data, error } = await client
    .from('posts')
    .select('*')
    .gte('posted_at', since)
    .order('posted_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch recent posts: ${error.message}`);
  return (data as Row[]).map(mapPost);
}

export async function deletePost(id: string): Promise<void> {
  const client = getServiceClient();

  // Delete related engagement metrics and comments first
  await client.from('engagement_metrics').delete().eq('post_id', id);
  await client.from('comment_tracking').delete().eq('post_id', id);

  const { error } = await client.from('posts').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete post: ${error.message}`);
}

export async function getPostCountToday(platform: Platform): Promise<number> {
  const client = getServiceClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error } = await client
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('platform', platform)
    .gte('posted_at', today.toISOString());

  if (error) throw new Error(`Failed to count today's posts: ${error.message}`);
  return count ?? 0;
}

/**
 * Check if any of the given message IDs have already been posted on the target platform.
 * Returns true if at least one overlapping post exists.
 */
export async function hasPostForMessages(
  platform: Platform,
  messageIds: string[],
): Promise<boolean> {
  if (messageIds.length === 0) return false;
  const client = getServiceClient();

  const { data, error } = await client
    .from('posts')
    .select('id, message_ids')
    .eq('platform', platform)
    .not('message_ids', 'eq', '{}');

  if (error) throw new Error(`Failed to check existing posts: ${error.message}`);

  const targetSet = new Set(messageIds);
  for (const row of data ?? []) {
    for (const id of (row.message_ids as string[]) ?? []) {
      if (targetSet.has(id)) return true;
    }
  }
  return false;
}

/**
 * Check if a content_queue item already exists for the given message IDs on the target platform
 * in a non-terminal state (not 'posted' or 'failed').
 */
export async function hasQueueItemForMessages(
  platform: Platform,
  messageIds: string[],
): Promise<boolean> {
  if (messageIds.length === 0) return false;
  const client = getServiceClient();

  const { data, error } = await client
    .from('content_queue')
    .select('id, message_ids')
    .eq('platform', platform)
    .not('status', 'in', '("posted","failed")')
    .not('message_ids', 'eq', '{}');

  if (error) throw new Error(`Failed to check content queue: ${error.message}`);

  const targetSet = new Set(messageIds);
  for (const row of data ?? []) {
    for (const id of (row.message_ids as string[]) ?? []) {
      if (targetSet.has(id)) return true;
    }
  }
  return false;
}

// --- Engagement Metrics ---

export async function saveEngagementMetrics(input: {
  postId: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  saves: number;
  reach: number;
  impressions: number;
}): Promise<EngagementMetric> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('engagement_metrics')
    .insert({
      post_id: input.postId,
      likes: input.likes,
      comments: input.comments,
      shares: input.shares,
      views: input.views,
      saves: input.saves,
      reach: input.reach,
      impressions: input.impressions,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save engagement metrics: ${error.message}`);
  return mapMetric(data as Row);
}

export async function getLatestMetrics(postId: string): Promise<EngagementMetric | null> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('engagement_metrics')
    .select('*')
    .eq('post_id', postId)
    .order('measured_at', { ascending: false })
    .limit(1);

  if (error) throw new Error(`Failed to fetch latest metrics: ${error.message}`);
  return data.length > 0 ? mapMetric(data[0] as Row) : null;
}

export async function getAllMetricsForPost(postId: string): Promise<EngagementMetric[]> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('engagement_metrics')
    .select('*')
    .eq('post_id', postId)
    .order('measured_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch metrics: ${error.message}`);
  return (data as Row[]).map(mapMetric);
}

// --- Comment Tracking ---

export async function getUnrepliedComments(
  postId?: string,
  filters: { limit?: number } = {},
): Promise<CommentTracking[]> {
  const { limit = DEFAULT_PAGE_SIZE } = filters;
  const client = getServiceClient();

  let query = client
    .from('comment_tracking')
    .select('*')
    .eq('replied', false)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (postId) query = query.eq('post_id', postId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch unreplied comments: ${error.message}`);
  return (data as Row[]).map(mapComment);
}

export async function recordComment(input: {
  postId: string;
  platformCommentId: string;
  username: string;
  commentText: string;
}): Promise<CommentTracking> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('comment_tracking')
    .insert({
      post_id: input.postId,
      platform_comment_id: input.platformCommentId,
      username: input.username,
      comment_text: input.commentText,
    })
    .select()
    .single();

  if (error) {
    // Duplicate comment — return existing
    if (error.code === '23505') {
      const { data: existing } = await client
        .from('comment_tracking')
        .select('*')
        .eq('platform_comment_id', input.platformCommentId)
        .single();
      if (existing) return mapComment(existing as Row);
    }
    throw new Error(`Failed to record comment: ${error.message}`);
  }
  return mapComment(data as Row);
}

export async function markCommentReplied(
  id: string,
  replyText: string,
): Promise<CommentTracking> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('comment_tracking')
    .update({
      replied: true,
      reply_text: replyText,
      replied_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to mark comment as replied: ${error.message}`);
  return mapComment(data as Row);
}

// --- Outbound Engagement ---

export async function recordOutboundEngagement(input: {
  actionType: 'like' | 'follow' | 'comment';
  platform?: Platform;
  targetUsername: string;
  targetPostUrl?: string;
  targetHashtag?: string;
  commentText?: string;
}): Promise<OutboundEngagement> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('outbound_engagement')
    .insert({
      action_type: input.actionType,
      platform: input.platform ?? 'instagram',
      target_username: input.targetUsername,
      target_post_url: input.targetPostUrl ?? null,
      target_hashtag: input.targetHashtag ?? null,
      comment_text: input.commentText ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to record outbound engagement: ${error.message}`);
  return mapOutbound(data as Row);
}

export async function getOutboundEngagementCountToday(
  actionType?: 'like' | 'follow' | 'comment',
  platform?: Platform,
): Promise<number> {
  const client = getServiceClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let query = client
    .from('outbound_engagement')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString());

  if (actionType) query = query.eq('action_type', actionType);
  if (platform) query = query.eq('platform', platform);

  const { count, error } = await query;
  if (error) throw new Error(`Failed to count outbound engagement: ${error.message}`);
  return count ?? 0;
}

/**
 * Get usernames that were followed recently (within the cooldown period).
 * Used to avoid unfollowing people we just followed — that looks spammy.
 */
export async function getRecentlyFollowedUsernames(
  platform: Platform = 'instagram',
  cooldownDays = 7,
): Promise<string[]> {
  const client = getServiceClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - cooldownDays);

  const { data, error } = await client
    .from('outbound_engagement')
    .select('target_username')
    .eq('action_type', 'follow')
    .eq('platform', platform)
    .gte('created_at', cutoff.toISOString());

  if (error) throw new Error(`Failed to get recently followed: ${error.message}`);
  return (data ?? []).map((row: { target_username: string }) => row.target_username);
}

// --- Strategy Briefs ---

export async function saveStrategyBrief(input: {
  brief: Record<string, unknown>;
  basedOnPosts: number;
}): Promise<{ id: string; createdAt: string }> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('strategy_briefs')
    .insert({
      brief: input.brief,
      based_on_posts: input.basedOnPosts,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save strategy brief: ${error.message}`);
  return { id: (data as Row).id as string, createdAt: (data as Row).created_at as string };
}

export async function getLatestStrategyBrief(): Promise<{
  id: string;
  brief: Record<string, unknown>;
  basedOnPosts: number;
  createdAt: string;
} | null> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('strategy_briefs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw new Error(`Failed to fetch strategy brief: ${error.message}`);
  if (data.length === 0) return null;
  const row = data[0] as Row;
  return { id: row.id as string, brief: row.brief as Record<string, unknown>, basedOnPosts: row.based_on_posts as number, createdAt: row.created_at as string };
}

// --- Follower Snapshots ---

export async function saveFollowerSnapshot(input: {
  platform: Platform;
  followerCount: number;
  followingCount: number;
}): Promise<FollowerSnapshot> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('follower_snapshots')
    .insert({
      platform: input.platform,
      follower_count: input.followerCount,
      following_count: input.followingCount,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save follower snapshot: ${error.message}`);
  return mapFollower(data as Row);
}

export async function getFollowerHistory(
  platform: Platform,
  daysBack: number = 30,
): Promise<FollowerSnapshot[]> {
  const client = getServiceClient();
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();

  const { data, error } = await client
    .from('follower_snapshots')
    .select('*')
    .eq('platform', platform)
    .gte('measured_at', since)
    .order('measured_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch follower history: ${error.message}`);
  return (data as Row[]).map(mapFollower);
}

// --- Schedule Config ---

export async function getScheduleConfig(
  platform: Platform,
): Promise<ScheduleConfig[]> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('schedule_config')
    .select('*')
    .eq('platform', platform)
    .eq('active', true)
    .order('day_of_week', { ascending: true });

  if (error) throw new Error(`Failed to fetch schedule config: ${error.message}`);
  return (data as Row[]).map(mapScheduleConfig);
}
