import type { CompositionId } from './render.js';

/**
 * Per-platform template weights for content experiments.
 *
 * Weights should sum to 1.0 per platform. Higher weight = more frequently selected.
 * Adjust based on engagement data from the analytics daily summary.
 *
 * Active templates (Mar 2026):
 *   Cinematic — cinematic video with bg footage
 *   TextOnGradient — mood-colored gradient with bg footage
 *   DeletedText — phone UI simulation (no bg video)
 *   SplitScreen — "What I said" vs "What I meant"
 *   HandwritingSVG — SVG handwriting reveal on paper
 *   QuoteCard — static Pinterest image (4:5 ratio)
 *   RawText — text post cover image (1:1 square)
 */

type TemplateWeight = [CompositionId, number];

interface PlatformWeights {
  instagram: TemplateWeight[];
  tiktok: TemplateWeight[];
  youtube: TemplateWeight[];
  reddit: TemplateWeight[];
  pinterest: TemplateWeight[];
  twitter: TemplateWeight[];
  threads: TemplateWeight[];
}

const PLATFORM_WEIGHTS: PlatformWeights = {
  // Instagram Reels: phone-native formats dominate
  instagram: [
    ['CinematicVertical', 0.27],
    ['DeletedTextVertical', 0.25],
    ['SplitScreenVertical', 0.19],
    ['HandwritingSVGVertical', 0.15],
    ['TextOnGradientVertical', 0.14],
  ],

  // TikTok: fast-paced, relatable formats
  tiktok: [
    ['DeletedTextVertical', 0.33],
    ['CinematicVertical', 0.22],
    ['SplitScreenVertical', 0.19],
    ['TextOnGradientVertical', 0.13],
    ['HandwritingSVGVertical', 0.13],
  ],

  // YouTube Shorts: slower-paced, cinematic
  youtube: [
    ['CinematicVertical', 0.34],
    ['HandwritingSVGVertical', 0.27],
    ['SplitScreenVertical', 0.23],
    ['DeletedTextVertical', 0.16],
  ],

  // Reddit: text-first, cover image only
  reddit: [
    ['RawTextVertical', 0.58],
    ['SplitScreenVertical', 0.24],
    ['DeletedTextVertical', 0.18],
  ],

  // Pinterest: static images + warm aesthetic
  pinterest: [
    ['QuoteCardVertical', 0.60],
    ['HandwritingSVGVertical', 0.25],
    ['CinematicVertical', 0.15],
  ],

  // Twitter: text-first, mixed with video
  twitter: [
    ['RawTextVertical', 0.40],
    ['DeletedTextVertical', 0.27],
    ['SplitScreenVertical', 0.23],
    ['CinematicVertical', 0.10],
  ],

  // Threads: text-forward + video
  threads: [
    ['RawTextVertical', 0.38],
    ['DeletedTextVertical', 0.27],
    ['SplitScreenVertical', 0.19],
    ['CinematicVertical', 0.16],
  ],
};

/**
 * Get template weights for a specific platform.
 * Falls back to Instagram weights for unknown platforms.
 */
export function getTemplateWeights(platform: string): TemplateWeight[] {
  return PLATFORM_WEIGHTS[platform as keyof PlatformWeights] ?? PLATFORM_WEIGHTS.instagram;
}

/**
 * Pick a template using weighted random selection.
 */
export function pickWeightedTemplate(weights: TemplateWeight[]): CompositionId {
  const r = Math.random();
  let cumulative = 0;
  for (const [name, weight] of weights) {
    cumulative += weight;
    if (r < cumulative) return name;
  }
  return weights[0][0];
}

/**
 * Get all available template composition IDs (vertical only for now).
 */
export function getAllTemplates(): CompositionId[] {
  return [
    'CinematicVertical',
    'TextOnGradientVertical',
    'DeletedTextVertical',
    'QuoteCardVertical',
    'SplitScreenVertical',
    'HandwritingSVGVertical',
    'RawTextVertical',
  ];
}
