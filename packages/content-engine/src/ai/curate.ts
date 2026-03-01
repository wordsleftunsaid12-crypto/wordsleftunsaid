import { getApprovedMessages } from '@wlu/shared';
import type { Message } from '@wlu/shared';
import { curateMessages } from './generate.js';

export async function fetchAndCurate(): Promise<{
  selected: { message: Message; mood: string; reason: string }[];
  total: number;
}> {
  // Fetch a batch of approved messages
  const messages = await getApprovedMessages({ limit: 50 });

  if (messages.length === 0) {
    return { selected: [], total: 0 };
  }

  // Use Claude to curate the best ones
  const curated = await curateMessages(messages);

  // Match curated IDs back to full messages
  const selected = curated
    .map((c) => {
      const message = messages.find((m) => m.id === c.id);
      if (!message) return null;
      return { message, mood: c.mood, reason: c.reason };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return { selected, total: messages.length };
}
