import { getServiceClient } from '@wlu/shared';
import { stat } from 'node:fs/promises';

async function main() {
  const client = getServiceClient();

  // Get all queue statuses
  const { data: allItems, count } = await client
    .from('content_queue')
    .select('status', { count: 'exact' });

  const statusCounts: Record<string, number> = {};
  for (const item of allItems ?? []) {
    statusCounts[item.status as string] = (statusCounts[item.status as string] ?? 0) + 1;
  }
  console.log('Queue status counts:', statusCounts);
  console.log('Total queue items:', count);

  // Get failed items
  const { data: failed } = await client
    .from('content_queue')
    .select('id, video_path, template, status, platform, message_ids')
    .eq('status', 'failed');

  console.log('\nFailed items:', failed?.length ?? 0);

  if (failed && failed.length > 0) {
    for (const f of failed) {
      const path = f.video_path as string;
      let exists = false;
      try { await stat(path); exists = true; } catch {}
      console.log(`  ${f.template} [${f.platform}] — ${exists ? 'EXISTS' : 'MISSING'} — ${path.split('/').pop()}`);
    }
  }

  // Also check: how many unique videos have been posted?
  const { data: posted } = await client
    .from('content_queue')
    .select('video_path')
    .eq('status', 'posted');

  const uniquePosted = new Set((posted ?? []).map(p => p.video_path));
  console.log('\nUnique posted videos:', uniquePosted.size);
}

main().catch(console.error);
