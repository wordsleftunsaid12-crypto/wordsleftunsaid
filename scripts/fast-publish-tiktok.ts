import { getServiceClient } from '@wlu/shared';

async function main() {
  const client = getServiceClient();

  // Get the newest pending tiktok item
  const { data: items, error: fetchErr } = await client
    .from('content_queue')
    .select('*')
    .eq('platform', 'tiktok')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);

  if (fetchErr) throw fetchErr;
  if (!items || items.length === 0) {
    console.log('No pending tiktok items');
    return;
  }

  const item = items[0];
  console.log('Fast-publishing:', item.template, '|', item.video_path.split('/').pop());

  // TikTok caption — simple, grounded format (no URL, TikTok doesn't allow links)
  const caption = 'for the things we never said\n\n#unsent #thoughts #feelings #healing #relatable';

  const { error: updateErr } = await client
    .from('content_queue')
    .update({
      caption,
      hashtags: ['unsent', 'thoughts', 'feelings', 'healing', 'relatable'],
      status: 'scheduled',
      scheduled_for: new Date().toISOString(),
    })
    .eq('id', item.id);

  if (updateErr) throw updateErr;
  console.log('Scheduled for NOW. Publish job will pick it up within 5 min.');
}

main().catch(console.error);
