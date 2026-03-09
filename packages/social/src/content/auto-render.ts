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
  qaPasssed: number;
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
  const unused = allMessages.filter((m) => !usedSet.has(m.id));

  if (unused.length >= needed) {
    console.log(`[auto-render] ${unused.length} unused messages available`);
    return 0;
  }

  const toSeed = needed - unused.length;
  console.log(`[auto-render] Only ${unused.length} unused messages, seeding ${toSeed} more...`);

  // Find templates not already in DB
  const existingContents = new Set(
    allMessages.map((m) => m.content.toLowerCase().trim()),
  );
  const available = MESSAGE_POOL.filter(
    (t) => !existingContents.has(t.content.toLowerCase().trim()),
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
  const result: AutoRenderResult = { rendered: 0, seeded: 0, qaPasssed: 0, errors: 0 };

  try {
    // Step 1: Ensure enough messages
    result.seeded = await ensureUnusedMessages(MIN_UNUSED_MESSAGES);

    if (dryRun) {
      console.log(`[auto-render] [DRY RUN] Would render ${count} videos and run QA`);
      return result;
    }

    // Step 2: Render videos via content-engine CLI
    console.log(`[auto-render] Rendering ${count} videos...`);
    const renderResult = await execFileAsync(
      'npx',
      ['tsx', 'packages/content-engine/src/index.ts', 'render-next', 'CinematicVertical', String(count)],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
        timeout: 10 * 60 * 1000, // 10 minutes per render
      },
    );

    // Count rendered videos from output
    const renderedCount = (renderResult.stdout.match(/Queued with message ID tracked/g) ?? []).length;
    result.rendered = renderedCount;
    console.log(`[auto-render] Rendered ${renderedCount} video(s)`);

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
    result.qaPasssed = qaMatch ? parseInt(qaMatch[1], 10) : 0;
    console.log(`[auto-render] QA complete: ${result.qaPasssed} passed`);

    if (qaResult.stderr) {
      console.warn('[auto-render] QA stderr:', qaResult.stderr.slice(0, 200));
    }
  } catch (err) {
    result.errors++;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[auto-render] Error: ${msg.slice(0, 200)}`);
  }

  console.log(
    `[auto-render] Cycle complete: ${result.rendered} rendered, ${result.qaPasssed} QA passed, ${result.seeded} seeded, ${result.errors} errors`,
  );
  return result;
}
