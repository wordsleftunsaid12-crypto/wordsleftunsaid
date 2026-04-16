/**
 * Human-like browser warm-up routine.
 *
 * Instead of opening a platform and immediately firing a publish action,
 * we burn 15-45 seconds doing the kind of thing a real person does first:
 * look at the feed, scroll a bit, hover over a post. This breaks the
 * "opens browser → publishes within 2 seconds" fingerprint that bot
 * detection treats as a hard signal.
 *
 * Keep the actions deliberately cheap and read-only:
 *   - no likes, no comments, no clicks on profiles
 *   - only scroll + hover + read
 * so that warm-up never accidentally burns engagement budget.
 */
import type { Page } from 'playwright';

/** Sleep with a small ±20% jitter for natural-looking timing. */
async function jitterSleep(page: Page, baseMs: number): Promise<void> {
  const jitter = baseMs * (0.8 + Math.random() * 0.4);
  await page.waitForTimeout(Math.round(jitter));
}

/** Pick a random int in [min, max]. */
function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export interface WarmupOptions {
  /** Minimum warm-up duration in ms. Default 15000 (15s). */
  minMs?: number;
  /** Maximum warm-up duration in ms. Default 45000 (45s). */
  maxMs?: number;
  /** URL to warm up on. Default is current page. */
  feedUrl?: string;
}

/**
 * Run a human-like warm-up sequence on the given page before taking
 * an action. Scrolls the feed, pauses, hovers over posts. Never clicks
 * anything destructive. Safe to call on any logged-in platform page.
 */
export async function warmupBrowser(
  page: Page,
  options: WarmupOptions = {},
): Promise<void> {
  const minMs = options.minMs ?? 15000;
  const maxMs = options.maxMs ?? 45000;
  const budget = randInt(minMs, maxMs);
  const deadline = Date.now() + budget;

  console.log(`[warmup] Browsing for ${Math.round(budget / 1000)}s before action`);

  if (options.feedUrl) {
    try {
      await page.goto(options.feedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    } catch {
      // Page may already be at the right URL or be slow — keep going
    }
  }

  // Initial settle
  await jitterSleep(page, 2000);

  while (Date.now() < deadline) {
    // Pick a random action
    const action = Math.random();

    if (action < 0.5) {
      // Scroll down a random amount (200-900 px)
      const dy = randInt(200, 900);
      await page.mouse.wheel(0, dy).catch(() => { /* ignore */ });
      await jitterSleep(page, randInt(800, 3500));
    } else if (action < 0.75) {
      // Scroll up a bit (20% chance of partial rewind — real humans do this)
      const dy = randInt(100, 400);
      await page.mouse.wheel(0, -dy).catch(() => { /* ignore */ });
      await jitterSleep(page, randInt(600, 2000));
    } else if (action < 0.9) {
      // Hover somewhere random (simulates reading)
      const vw = page.viewportSize()?.width ?? 1280;
      const vh = page.viewportSize()?.height ?? 900;
      const x = randInt(Math.round(vw * 0.2), Math.round(vw * 0.8));
      const y = randInt(Math.round(vh * 0.2), Math.round(vh * 0.8));
      await page.mouse.move(x, y).catch(() => { /* ignore */ });
      await jitterSleep(page, randInt(1000, 3000));
    } else {
      // Just pause — "reading" a post
      await jitterSleep(page, randInt(2000, 5000));
    }
  }

  // Scroll back near the top before returning control — makes the
  // follow-up action (e.g. New Post button) land in a predictable place.
  await page.mouse.wheel(0, -5000).catch(() => { /* ignore */ });
  await jitterSleep(page, 1500);
}

/**
 * Short warm-up (5-12s) — for outbound engagement where we don't want
 * to burn too much time before starting interaction rounds.
 */
export async function quickWarmup(page: Page): Promise<void> {
  await warmupBrowser(page, { minMs: 5000, maxMs: 12000 });
}
