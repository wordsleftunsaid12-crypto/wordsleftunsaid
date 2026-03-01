import Anthropic from '@anthropic-ai/sdk';
import { saveStrategyBrief, getRecentPosts } from '@wlu/shared';
import type { StrategyBrief } from '@wlu/shared';
import { scoreRecentPosts, generateEngagementSummary } from '../analysis/engagement.js';
import { analyzeTrends } from '../analysis/trends.js';

const STRATEGY_SYSTEM_PROMPT = `You are a social media strategist for "Words Left Unsaid," an anonymous message platform that creates short-form video content (Reels/TikToks) from real unsent messages.

Analyze the performance data provided and generate actionable recommendations. Be specific and data-driven. Your analysis directly controls what content gets created and when it gets posted.`;

const STRATEGY_USER_PROMPT = (data: string) =>
  `Here is the performance data from our recent posts:

${data}

Based on this data, generate a strategy brief. Be specific and actionable.

Respond with ONLY valid JSON matching this exact structure:
{
  "preferredMoods": ["mood1", "mood2"],
  "preferredTemplates": ["template1", "template2"],
  "bestPostingHours": [7, 20],
  "captionGuidelines": "Specific guidelines based on what captions performed best...",
  "hashtagPerformance": {"#hashtag1": 0.8, "#hashtag2": 0.5},
  "engagementInsights": "Key insights about what drives engagement and follow-backs..."
}`;

/**
 * Generate a strategy brief from recent performance data.
 * This is the core of the self-learning feedback loop.
 */
export async function generateStrategyBrief(
  daysBack: number = 30,
): Promise<StrategyBrief> {
  const client = new Anthropic();

  // Gather all performance data
  const [scored, summary, trends] = await Promise.all([
    scoreRecentPosts(daysBack),
    generateEngagementSummary(daysBack),
    analyzeTrends(daysBack),
  ]);

  if (scored.length === 0) {
    console.log('[strategy] No posts with metrics to analyze');
    return defaultBrief();
  }

  // Build the data summary for Claude
  const topPosts = scored.slice(0, Math.ceil(scored.length * 0.2));
  const bottomPosts = scored.slice(-Math.ceil(scored.length * 0.2));

  const dataForPrompt = `
## Summary (last ${daysBack} days)
- Total posts: ${summary.totalPosts}
- Avg likes: ${summary.avgLikes.toFixed(1)}
- Avg comments: ${summary.avgComments.toFixed(1)}
- Avg views: ${summary.avgViews.toFixed(0)}
- Avg saves: ${summary.avgSaves.toFixed(1)}
- Engagement rate: ${(summary.engagementRate * 100).toFixed(2)}%

## Top 20% Posts (by engagement score)
${topPosts.map((p) => `- Score: ${p.engagementScore.toFixed(4)} | Mood: ${p.mood ?? 'none'} | Template: ${p.template ?? 'none'} | Posted: ${p.postedAt}`).join('\n')}

## Bottom 20% Posts
${bottomPosts.map((p) => `- Score: ${p.engagementScore.toFixed(4)} | Mood: ${p.mood ?? 'none'} | Template: ${p.template ?? 'none'} | Posted: ${p.postedAt}`).join('\n')}

## Trend Correlations
By Mood: ${JSON.stringify(trends.byMood)}
By Template: ${JSON.stringify(trends.byTemplate)}
By Hour: ${JSON.stringify(trends.byHour)}
By Day: ${JSON.stringify(trends.byDayOfWeek)}
`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: STRATEGY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: STRATEGY_USER_PROMPT(dataForPrompt) }],
  });

  const text = response.content[0];
  if (text.type !== 'text') throw new Error('Unexpected response type');

  const brief = JSON.parse(text.text) as StrategyBrief;

  // Save to database
  const posts = await getRecentPosts(daysBack, { limit: 1000 });
  await saveStrategyBrief({
    brief: brief as unknown as Record<string, unknown>,
    basedOnPosts: posts.length,
  });

  console.log('[strategy] New strategy brief generated and saved');
  console.log(`[strategy] Preferred moods: ${brief.preferredMoods.join(', ')}`);
  console.log(`[strategy] Preferred templates: ${brief.preferredTemplates.join(', ')}`);
  console.log(`[strategy] Best posting hours: ${brief.bestPostingHours.join(', ')}`);

  return brief;
}

/**
 * Default strategy when no data is available.
 */
function defaultBrief(): StrategyBrief {
  return {
    preferredMoods: ['bittersweet', 'tender', 'regretful'],
    preferredTemplates: ['CinematicVertical', 'ClassicVertical'],
    bestPostingHours: [7, 12, 17, 20],
    captionGuidelines: 'Keep captions short (1-2 sentences). Ask a question to drive comments. Use emotional vulnerability.',
    hashtagPerformance: {},
    engagementInsights: 'No data yet. Focus on building initial content library and engaging with #unsaidwords #unsentletters community.',
  };
}
