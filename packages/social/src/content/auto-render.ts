/**
 * Automated content rendering — creates videos from unused messages.
 * Shells out to content-engine CLI for rendering and QA.
 *
 * If not enough unused approved messages exist, seeds new ones
 * from the message pool so they appear on the website too.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getApprovedMessages,
  getUsedMessageIds,
  createApprovedMessage,
  MAX_VIDEO_CONTENT_LENGTH,
  notifyMessageBecameVideo,
} from '@wlu/shared';
import { MESSAGE_POOL } from './message-seeder.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

/** How many videos to render per cycle */
const VIDEOS_PER_CYCLE = 2;

/** Minimum unused messages needed before rendering */
const MIN_UNUSED_MESSAGES = 3;

interface AutoRenderResult {
  rendered: number;
  seeded: number;
  qaPassed: number;
  errors: number;
}

/**
 * Ensure enough unused approved messages exist for rendering.
 * If not, seeds new ones from the message pool (these appear on the website).
 */
async function ensureUnusedMessages(needed: number): Promise<number> {
  const [allMessages, usedIds] = await Promise.all([
    getApprovedMessages({ limit: 200 }),
    getUsedMessageIds(),
  ]);

  const usedSet = new Set(usedIds);
  // Only count messages short enough for video rendering
  const unused = allMessages.filter(
    (m) => !usedSet.has(m.id) && m.content.length <= MAX_VIDEO_CONTENT_LENGTH,
  );

  if (unused.length >= needed) {
    console.log(`[auto-render] ${unused.length} unused messages available (≤${MAX_VIDEO_CONTENT_LENGTH} chars)`);
    return 0;
  }

  const toSeed = needed - unused.length;
  console.log(`[auto-render] Only ${unused.length} unused short messages, seeding ${toSeed} more...`);

  // Find templates not already in DB, short enough for video
  const existingContents = new Set(
    allMessages.map((m) => m.content.toLowerCase().trim()),
  );
  const available = MESSAGE_POOL.filter(
    (t) => !existingContents.has(t.content.toLowerCase().trim())
      && t.content.length <= MAX_VIDEO_CONTENT_LENGTH,
  );

  if (available.length === 0) {
    console.warn('[auto-render] Message pool exhausted! No new templates available.');
    return 0;
  }

  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const picks = shuffled.slice(0, toSeed);
  let seeded = 0;

  for (const template of picks) {
    try {
      await createApprovedMessage({
        from: template.from,
        to: template.to,
        content: template.content,
        seeded: true,
      });
      seeded++;
    } catch (err) {
      console.warn('[auto-render] Failed to seed message:', err instanceof Error ? err.message : err);
    }
  }

  console.log(`[auto-render] Seeded ${seeded} new messages (visible on website)`);
  return seeded;
}

/**
 * Run the auto-render pipeline:
 * 1. Ensure enough unused messages (seed if needed)
 * 2. Render videos via content-engine CLI
 * 3. QA the rendered videos
 */
export async function renderNextContent(options: {
  dryRun?: boolean;
  count?: number;
} = {}): Promise<AutoRenderResult> {
  const { dryRun = false, count = VIDEOS_PER_CYCLE } = options;
  const result: AutoRenderResult = { rendered: 0, seeded: 0, qaPassed: 0, errors: 0 };

  try {
    // Step 1: Ensure enough messages
    result.seeded = await ensureUnusedMessages(MIN_UNUSED_MESSAGES);

    if (dryRun) {
      console.log(`[auto-render] [DRY RUN] Would render ${count} videos and run QA`);
      return result;
    }

    // Snapshot used IDs before rendering (to detect newly-rendered UGC messages)
    const usedIdsBefore = new Set(await getUsedMessageIds());

    // Step 2: Render videos via content-engine CLI (auto-selects template)
    console.log(`[auto-render] Rendering ${count} videos for Instagram...`);
    const renderResult = await execFileAsync(
      'npx',
      ['tsx', 'packages/content-engine/src/index.ts', 'render-next', 'auto', String(count)],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
        timeout: 10 * 60 * 1000, // 10 minutes per render
      },
    );

    // Count rendered videos from output
    let renderedCount = (renderResult.stdout.match(/Queued with message ID tracked/g) ?? []).length;
    console.log(`[auto-render] Rendered ${renderedCount} IG video(s)`);

    // Step 2b: Render 1 video for YouTube with subscribe CTA
    try {
      console.log('[auto-render] Rendering 1 video for YouTube (subscribe CTA)...');
      const ytResult = await execFileAsync(
        'npx',
        ['tsx', 'packages/content-engine/src/index.ts', 'render-next', 'CinematicVertical', '1', 'youtube'],
        {
          cwd: PROJECT_ROOT,
          env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
          timeout: 10 * 60 * 1000,
        },
      );
      const ytRendered = (ytResult.stdout.match(/Queued with message ID tracked/g) ?? []).length;
      renderedCount += ytRendered;
      console.log(`[auto-render] Rendered ${ytRendered} YouTube video(s)`);
    } catch (err) {
      console.warn('[auto-render] YouTube render failed:', err instanceof Error ? err.message : String(err));
    }

    result.rendered = renderedCount;
    console.log(`[auto-render] Total rendered: ${renderedCount} video(s)`);

    if (renderResult.stderr) {
      console.warn('[auto-render] Render stderr:', renderResult.stderr.slice(0, 200));
    }

    if (renderedCount === 0) {
      console.log('[auto-render] No videos rendered (all messages may be used)');
      return result;
    }

    // Step 3: QA the rendered videos
    console.log('[auto-render] Running QA on pending items...');
    const qaResult = await execFileAsync(
      'npx',
      ['tsx', 'packages/content-engine/src/index.ts', 'qa-all'],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
        timeout: 5 * 60 * 1000,
      },
    );

    // Parse QA results
    const qaMatch = qaResult.stdout.match(/(\d+) passed/);
    result.qaPassed = qaMatch ? parseInt(qaMatch[1], 10) : 0;
    console.log(`[auto-render] QA complete: ${result.qaPassed} passed`);

    if (qaResult.stderr) {
      console.warn('[auto-render] QA stderr:', qaResult.stderr.slice(0, 200));
    }

    // Step 4: Notify UGC submitters that their message became a video
    try {
      const usedIdsAfter = await getUsedMessageIds();
      const newlyUsed = usedIdsAfter.filter((id) => !usedIdsBefore.has(id));
      if (newlyUsed.length > 0) {
        const allMessages = await getApprovedMessages({ limit: 200 });
        const messageMap = new Map(allMessages.map((m) => [m.id, m]));
        for (const id of newlyUsed) {
          const msg = messageMap.get(id);
          if (msg && msg.email && !msg.seeded) {
            await notifyMessageBecameVideo({
              messageId: msg.id,
              email: msg.email,
              to: msg.to,
              siteUrl: 'https://wordsleftunsent.com',
            }).catch(() => {});
            console.log(`[auto-render] Notified ${msg.email} that their message became a video`);
          }
        }
      }
    } catch (err) {
      console.warn('[auto-render] UGC notification failed:', err instanceof Error ? err.message : err);
    }
  } catch (err) {
    result.errors++;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[auto-render] Error: ${msg.slice(0, 200)}`);
  }

  console.log(
    `[auto-render] Cycle complete: ${result.rendered} rendered, ${result.qaPassed} QA passed, ${result.seeded} seeded, ${result.errors} errors`,
  );
  return result;
}
