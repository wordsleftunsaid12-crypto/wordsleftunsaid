import type { CompositionId } from './render.js';

/**
 * Per-platform template weights for content experiments.
 *
 * Weights should sum to 1.0 per platform. Higher weight = more frequently selected.
 * Adjust based on engagement data from the analytics daily summary.
 *
 * The "exploration" templates (new formats) start with lower weights
 * and can be increased as performance data comes in.
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
  // Instagram: Reels-first, cinematic performs well, test new formats
  instagram: [
    ['CinematicVertical', 0.22],
    ['POVVertical', 0.18],
    ['TextOnGradientVertical', 0.14],
    ['TypewriterVertical', 0.14],
    ['HandwrittenVertical', 0.09],
    ['VoiceNarrationVertical', 0.08],
    ['ClassicVertical', 0.08],
    ['ModernVertical', 0.07],
  ],

  // TikTok: Bold, fast-paced formats — VoiceNarration fits TikTok storytelling
  tiktok: [
    ['POVVertical', 0.22],
    ['TextOnGradientVertical', 0.18],
    ['CinematicVertical', 0.18],
    ['TypewriterVertical', 0.13],
    ['VoiceNarrationVertical', 0.10],
    ['HandwrittenVertical', 0.09],
    ['ModernVertical', 0.05],
    ['ClassicVertical', 0.05],
  ],

  // YouTube Shorts: Cinematic and slower-paced — VoiceNarration is a natural fit
  youtube: [
    ['CinematicVertical', 0.25],
    ['POVVertical', 0.17],
    ['VoiceNarrationVertical', 0.13],
    ['HandwrittenVertical', 0.13],
    ['TypewriterVertical', 0.13],
    ['TextOnGradientVertical', 0.09],
    ['ModernVertical', 0.05],
    ['ClassicVertical', 0.05],
  ],

  // Reddit: Text-forward formats, viral potential
  reddit: [
    ['TextOnGradientVertical', 0.23],
    ['TypewriterVertical', 0.23],
    ['POVVertical', 0.18],
    ['CinematicVertical', 0.13],
    ['HandwrittenVertical', 0.09],
    ['VoiceNarrationVertical', 0.07],
    ['ModernVertical', 0.04],
    ['ClassicVertical', 0.03],
  ],

  // Pinterest: Warm, aesthetic formats — voice less relevant for Pinterest
  pinterest: [
    ['HandwrittenVertical', 0.24],
    ['ClassicVertical', 0.19],
    ['CinematicVertical', 0.19],
    ['TextOnGradientVertical', 0.14],
    ['ModernVertical', 0.09],
    ['VoiceNarrationVertical', 0.05],
    ['TypewriterVertical', 0.05],
    ['POVVertical', 0.05],
  ],

  // Twitter: Quick-hit, shareable formats
  twitter: [
    ['TextOnGradientVertical', 0.27],
    ['POVVertical', 0.22],
    ['TypewriterVertical', 0.18],
    ['CinematicVertical', 0.09],
    ['HandwrittenVertical', 0.09],
    ['VoiceNarrationVertical', 0.07],
    ['ModernVertical', 0.04],
    ['ClassicVertical', 0.04],
  ],

  // Threads: Similar to Instagram but more text-forward
  threads: [
    ['TextOnGradientVertical', 0.23],
    ['POVVertical', 0.18],
    ['CinematicVertical', 0.18],
    ['TypewriterVertical', 0.13],
    ['HandwrittenVertical', 0.09],
    ['VoiceNarrationVertical', 0.08],
    ['ClassicVertical', 0.06],
    ['ModernVertical', 0.05],
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
    'POVVertical',
    'TextOnGradientVertical',
    'TypewriterVertical',
    'HandwrittenVertical',
    'VoiceNarrationVertical',
    'ClassicVertical',
    'ModernVertical',
  ];
}
