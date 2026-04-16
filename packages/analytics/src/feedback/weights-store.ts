import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WEIGHTS_FILE = resolve(process.env.HOME ?? '.', '.wlu-learned-weights.json');

export interface LearnedWeightsFile {
  /** ISO timestamp of when weights were computed. */
  computedAt: string;
  /** Per-platform template weights. */
  platforms: Record<string, Array<[string, number]>>;
  /** How many posts with metrics were used per platform per template. */
  sampleCounts: Record<string, Record<string, number>>;
}

/** Staleness threshold — reject weights older than 48h. */
const MAX_AGE_MS = 48 * 3600 * 1000;

/** Write learned weights to disk. */
export function saveLearnedWeights(weights: LearnedWeightsFile): void {
  writeFileSync(WEIGHTS_FILE, JSON.stringify(weights, null, 2) + '\n');
  console.log(`[weights] Saved learned weights to ${WEIGHTS_FILE}`);
}

/**
 * Read learned weights from disk (synchronous).
 * Returns null if file is missing, corrupt, or stale (>48h).
 */
export function loadLearnedWeights(): LearnedWeightsFile | null {
  try {
    const raw = readFileSync(WEIGHTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as LearnedWeightsFile;
    if (!parsed?.computedAt || !parsed?.platforms) return null;

    const age = Date.now() - new Date(parsed.computedAt).getTime();
    if (age > MAX_AGE_MS) {
      console.warn('[weights] Learned weights are stale (>48h), using defaults');
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
