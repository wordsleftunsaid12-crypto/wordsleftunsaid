import { getApprovedMessages } from '@wlu/shared';
import { MESSAGE_POOL } from '../packages/social/src/content/message-seeder.js';

async function main() {
  const existing = await getApprovedMessages({ limit: 200 });
  const existingContents = new Set(existing.map(m => m.content.toLowerCase().trim()));
  const existingPrefixes = new Set(existing.map(m => m.content.toLowerCase().trim().slice(0, 50)));

  const available = MESSAGE_POOL.filter(t => {
    const normalized = t.content.toLowerCase().trim();
    if (existingContents.has(normalized)) return false;
    if (existingPrefixes.has(normalized.slice(0, 50))) return false;
    return true;
  });

  const shortAvailable = available.filter(m => m.content.length <= 160);
  console.log(`Pool: ${MESSAGE_POOL.length}, Already seeded: ${MESSAGE_POOL.length - available.length}, Available: ${available.length}`);
  console.log(`Available short (<=160): ${shortAvailable.length}`);
  console.log(`Available medium (>160): ${available.filter(m => m.content.length > 160).length}`);

  if (shortAvailable.length > 0) {
    console.log('\nShort available messages:');
    for (const m of shortAvailable.slice(0, 5)) {
      console.log(`  [${m.content.length}] ${m.content.slice(0, 80)}...`);
    }
  }
}

main().catch(console.error);
