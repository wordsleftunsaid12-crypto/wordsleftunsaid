import { getServiceClient } from '@wlu/shared';
import { InstagramClient } from './client.js';
import { createPost, getPostCountToday } from '@wlu/shared';
import { updateContentQueueStatus } from '@wlu/shared';
import type { IGContainerStatusResponse } from './types.js';

const MAX_POSTS_PER_DAY = 3;
const CONTAINER_POLL_INTERVAL_MS = 10000;
const CONTAINER_POLL_MAX_ATTEMPTS = 60; // 10 minutes max
const STORAGE_BUCKET = 'social-media-assets';

interface PublishResult {
  postId: string;
  platformPostId: string;
  publicUrl: string;
}

/**
 * Full publish flow: upload video → create container → poll → publish → record.
 */
export async function publishReel(options: {
  videoPath: string;
  caption: string;
  contentQueueId?: string;
  messageIds?: string[];
  template?: string;
  mood?: string;
  isExploration?: boolean;
}): Promise<PublishResult> {
  // Enforce daily posting limit
  const todayCount = await getPostCountToday('instagram');
  if (todayCount >= MAX_POSTS_PER_DAY) {
    throw new Error(
      `Daily posting limit reached (${MAX_POSTS_PER_DAY}). Posted ${todayCount} today.`,
    );
  }

  const client = new InstagramClient();

  // 1. Upload video to Supabase Storage for a public URL
  const publicUrl = await uploadToStorage(options.videoPath);

  try {
    // 2. Create Reel container
    console.log('[publish] Creating Reel container...');
    const containerId = await client.createReelContainer(publicUrl, options.caption);
    console.log(`[publish] Container created: ${containerId}`);

    // 3. Poll until container is ready
    await waitForContainer(client, containerId);

    // 4. Publish the container
    console.log('[publish] Publishing...');
    const platformPostId = await client.publishContainer(containerId);
    console.log(`[publish] Published! Post ID: ${platformPostId}`);

    // 5. Record in database
    const post = await createPost({
      platform: 'instagram',
      platformPostId,
      platformMediaUrl: publicUrl,
      contentQueueId: options.contentQueueId,
      messageIds: options.messageIds ?? [],
      caption: options.caption,
      template: options.template,
      mood: options.mood,
      postType: 'reel',
      isExploration: options.isExploration,
    });

    // 6. Update content queue status if applicable
    if (options.contentQueueId) {
      await updateContentQueueStatus(options.contentQueueId, 'posted');
    }

    return {
      postId: post.id,
      platformPostId,
      publicUrl,
    };
  } finally {
    // Clean up storage after publish attempt
    await deleteFromStorage(options.videoPath).catch((err) =>
      console.warn('[publish] Storage cleanup failed:', err),
    );
  }
}

/**
 * Upload a local video file to Supabase Storage and return a public URL.
 */
async function uploadToStorage(videoPath: string): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  const { basename } = await import('node:path');

  const supabase = getServiceClient();
  const fileName = `reels/${Date.now()}-${basename(videoPath)}`;
  const fileBuffer = await readFile(videoPath);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, fileBuffer, {
      contentType: 'video/mp4',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload video to storage: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Delete a file from Supabase Storage after publishing.
 */
async function deleteFromStorage(videoPath: string): Promise<void> {
  const { basename } = await import('node:path');
  const supabase = getServiceClient();

  // We stored with a timestamp prefix, so list and find the matching file
  const { data: files } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list('reels', { search: basename(videoPath) });

  if (files && files.length > 0) {
    const paths = files.map((f) => `reels/${f.name}`);
    await supabase.storage.from(STORAGE_BUCKET).remove(paths);
    console.log(`[publish] Cleaned up ${paths.length} storage file(s)`);
  }
}

/**
 * Poll container status until it's ready for publishing.
 */
async function waitForContainer(
  client: InstagramClient,
  containerId: string,
): Promise<void> {
  for (let attempt = 0; attempt < CONTAINER_POLL_MAX_ATTEMPTS; attempt++) {
    const status: IGContainerStatusResponse =
      await client.checkContainerStatus(containerId);

    switch (status.status_code) {
      case 'FINISHED':
        console.log('[publish] Container ready');
        return;
      case 'IN_PROGRESS':
        console.log(
          `[publish] Container processing... (attempt ${attempt + 1}/${CONTAINER_POLL_MAX_ATTEMPTS})`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, CONTAINER_POLL_INTERVAL_MS),
        );
        break;
      case 'ERROR':
        throw new Error(
          `Container processing failed: ${status.status ?? 'unknown error'}`,
        );
      case 'EXPIRED':
        throw new Error('Container expired before publishing');
      case 'PUBLISHED':
        throw new Error('Container was already published');
      default:
        throw new Error(`Unexpected container status: ${status.status_code}`);
    }
  }

  throw new Error(
    `Container not ready after ${CONTAINER_POLL_MAX_ATTEMPTS} attempts (${Math.round((CONTAINER_POLL_MAX_ATTEMPTS * CONTAINER_POLL_INTERVAL_MS) / 60000)} minutes)`,
  );
}
