import { getApprovedMessages, getUsedMessageIds } from '@wlu/shared';

async function main() {
  const [all, usedIds] = await Promise.all([
    getApprovedMessages({ limit: 200 }),
    getUsedMessageIds(),
  ]);

  const usedSet = new Set(usedIds);
  const unused = all.filter((m) => !usedSet.has(m.id));

  console.log(`Total approved: ${all.length}, Used: ${usedSet.size}, Unused: ${unused.length}\n`);

  // Distribution of lengths
  const buckets = [0, 50, 100, 120, 150, 160, 200, 300, 500, 1000];
  for (let i = 0; i < buckets.length - 1; i++) {
    const count = unused.filter((m) => m.content.length > buckets[i] && m.content.length <= buckets[i + 1]).length;
    if (count > 0) console.log(`  ${buckets[i]}-${buckets[i + 1]} chars: ${count} messages`);
  }

  console.log('\nShortest 5 unused:');
  const sorted = [...unused].sort((a, b) => a.content.length - b.content.length);
  for (const m of sorted.slice(0, 5)) {
    console.log(`  [${m.content.length}] ${m.content.slice(0, 80)}...`);
  }

  console.log('\nLongest 5 unused:');
  for (const m of sorted.slice(-5)) {
    console.log(`  [${m.content.length}] ${m.content.slice(0, 80)}...`);
  }
}

main().catch(console.error);
