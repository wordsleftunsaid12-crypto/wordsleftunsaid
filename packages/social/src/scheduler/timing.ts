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
 */
export const INTERVALS = {
  INGEST: 30 * 60000,        // 30 min base → 21-39 min with jitter
  CAPTION: 15 * 60000,       // 15 min base → 10-20 min
  SCHEDULE: 60 * 60000,      // 60 min base → 42-78 min
  PUBLISH: 5 * 60000,        // 5 min base → 3.5-6.5 min
  COMMENT_REPLY: 30 * 60000, // 30 min base → 21-39 min
  OUTBOUND: 45 * 60000,      // 45 min base → 31-59 min
  RENDER: 4 * 3600000,       // 4 hours base → 2.8-5.2 hours with jitter
  METRICS: 12 * 3600000,     // 12 hours base → twice daily with jitter
  LEARN: 24 * 3600000,       // 24 hours (once daily)
} as const;
