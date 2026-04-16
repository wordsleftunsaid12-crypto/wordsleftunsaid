import { getServiceClient, getContentQueue } from '@wlu/shared';

async function main() {
  const items = await getContentQueue({ status: 'scheduled', limit: 100 });
  const targets = items.filter((i) => ['instagram', 'youtube'].includes(i.platform));

  // Pick the earliest scheduled item per platform (first one in each group)
  const byPlat: Record<string, typeof items[0]> = {};
  for (const t of targets) {
    if (byPlat[t.platform]) continue;
    byPlat[t.platform] = t;
  }

  const client = getServiceClient();
  const nowIso = new Date().toISOString();
  for (const [plat, item] of Object.entries(byPlat)) {
    const { error } = await client
      .from('content_queue')
      .update({ scheduled_for: nowIso })
      .eq('id', item.id);
    if (error) {
      console.error('Failed to update', plat, error);
    } else {
      console.log('Pulled forward:', plat, '|', item.template, '|', item.videoPath.split('/').pop());
    }
  }
}

main().catch(console.error);
