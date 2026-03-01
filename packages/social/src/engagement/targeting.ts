import { getLatestStrategyBrief } from '@wlu/shared';
import type { StrategyBrief } from '@wlu/shared';

/**
 * Hashtags related to the Words Left Unsaid brand and emotional content.
 * These are used for finding related content to engage with.
 */
const DEFAULT_TARGET_HASHTAGS = [
  'unsaidwords',
  'lettersneverwritten',
  'dearex',
  'openletter',
  'unsent',
  'unsentletters',
  'mentalhealthawareness',
  'dearfutureme',
  'thingsineversaid',
  'wordsleftunsaid',
  'emotionalhealth',
  'vulnerabilityisstrength',
  'unsaidthoughts',
  'lettertoself',
  'healingthroughwords',
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
