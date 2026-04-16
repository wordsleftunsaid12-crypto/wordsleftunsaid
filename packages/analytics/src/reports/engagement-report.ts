/**
 * Comprehensive engagement report — answers "what's working?"
 * Breaks down metrics by platform, template, mood, and posting time.
 */
import {
  getPostsByPlatform,
  getRecentPosts,
  getLatestMetrics,
  getMessageById,
} from '@wlu/shared';
import type { Platform, Post, EngagementMetric } from '@wlu/shared';
import { computeEngagementScore } from '../analysis/engagement.js';

const ALL_PLATFORMS: Platform[] = [
  'instagram', 'tiktok', 'youtube', 'reddit', 'twitter', 'pinterest',
];

interface PostWithMetrics {
  post: Post;
  metrics: EngagementMetric;
  score: number;
  contentPreview: string;
}

/**
 * Generate and print a comprehensive engagement report.
 */
export async function generateEngagementReport(daysBack: number = 30): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ENGAGEMENT REPORT — Last ${daysBack} Days`);
  console.log(`${'='.repeat(60)}\n`);

  // Collect all posts with metrics
  const allPosts = await getRecentPosts(daysBack, { limit: 500 });
  const postsWithMetrics: PostWithMetrics[] = [];
  let postsWithoutMetrics = 0;

  for (const post of allPosts) {
    const metrics = await getLatestMetrics(post.id);
    if (!metrics) {
      postsWithoutMetrics++;
      continue;
    }

    // Get content preview from the first message
    let contentPreview = '(no message)';
    if (post.messageIds.length > 0) {
      const msg = await getMessageById(post.messageIds[0]).catch(() => null);
      if (msg) {
        contentPreview = msg.content.slice(0, 50) + (msg.content.length > 50 ? '...' : '');
      }
    }

    postsWithMetrics.push({
      post,
      metrics,
      score: computeEngagementScore(metrics),
      contentPreview,
    });
  }

  // --- OVERVIEW ---
  console.log('OVERVIEW');
  console.log(`  Total posts: ${allPosts.length} across ${new Set(allPosts.map(p => p.platform)).size} platforms`);
  console.log(`  Posts with metrics: ${postsWithMetrics.length}`);
  if (postsWithoutMetrics > 0) {
    console.log(`  Posts without metrics: ${postsWithoutMetrics} (run collect-metrics to populate)`);
  }

  if (postsWithMetrics.length === 0) {
    console.log('\n  No engagement data yet. Run metrics collection first:');
    console.log('  npx tsx packages/social/src/index.ts collect-metrics\n');
    return;
  }

  // Aggregate totals
  const totals = postsWithMetrics.reduce(
    (acc, { metrics }) => ({
      views: acc.views + metrics.views,
      likes: acc.likes + metrics.likes,
      comments: acc.comments + metrics.comments,
      shares: acc.shares + metrics.shares,
      saves: acc.saves + metrics.saves,
    }),
    { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 },
  );

  const n = postsWithMetrics.length;
  console.log(`  Total views: ${totals.views.toLocaleString()}`);
  console.log(`  Total likes: ${totals.likes.toLocaleString()}`);
  console.log(`  Total comments: ${totals.comments.toLocaleString()}`);
  console.log(`  Avg per post: ${Math.round(totals.views / n)} views, ${(totals.likes / n).toFixed(1)} likes, ${(totals.comments / n).toFixed(1)} comments`);

  // --- BY PLATFORM ---
  console.log('\nBY PLATFORM');
  const byPlatform = groupBy(postsWithMetrics, (p) => p.post.platform);
  for (const platform of ALL_PLATFORMS) {
    const group = byPlatform[platform];
    if (!group || group.length === 0) continue;

    const avgViews = Math.round(group.reduce((s, p) => s + p.metrics.views, 0) / group.length);
    const avgLikes = (group.reduce((s, p) => s + p.metrics.likes, 0) / group.length).toFixed(1);
    const avgComments = (group.reduce((s, p) => s + p.metrics.comments, 0) / group.length).toFixed(1);
    const avgScore = (group.reduce((s, p) => s + p.score, 0) / group.length).toFixed(4);

    console.log(
      `  ${platform.padEnd(12)} ${String(group.length).padStart(3)} posts | avg: ${String(avgViews).padStart(6)} views, ${avgLikes.padStart(5)} likes, ${avgComments.padStart(5)} comments | score: ${avgScore}`,
    );
  }

  // --- TOP PERFORMERS ---
  const sorted = [...postsWithMetrics].sort((a, b) => b.score - a.score);
  console.log('\nTOP 5 PERFORMERS (by engagement score)');
  for (const item of sorted.slice(0, 5)) {
    const { post, metrics, score } = item;
    const engRate = metrics.views > 0
      ? `${((metrics.likes + metrics.comments) / metrics.views * 100).toFixed(1)}%`
      : 'N/A';
    console.log(
      `  ${score.toFixed(4)} | ${(post.platform ?? '').padEnd(10)} | ${String(metrics.views).padStart(6)} views, ${String(metrics.likes).padStart(4)} likes | ${engRate} | "${item.contentPreview}"`,
    );
  }

  // --- WORST PERFORMERS ---
  console.log('\nBOTTOM 5 (lowest engagement)');
  for (const item of sorted.slice(-5).reverse()) {
    const { post, metrics, score } = item;
    console.log(
      `  ${score.toFixed(4)} | ${(post.platform ?? '').padEnd(10)} | ${String(metrics.views).padStart(6)} views, ${String(metrics.likes).padStart(4)} likes | "${item.contentPreview}"`,
    );
  }

  // --- BY TEMPLATE ---
  console.log('\nBY TEMPLATE (avg engagement score)');
  const byTemplate = groupBy(postsWithMetrics, (p) => p.post.template ?? 'unknown');
  const templateScores = Object.entries(byTemplate)
    .map(([template, group]) => ({
      template,
      avgScore: group.reduce((s, p) => s + p.score, 0) / group.length,
      avgViews: Math.round(group.reduce((s, p) => s + p.metrics.views, 0) / group.length),
      count: group.length,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  for (const { template, avgScore, avgViews, count } of templateScores) {
    console.log(
      `  ${template.padEnd(25)} score: ${avgScore.toFixed(4)} | avg views: ${String(avgViews).padStart(6)} | ${count} posts`,
    );
  }

  // --- BY MOOD ---
  console.log('\nBY MOOD (avg engagement score)');
  const byMood = groupBy(postsWithMetrics, (p) => p.post.mood ?? 'unknown');
  const moodScores = Object.entries(byMood)
    .map(([mood, group]) => ({
      mood,
      avgScore: group.reduce((s, p) => s + p.score, 0) / group.length,
      avgViews: Math.round(group.reduce((s, p) => s + p.metrics.views, 0) / group.length),
      count: group.length,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  for (const { mood, avgScore, avgViews, count } of moodScores) {
    console.log(
      `  ${mood.padEnd(20)} score: ${avgScore.toFixed(4)} | avg views: ${String(avgViews).padStart(6)} | ${count} posts`,
    );
  }

  // --- BY POSTING HOUR ---
  console.log('\nBY POSTING HOUR (UTC)');
  const byHour = groupBy(postsWithMetrics, (p) => {
    const hour = new Date(p.post.postedAt).getUTCHours();
    return String(hour).padStart(2, '0') + ':00';
  });
  const hourScores = Object.entries(byHour)
    .map(([hour, group]) => ({
      hour,
      avgScore: group.reduce((s, p) => s + p.score, 0) / group.length,
      avgViews: Math.round(group.reduce((s, p) => s + p.metrics.views, 0) / group.length),
      count: group.length,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  for (const { hour, avgScore, avgViews, count } of hourScores) {
    console.log(
      `  ${hour.padEnd(8)} score: ${avgScore.toFixed(4)} | avg views: ${String(avgViews).padStart(6)} | ${count} posts`,
    );
  }

  // --- RECOMMENDATIONS ---
  console.log('\nRECOMMENDATIONS');
  if (templateScores.length > 0) {
    console.log(`  Best template:  ${templateScores[0].template} (score: ${templateScores[0].avgScore.toFixed(4)})`);
    if (templateScores.length > 1) {
      const worst = templateScores[templateScores.length - 1];
      console.log(`  Worst template: ${worst.template} (score: ${worst.avgScore.toFixed(4)})`);
    }
  }
  if (moodScores.length > 0) {
    console.log(`  Best mood:      ${moodScores[0].mood} (score: ${moodScores[0].avgScore.toFixed(4)})`);
  }
  if (hourScores.length > 0) {
    console.log(`  Best time:      ${hourScores[0].hour} UTC (score: ${hourScores[0].avgScore.toFixed(4)})`);
  }

  console.log(`\n${'='.repeat(60)}\n`);
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}
