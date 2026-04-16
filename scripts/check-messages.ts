import { getServiceClient } from '@wlu/shared';

async function main() {
  const client = getServiceClient();

  const { count: totalMessages } = await client
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('approved', true);

  const { data: posts } = await client.from('posts').select('message_ids');
  const usedIds = new Set<string>();
  for (const p of posts ?? []) {
    for (const id of (p.message_ids as string[]) ?? []) usedIds.add(id);
  }

  const { data: queue } = await client.from('content_queue').select('message_ids');
  for (const q of queue ?? []) {
    for (const id of (q.message_ids as string[]) ?? []) usedIds.add(id);
  }

  console.log('Total approved messages:', totalMessages);
  console.log('Used in posts/queue:', usedIds.size);
  console.log('Available for rendering:', (totalMessages ?? 0) - usedIds.size);

  // Check failed queue items
  const { data: failed } = await client
    .from('content_queue')
    .select('id, template, status, video_path')
    .eq('status', 'failed');
  if (failed && failed.length > 0) {
    console.log('\nFailed queue items:', failed.length);
    for (const f of failed) {
      console.log(`  ${f.id}: ${f.template} — ${f.video_path}`);
    }
  }

  // Check message pool size
  const { count: seeded } = await client
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('approved', true)
    .eq('seeded', true);
  console.log('\nSeeded messages:', seeded);
}

main().catch(console.error);
