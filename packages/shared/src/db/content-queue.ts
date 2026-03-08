import { getServiceClient } from './client.js';
import type {
  ContentQueueItem,
  CreateContentQueueInput,
  PostStatus,
} from '../types/social.js';

const DEFAULT_PAGE_SIZE = 20;

// Map snake_case DB rows to camelCase TypeScript interfaces
function mapRow(row: Record<string, unknown>): ContentQueueItem {
  return {
    id: row.id as string,
    videoPath: row.video_path as string,
    coverImagePath: row.cover_image_path as string | null,
    messageIds: (row.message_ids as string[]) ?? [],
    template: row.template as string,
    mood: row.mood as string | null,
    status: row.status as PostStatus,
    caption: row.caption as string | null,
    hashtags: (row.hashtags as string[]) ?? [],
    scheduledFor: row.scheduled_for as string | null,
    platform: row.platform as ContentQueueItem['platform'],
    isExploration: row.is_exploration as boolean,
    errorMessage: row.error_message as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getContentQueue(
  filters: { status?: PostStatus; platform?: string; limit?: number; offset?: number } = {},
): Promise<ContentQueueItem[]> {
  const { status, platform, limit = DEFAULT_PAGE_SIZE, offset = 0 } = filters;
  const client = getServiceClient();

  let query = client
    .from('content_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (platform) query = query.eq('platform', platform);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch content queue: ${error.message}`);
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function createContentQueueItem(
  input: CreateContentQueueInput,
): Promise<ContentQueueItem> {
  const client = getServiceClient();

  // Check for existing queue item with the same message IDs AND platform to prevent duplicates
  if (input.messageIds.length > 0) {
    let dupeQuery = client
      .from('content_queue')
      .select('id, message_ids')
      .not('message_ids', 'eq', '{}');

    if (input.platform) {
      dupeQuery = dupeQuery.eq('platform', input.platform);
    }

    const { data: existing } = await dupeQuery;

    const inputKey = JSON.stringify([...input.messageIds].sort());
    const dupe = (existing ?? []).find((row) => {
      const rowKey = JSON.stringify([...(row.message_ids as string[])].sort());
      return rowKey === inputKey;
    });

    if (dupe) {
      // Update existing item instead of creating a duplicate
      return updateContentQueueStatus(dupe.id as string, 'pending', {
        videoPath: input.videoPath,
        coverImagePath: input.coverImagePath,
      });
    }
  }

  const { data, error } = await client
    .from('content_queue')
    .insert({
      video_path: input.videoPath,
      cover_image_path: input.coverImagePath ?? null,
      message_ids: input.messageIds,
      template: input.template,
      mood: input.mood ?? null,
      platform: input.platform,
      is_exploration: input.isExploration ?? false,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create content queue item: ${error.message}`);
  return mapRow(data as Record<string, unknown>);
}

export async function updateContentQueueStatus(
  id: string,
  status: PostStatus,
  extra: { caption?: string; hashtags?: string[]; scheduledFor?: string; errorMessage?: string; videoPath?: string; coverImagePath?: string } = {},
): Promise<ContentQueueItem> {
  const client = getServiceClient();

  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (extra.caption !== undefined) update.caption = extra.caption;
  if (extra.hashtags !== undefined) update.hashtags = extra.hashtags;
  if (extra.scheduledFor !== undefined) update.scheduled_for = extra.scheduledFor;
  if (extra.errorMessage !== undefined) update.error_message = extra.errorMessage;
  if (extra.videoPath !== undefined) update.video_path = extra.videoPath;
  if (extra.coverImagePath !== undefined) update.cover_image_path = extra.coverImagePath;

  const { data, error } = await client
    .from('content_queue')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update content queue item: ${error.message}`);
  return mapRow(data as Record<string, unknown>);
}

export async function getNextScheduledItem(
  platform?: string,
): Promise<ContentQueueItem | null> {
  const client = getServiceClient();

  let query = client
    .from('content_queue')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(1);

  if (platform) query = query.eq('platform', platform);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch next scheduled item: ${error.message}`);
  return data.length > 0 ? mapRow(data[0] as Record<string, unknown>) : null;
}

/**
 * Get all message IDs that have been used in any content queue item.
 */
export async function getUsedMessageIds(): Promise<string[]> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('content_queue')
    .select('message_ids')
    .not('message_ids', 'eq', '{}');

  if (error) throw new Error(`Failed to fetch used message IDs: ${error.message}`);

  const ids = new Set<string>();
  for (const row of data ?? []) {
    for (const id of (row.message_ids as string[]) ?? []) {
      ids.add(id);
    }
  }
  return [...ids];
}

export async function getContentQueueItemByVideoPath(
  videoPath: string,
): Promise<ContentQueueItem | null> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('content_queue')
    .select('*')
    .eq('video_path', videoPath)
    .limit(1);

  if (error) throw new Error(`Failed to check content queue: ${error.message}`);
  return data.length > 0 ? mapRow(data[0] as Record<string, unknown>) : null;
}
