import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CompositionId } from './render.js';

/**
 * Per-platform template weights for content experiments.
 *
 * These are the hardcoded defaults used when no learned weights are available.
 * The learn-weights job computes data-driven weights from engagement metrics
 * and writes them to ~/.wlu-learned-weights.json. When that file exists and
 * is fresh (<48h), getTemplateWeights() uses learned weights instead.
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
};

// ---------------------------------------------------------------------------
// Learned weights from engagement data (written by analytics learn-weights)
// ---------------------------------------------------------------------------

const LEARNED_WEIGHTS_FILE = resolve(process.env.HOME ?? '.', '.wlu-learned-weights.json');
const MAX_AGE_MS = 48 * 3600 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface LearnedWeightsFile {
  computedAt: string;
  platforms: Record<string, Array<[string, number]>>;
}

let cachedWeights: LearnedWeightsFile | null | undefined;
let cacheTimestamp = 0;
/** Platforms we have already logged as using learned weights (per process). */
const loggedPlatforms = new Set<string>();

function loadLearnedWeights(): LearnedWeightsFile | null {
  const now = Date.now();
  if (cachedWeights !== undefined && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedWeights;
  }

  try {
    const raw = readFileSync(LEARNED_WEIGHTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as LearnedWeightsFile;
    if (!parsed?.computedAt || !parsed?.platforms) {
      cachedWeights = null;
      cacheTimestamp = now;
      return null;
    }

    const age = now - new Date(parsed.computedAt).getTime();
    if (age > MAX_AGE_MS) {
      cachedWeights = null;
      cacheTimestamp = now;
      return null;
    }

    cachedWeights = parsed;
    cacheTimestamp = now;
    return parsed;
  } catch {
    cachedWeights = null;
    cacheTimestamp = now;
    return null;
  }
}

/**
 * Get template weights for a specific platform.
 * Uses learned weights from engagement data when available,
 * falls back to hardcoded defaults.
 */
export function getTemplateWeights(platform: string): TemplateWeight[] {
  const learned = loadLearnedWeights();
  if (learned?.platforms[platform]) {
    const weights = learned.platforms[platform];
    // Validate structure before using
    if (
      weights.length > 0 &&
      weights.every(([t, w]) => typeof t === 'string' && typeof w === 'number' && w > 0)
    ) {
      if (!loggedPlatforms.has(platform)) {
        console.log(`[template-weights] Using learned weights for ${platform}`);
        loggedPlatforms.add(platform);
      }
      return weights as TemplateWeight[];
    }
  }

  return PLATFORM_WEIGHTS[platform as keyof PlatformWeights] ?? PLATFORM_WEIGHTS.instagram;
}

/**
 * Pick a template using weighted random selection.
 * @param exclude — template names to exclude (e.g. recently used).
 *   Their weight is redistributed proportionally to the remaining templates.
 *   If all templates are excluded, the exclusion list is ignored.
 */
export function pickWeightedTemplate(
  weights: TemplateWeight[],
  exclude?: Set<CompositionId>,
): CompositionId {
  let filtered = weights;
  if (exclude && exclude.size > 0) {
    const remaining = weights.filter(([name]) => !exclude.has(name));
    if (remaining.length > 0) filtered = remaining;
  }

  const total = filtered.reduce((s, [, w]) => s + w, 0);
  const r = Math.random() * total;
  let cumulative = 0;
  for (const [name, weight] of filtered) {
    cumulative += weight;
    if (r < cumulative) return name;
  }
  return filtered[0][0];
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

/**
 * Get the hardcoded default weights for all platforms.
 * Used by the learn-weights job as the baseline for Bayesian smoothing.
 */
export function getDefaultWeights(): Record<string, Array<[string, number]>> {
  return { ...PLATFORM_WEIGHTS };
}
