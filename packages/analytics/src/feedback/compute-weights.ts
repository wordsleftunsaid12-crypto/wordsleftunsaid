import { getRecentPosts, getLatestMetrics } from '@wlu/shared';
import type { Platform } from '@wlu/shared';
import { computeEngagementScore } from '../analysis/engagement.js';
import type { LearnedWeightsFile } from './weights-store.js';

/** Minimum weight any template can have (exploration floor). */
const EXPLORATION_FLOOR = 0.05;

/** Maximum weight any single template can have (prevents over-concentration). */
const WEIGHT_CAP = 0.40;

/** Minimum posts before we trust a template's data (Bayesian prior strength). */
const MIN_SAMPLE_SIZE = 3;

/** How many days of engagement data to use. */
const LOOKBACK_DAYS = 30;

/** Power to raise smoothed scores to — amplifies differences between templates. */
const AMPLIFICATION_POWER = 1.5;

const ALL_PLATFORMS: Platform[] = [
  'instagram', 'tiktok', 'youtube', 'reddit', 'pinterest', 'twitter',
];

/**
 * Compute per-platform template weights from engagement data.
 *
 * Algorithm:
 * 1. Fetch all posts with metrics from last 30 days
 * 2. Group by platform + template, compute mean engagement score
 * 3. Bayesian smoothing: blend each template's mean with the global platform mean
 *    using credibility = postCount / (postCount + MIN_SAMPLE_SIZE)
 * 4. Raise smoothed scores to AMPLIFICATION_POWER to widen gaps
 * 5. Normalize to sum to 1.0, clamp to EXPLORATION_FLOOR, re-normalize
 * 6. Platforms with zero data keep their hardcoded defaults
 *
 * @param defaultWeights - Hardcoded per-platform weights as baseline/fallback
 */
export async function computeLearnedWeights(
  defaultWeights: Record<string, Array<[string, number]>>,
): Promise<LearnedWeightsFile> {
  // Fetch all recent posts across all platforms in one query
  const posts = await getRecentPosts(LOOKBACK_DAYS, { limit: 500 });

  // Build per-platform-per-template score buckets
  const buckets: Record<string, Record<string, number[]>> = {};
  for (const p of ALL_PLATFORMS) {
    buckets[p] = {};
  }

  for (const post of posts) {
    if (!post.template || !post.platform) continue;
    const metrics = await getLatestMetrics(post.id);
    if (!metrics) continue;

    const score = computeEngagementScore(metrics);
    if (!buckets[post.platform]) buckets[post.platform] = {};
    if (!buckets[post.platform][post.template]) buckets[post.platform][post.template] = [];
    buckets[post.platform][post.template].push(score);
  }

  const result: LearnedWeightsFile = {
    computedAt: new Date().toISOString(),
    platforms: {},
    sampleCounts: {},
  };

  for (const platform of ALL_PLATFORMS) {
    const templateScores = buckets[platform];
    const defaults = defaultWeights[platform] ?? defaultWeights['instagram'] ?? [];
    const defaultTemplates = defaults.map(([t]: [string, number]) => t);

    // Compute global mean across all templates on this platform
    const allScores = Object.values(templateScores).flat();

    // No engagement data for this platform — keep hardcoded defaults
    if (allScores.length === 0) {
      result.platforms[platform] = defaults;
      result.sampleCounts[platform] = Object.fromEntries(
        defaultTemplates.map((t: string) => [t, 0]),
      );
      continue;
    }

    const globalMean = allScores.reduce((a, b) => a + b, 0) / allScores.length;

    const smoothedScores: Array<[string, number]> = [];
    const counts: Record<string, number> = {};

    for (const template of defaultTemplates) {
      const scores = templateScores[template] ?? [];
      counts[template] = scores.length;

      // Bayesian smoothing: credibility = n / (n + prior_strength)
      const credibility = scores.length / (scores.length + MIN_SAMPLE_SIZE);
      const templateMean = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : globalMean;
      const smoothed = credibility * templateMean + (1 - credibility) * globalMean;
      smoothedScores.push([template, Math.max(smoothed, 0.001)]);
    }

    // Amplify differences so score gaps translate into weight gaps
    const amplified = smoothedScores.map(
      ([t, s]) => [t, Math.pow(s, AMPLIFICATION_POWER)] as [string, number],
    );

    // Normalize with cap and floor applied iteratively.
    // Each pass: clamp to [EXPLORATION_FLOOR, WEIGHT_CAP], re-normalize unclamped.
    // Converges in 2-3 iterations.
    let weights = amplified.map(([t, s]) => [t, s] as [string, number]);
    for (let pass = 0; pass < 5; pass++) {
      const sum = weights.reduce((s, [, w]) => s + w, 0);
      weights = weights.map(([t, w]) => [t, w / sum] as [string, number]);

      // Clamp and track excess
      let excess = 0;
      let unclamped = 0;
      weights = weights.map(([t, w]) => {
        if (w > WEIGHT_CAP) { excess += w - WEIGHT_CAP; return [t, WEIGHT_CAP]; }
        if (w < EXPLORATION_FLOOR) { excess -= EXPLORATION_FLOOR - w; return [t, EXPLORATION_FLOOR]; }
        unclamped += w;
        return [t, w];
      });

      if (Math.abs(excess) < 0.001) break;

      // Redistribute excess among unclamped templates
      if (unclamped > 0) {
        weights = weights.map(([t, w]) => {
          if (w > EXPLORATION_FLOOR && w < WEIGHT_CAP) {
            return [t, w + excess * (w / unclamped)];
          }
          return [t, w];
        });
      }
    }

    // Final round to 3 decimal places
    const finalTotal = weights.reduce((s, [, w]) => s + w, 0);
    let normalized = weights.map(
      ([t, w]) => [t, Math.round((w / finalTotal) * 1000) / 1000] as [string, number],
    );

    result.platforms[platform] = normalized;
    result.sampleCounts[platform] = counts;
  }

  return result;
}
