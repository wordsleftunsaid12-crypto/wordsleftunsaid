import { getRecentPosts, getLatestMetrics } from '@wlu/shared';
import { computeEngagementScore } from './engagement.js';

interface TrendCorrelation {
  dimension: string;
  value: string;
  avgScore: number;
  postCount: number;
}

/**
 * Analyze correlations between post metadata and engagement scores.
 * Identifies which moods, templates, hours, and days perform best.
 */
export async function analyzeTrends(
  daysBack: number = 30,
): Promise<{
  byMood: TrendCorrelation[];
  byTemplate: TrendCorrelation[];
  byHour: TrendCorrelation[];
  byDayOfWeek: TrendCorrelation[];
}> {
  const posts = await getRecentPosts(daysBack, { limit: 100 });

  const buckets: Record<string, Record<string, { scores: number[]; count: number }>> = {
    mood: {},
    template: {},
    hour: {},
    dayOfWeek: {},
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const post of posts) {
    const metrics = await getLatestMetrics(post.id);
    if (!metrics) continue;

    const score = computeEngagementScore(metrics);
    const postedDate = new Date(post.postedAt);

    // Mood
    if (post.mood) {
      if (!buckets['mood'][post.mood]) buckets['mood'][post.mood] = { scores: [], count: 0 };
      buckets['mood'][post.mood].scores.push(score);
      buckets['mood'][post.mood].count++;
    }

    // Template
    if (post.template) {
      if (!buckets['template'][post.template]) buckets['template'][post.template] = { scores: [], count: 0 };
      buckets['template'][post.template].scores.push(score);
      buckets['template'][post.template].count++;
    }

    // Hour
    const hour = String(postedDate.getHours());
    if (!buckets['hour'][hour]) buckets['hour'][hour] = { scores: [], count: 0 };
    buckets['hour'][hour].scores.push(score);
    buckets['hour'][hour].count++;

    // Day of week
    const day = dayNames[postedDate.getDay()];
    if (!buckets['dayOfWeek'][day]) buckets['dayOfWeek'][day] = { scores: [], count: 0 };
    buckets['dayOfWeek'][day].scores.push(score);
    buckets['dayOfWeek'][day].count++;
  }

  return {
    byMood: toCorrelations('mood', buckets['mood']),
    byTemplate: toCorrelations('template', buckets['template']),
    byHour: toCorrelations('hour', buckets['hour']),
    byDayOfWeek: toCorrelations('dayOfWeek', buckets['dayOfWeek']),
  };
}

function toCorrelations(
  dimension: string,
  bucket: Record<string, { scores: number[]; count: number }>,
): TrendCorrelation[] {
  return Object.entries(bucket)
    .map(([value, { scores, count }]) => ({
      dimension,
      value,
      avgScore: scores.reduce((a, b) => a + b, 0) / Math.max(count, 1),
      postCount: count,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}
