import { getContentQueue, updateContentQueueStatus } from '@wlu/shared';

async function main() {
  // Get all failed items across all platforms
  const failed = await getContentQueue({ status: 'failed', limit: 200 });
  console.log(`Found ${failed.length} failed queue items`);

  if (failed.length === 0) return;

  // Group by video path to avoid re-queuing duplicates
  const byPath = new Map<string, typeof failed>();
  for (const item of failed) {
    const existing = byPath.get(item.videoPath) ?? [];
    existing.push(item);
    byPath.set(item.videoPath, existing);
  }

  console.log(`Unique videos: ${byPath.size}`);

  let requeued = 0;
  let cleaned = 0;

  for (const [path, items] of byPath) {
    // Keep the newest, delete duplicates
    const [newest, ...duplicates] = items;

    // Re-queue the newest as 'captioned' so it gets scheduled
    await updateContentQueueStatus(newest.id, 'captioned');
    requeued++;
    console.log(`  Re-queued: ${newest.template} [${newest.platform}] — ${path.split('/').pop()}`);

    // Mark duplicates as posted to prevent re-processing
    for (const dup of duplicates) {
      await updateContentQueueStatus(dup.id, 'posted');
      cleaned++;
    }
  }

  console.log(`\nRe-queued: ${requeued}, Cleaned duplicates: ${cleaned}`);
}

main().catch(console.error);
