/**
 * Jittered interval utilities for randomized scheduling.
 * All intervals have ±30% jitter to avoid predictable bot-like patterns.
 */

/**
 * Add ±30% jitter to a base interval in milliseconds.
 */
export function jitteredInterval(baseMs: number): number {
  const jitterFactor = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
  return Math.round(baseMs * jitterFactor);
}

/**
 * Sleep for a jittered duration.
 */
export function jitteredSleep(baseMs: number): Promise<void> {
  const actual = jitteredInterval(baseMs);
  return new Promise((resolve) => setTimeout(resolve, actual));
}

/**
 * Predefined base intervals for scheduled jobs (in milliseconds).
 *
 * NOTE (Apr 2026): all posting-related intervals were stretched after
 * Instagram/TikTok flagged the account as bot activity. The goal is
 * to keep total daily actions well under platform thresholds.
 */
export const INTERVALS = {
  CAPTION: 15 * 60000,         // 15 min base → 10-20 min
  SCHEDULE: 60 * 60000,        // 60 min base → 42-78 min
  PUBLISH: 15 * 60000,         // 15 min base → 10-20 min (was 5m — too eager)
  COMMENT_REPLY: 8 * 3600000,  // 8 hours base → ~3x/day
  OUTBOUND: 12 * 3600000,      // 12 hours base → ~2x/day (further reduced)
  RENDER: 6 * 3600000,         // 6 hours base → ~4x/day (was 4h)
  METRICS: 12 * 3600000,       // 12 hours base → ~2x daily
  LEARN: 24 * 3600000,         // 24 hours (once daily)
  VERIFY: 6 * 3600000,         // 6 hours base → ~4x/day (was 4h)
  DAILY_SUMMARY: 24 * 3600000, // 24 hours (once daily)
  UNFOLLOW: 24 * 3600000,      // 24 hours (once daily)
} as const;
