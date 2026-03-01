import 'dotenv/config';
import { getContentQueue } from '@wlu/shared';

async function main() {
  const all = await getContentQueue({ limit: 20 });
  console.log(`Found ${all.length} items in content queue:\n`);
  for (const item of all) {
    console.log(`[${item.status.toUpperCase()}] ${item.id.slice(0, 8)} — ${item.template}`);
    console.log(`  Caption: ${(item.caption ?? '(none)').slice(0, 120)}`);
    console.log(`  Message IDs: ${JSON.stringify(item.messageIds)}`);
    if (item.errorMessage) console.log(`  Error: ${item.errorMessage.slice(0, 100)}`);
    console.log('');
  }
}

main().catch(console.error);
