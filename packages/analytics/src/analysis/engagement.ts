import {
  getRecentPosts,
  getAllMetricsForPost,
  getLatestMetrics,
} from '@wlu/shared';
import type { ContentPerformance, EngagementSummary } from '@wlu/shared';

/**
 * Weighted engagement scoring formula.
 * Prioritizes saves and shares (high intent) over likes (low intent).
 *
 * score = (likes×1 + comments×3 + saves×5 + shares×4) / max(views, 1)
 */
export function computeEngagementScore(metrics: {
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  views: number;
}): number {
  const weighted =
    metrics.likes * 1 +
    metrics.comments * 3 +
    metrics.saves * 5 +
    metrics.shares * 4;

  return weighted / Math.max(metrics.views, 1);
}

/**
 * Score all recent posts and return them ranked by engagement.
 */
export async function scoreRecentPosts(
  daysBack: number = 30,
): Promise<ContentPerformance[]> {
  const posts = await getRecentPosts(daysBack, { limit: 100 });
  const scored: ContentPerformance[] = [];

  for (const post of posts) {
    const metrics = await getLatestMetrics(post.id);
    if (!metrics) continue;

    scored.push({
      postId: post.id,
      messageIds: post.messageIds,
      template: post.template,
      mood: post.mood,
      engagementScore: computeEngagementScore(metrics),
      postedAt: post.postedAt,
    });
  }

  // Sort by score descending
  scored.sort((a, b) => b.engagementScore - a.engagementScore);
  return scored;
}

/**
 * Generate an engagement summary across recent posts.
 */
export async function generateEngagementSummary(
  daysBack: number = 30,
): Promise<EngagementSummary> {
  const posts = await getRecentPosts(daysBack, { limit: 100 });

  if (posts.length === 0) {
    return {
      totalPosts: 0,
      avgLikes: 0,
      avgComments: 0,
      avgViews: 0,
      avgSaves: 0,
      engagementRate: 0,
      bestPerformingMood: null,
      bestPerformingTemplate: null,
      bestPostingHour: null,
    };
  }

  let totalLikes = 0;
  let totalComments = 0;
  let totalViews = 0;
  let totalSaves = 0;
  let postsWithMetrics = 0;

  const moodScores: Record<string, { total: number; count: number }> = {};
  const templateScores: Record<string, { total: number; count: number }> = {};
  const hourScores: Record<number, { total: number; count: number }> = {};

  for (const post of posts) {
    const metrics = await getLatestMetrics(post.id);
    if (!metrics) continue;

    postsWithMetrics++;
    totalLikes += metrics.likes;
    totalComments += metrics.comments;
    totalViews += metrics.views;
    totalSaves += metrics.saves;

    const score = computeEngagementScore(metrics);

    // Track by mood
    if (post.mood) {
      if (!moodScores[post.mood]) moodScores[post.mood] = { total: 0, count: 0 };
      moodScores[post.mood].total += score;
      moodScores[post.mood].count++;
    }

    // Track by template
    if (post.template) {
      if (!templateScores[post.template]) templateScores[post.template] = { total: 0, count: 0 };
      templateScores[post.template].total += score;
      templateScores[post.template].count++;
    }

    // Track by posting hour
    const hour = new Date(post.postedAt).getHours();
    if (!hourScores[hour]) hourScores[hour] = { total: 0, count: 0 };
    hourScores[hour].total += score;
    hourScores[hour].count++;
  }

  const n = Math.max(postsWithMetrics, 1);

  return {
    totalPosts: posts.length,
    avgLikes: totalLikes / n,
    avgComments: totalComments / n,
    avgViews: totalViews / n,
    avgSaves: totalSaves / n,
    engagementRate: totalViews > 0 ? (totalLikes + totalComments + totalSaves) / totalViews : 0,
    bestPerformingMood: findBestKey(moodScores),
    bestPerformingTemplate: findBestKey(templateScores),
    bestPostingHour: findBestHour(hourScores),
  };
}

function findBestKey(scores: Record<string, { total: number; count: number }>): string | null {
  let best: string | null = null;
  let bestAvg = -Infinity;

  for (const [key, { total, count }] of Object.entries(scores)) {
    const avg = total / count;
    if (avg > bestAvg) {
      bestAvg = avg;
      best = key;
    }
  }

  return best;
}

function findBestHour(scores: Record<number, { total: number; count: number }>): number | null {
  let best: number | null = null;
  let bestAvg = -Infinity;

  for (const [hour, { total, count }] of Object.entries(scores)) {
    const avg = total / count;
    if (avg > bestAvg) {
      bestAvg = avg;
      best = Number(hour);
    }
  }

  return best;
}
