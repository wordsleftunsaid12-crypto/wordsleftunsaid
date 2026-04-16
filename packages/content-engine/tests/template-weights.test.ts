import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getTemplateWeights,
  getDefaultWeights,
  pickWeightedTemplate,
  getAllTemplates,
} from '../src/pipeline/template-weights.js';

// Mock fs so tests always use hardcoded defaults (no learned weights file)
vi.mock('node:fs', () => ({
  readFileSync: () => { throw new Error('ENOENT'); },
}));

describe('getTemplateWeights', () => {
  it('returns weights for all known platforms', () => {
    const platforms = ['instagram', 'tiktok', 'youtube', 'reddit', 'pinterest', 'twitter'];
    for (const platform of platforms) {
      const weights = getTemplateWeights(platform);
      expect(weights.length).toBeGreaterThan(0);
    }
  });

  it('falls back to instagram weights for unknown platform', () => {
    const unknown = getTemplateWeights('mastodon');
    const instagram = getTemplateWeights('instagram');
    expect(unknown).toEqual(instagram);
  });

  it('weights sum to approximately 1.0 for each platform', () => {
    const platforms = ['instagram', 'tiktok', 'youtube', 'reddit', 'pinterest', 'twitter'];
    for (const platform of platforms) {
      const weights = getTemplateWeights(platform);
      const sum = weights.reduce((acc, [, w]) => acc + w, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });

  it('only uses templates from getAllTemplates', () => {
    const allTemplates = getAllTemplates();
    const platforms = ['instagram', 'tiktok', 'youtube', 'reddit', 'pinterest', 'twitter'];
    for (const platform of platforms) {
      const weights = getTemplateWeights(platform);
      const templateIds = weights.map(([id]) => id);
      for (const tmpl of templateIds) {
        expect(allTemplates).toContain(tmpl);
      }
    }
  });

  it('all weights are positive numbers', () => {
    const platforms = ['instagram', 'tiktok', 'youtube', 'reddit', 'pinterest', 'twitter'];
    for (const platform of platforms) {
      const weights = getTemplateWeights(platform);
      for (const [name, weight] of weights) {
        expect(weight).toBeGreaterThan(0);
        expect(typeof weight).toBe('number');
      }
    }
  });
});

describe('getDefaultWeights', () => {
  it('returns weights for all 6 platforms', () => {
    const defaults = getDefaultWeights();
    const platforms = ['instagram', 'tiktok', 'youtube', 'reddit', 'pinterest', 'twitter'];
    for (const platform of platforms) {
      expect(defaults[platform]).toBeDefined();
      expect(defaults[platform].length).toBeGreaterThan(0);
    }
  });
});

describe('pickWeightedTemplate', () => {
  it('returns a valid template from the weights', () => {
    const weights = getTemplateWeights('instagram');
    const picked = pickWeightedTemplate(weights);
    const validIds = weights.map(([id]) => id);
    expect(validIds).toContain(picked);
  });

  it('returns first template when random is 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const weights = getTemplateWeights('instagram');
    const picked = pickWeightedTemplate(weights);
    expect(picked).toBe(weights[0][0]);
    vi.restoreAllMocks();
  });

  it('returns last template when random is close to 1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const weights = getTemplateWeights('instagram');
    const picked = pickWeightedTemplate(weights);
    const lastTemplate = weights[weights.length - 1][0];
    expect(picked).toBe(lastTemplate);
    vi.restoreAllMocks();
  });

  it('respects weight distribution', () => {
    const weights: [string, number][] = [
      ['TemplateA', 0.9],
      ['TemplateB', 0.1],
    ];

    // random = 0.5 should pick A (cumulative 0.9)
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(pickWeightedTemplate(weights as any)).toBe('TemplateA');

    // random = 0.95 should pick B (cumulative 1.0)
    vi.spyOn(Math, 'random').mockReturnValue(0.95);
    expect(pickWeightedTemplate(weights as any)).toBe('TemplateB');

    vi.restoreAllMocks();
  });
});

describe('getAllTemplates', () => {
  it('returns all 7 active template IDs', () => {
    const templates = getAllTemplates();
    expect(templates.length).toBe(7);
  });

  it('includes active templates', () => {
    const templates = getAllTemplates();
    expect(templates).toContain('CinematicVertical');
    expect(templates).toContain('TextOnGradientVertical');
    expect(templates).toContain('DeletedTextVertical');
    expect(templates).toContain('QuoteCardVertical');
    expect(templates).toContain('SplitScreenVertical');
    expect(templates).toContain('HandwritingSVGVertical');
    expect(templates).toContain('RawTextVertical');
  });
});
