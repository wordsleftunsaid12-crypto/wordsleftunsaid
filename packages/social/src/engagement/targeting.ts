import { getLatestStrategyBrief } from '@wlu/shared';
import type { StrategyBrief } from '@wlu/shared';

/**
 * Hashtags for outbound engagement, ordered by traffic level.
 * High-traffic tags appear first for better discovery on TikTok.
 * Niche tags are still included for community building on Instagram.
 */
const DEFAULT_TARGET_HASHTAGS = [
  // High-traffic — active on both TikTok and Instagram (weighted: appear twice)
  'mentalhealthawareness',
  'selflove',
  'healing',
  'heartbreak',
  'deepquotes',
  'relatablequotes',
  'emotionalhealing',
  'breakup',
  // Duplicate high-traffic for higher selection probability
  'mentalhealthawareness',
  'heartbreak',
  'deepquotes',
  'relatablequotes',
  // Medium-traffic — good engagement, less competition
  'dearex',
  'openletter',
  'unsentletters',
  'thingsineversaid',
  'dearfutureme',
  'lettertoself',
  'healingthroughwords',
  'letterstomyex',
];

/**
 * Get hashtags to target for outbound engagement.
 * Pulls from strategy brief if available, otherwise uses defaults.
 */
export async function getTargetHashtags(): Promise<string[]> {
  try {
    const briefRecord = await getLatestStrategyBrief();
    if (briefRecord) {
      const brief = briefRecord.brief as unknown as StrategyBrief;
      if (brief.engagementInsights) {
        // Extract any mentioned hashtags from insights
        const hashtagMatches = brief.engagementInsights.match(/#\w+/g);
        if (hashtagMatches && hashtagMatches.length > 0) {
          const insightHashtags = hashtagMatches.map((h) => h.replace('#', ''));
          // Merge with defaults, prioritizing insight-based ones
          return [...new Set([...insightHashtags, ...DEFAULT_TARGET_HASHTAGS])];
        }
      }
    }
  } catch {
    // Use defaults
  }

  return DEFAULT_TARGET_HASHTAGS;
}

/**
 * Pick a random hashtag from the target list for this engagement session.
 */
export function pickRandomHashtag(hashtags: string[]): string {
  return hashtags[Math.floor(Math.random() * hashtags.length)];
}
