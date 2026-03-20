/**
 * Standalone Threads text posting — posts text-only threads from unused messages,
 * independent of the Instagram cross-post flow.
 * Runs on its own scheduler job to increase Threads posting frequency.
 */
import {
  getApprovedMessages,
  createPost,
  getPostCountToday,
  hasPostForMessages,
} from '@wlu/shared';
import type { Platform } from '@wlu/shared';
import { launchThreads } from '../platforms/threads/browser.js';
import { composeThread } from '../platforms/threads/browser-publish.js';
import { buildUtmUrl } from '../utils/utm.js';

const THREADS_DAILY_LIMIT = 6;

/**
 * Post a standalone text thread from an unused approved message.
 * Returns true if a thread was posted, false if nothing to post.
 */
export async function postStandaloneThread(options: {
  dryRun?: boolean;
} = {}): Promise<boolean> {
  const { dryRun = false } = options;

  // Check daily limit
  const todayCount = await getPostCountToday('threads' as Platform);
  if (todayCount >= THREADS_DAILY_LIMIT) {
    console.log(`[threads-standalone] Daily limit reached (${todayCount}/${THREADS_DAILY_LIMIT})`);
    return false;
  }

  // Find approved messages not yet posted to Threads
  const allMessages = await getApprovedMessages({ limit: 100 });
  const candidates: typeof allMessages = [];

  for (const msg of allMessages) {
    const alreadyPosted = await hasPostForMessages('threads' as Platform, [msg.id]);
    if (!alreadyPosted) {
      candidates.push(msg);
    }
  }

  if (candidates.length === 0) {
    console.log('[threads-standalone] No unused messages available for Threads');
    return false;
  }

  // Pick a random candidate
  const msg = candidates[Math.floor(Math.random() * candidates.length)];

  // Build the thread text
  const THREADS_CHAR_LIMIT = 500;
  const header = msg.to ? `To ${msg.to},\n\n` : '';
  const baseUrl = `https://wordsleftunsent.com/messages/${msg.id}`;
  const utmUrl = buildUtmUrl(baseUrl, 'threads', msg.id);
  const attribution = msg.from ? `\n\n\u2014 ${msg.from}` : '';
  const suffix = `${attribution}\n\n${utmUrl}`;
  const overhead = header.length + suffix.length + 2; // +2 for quote marks
  const maxQuoteLen = Math.max(80, THREADS_CHAR_LIMIT - overhead);

  const truncatedQuote = msg.content.length > maxQuoteLen
    ? msg.content.slice(0, maxQuoteLen - 3) + '...'
    : msg.content;
  const threadText = `${header}"${truncatedQuote}"${suffix}`;

  if (dryRun) {
    console.log('[threads-standalone] [DRY RUN] Would post:');
    console.log(`  "${threadText}"`);
    return true;
  }

  console.log(`[threads-standalone] Posting thread for message ${msg.id.slice(0, 8)}...`);
  const { context, page } = await launchThreads();

  try {
    await composeThread(page, threadText);
    console.log('[threads-standalone] Thread posted!');

    await createPost({
      platform: 'threads' as Platform,
      messageIds: [msg.id],
      caption: threadText,
      postType: 'feed',
    });

    return true;
  } finally {
    await context.close();
  }
}
