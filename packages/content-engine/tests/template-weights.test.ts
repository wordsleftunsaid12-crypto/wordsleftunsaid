import { describe, it, expect, vi } from 'vitest';
import {
  getTemplateWeights,
  pickWeightedTemplate,
  getAllTemplates,
} from '../src/pipeline/template-weights.js';

describe('getTemplateWeights', () => {
  it('returns weights for all known platforms', () => {
    const platforms = ['instagram', 'tiktok', 'youtube', 'reddit', 'pinterest', 'twitter', 'threads'];
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
    const platforms = ['instagram', 'tiktok', 'youtube', 'reddit', 'pinterest', 'twitter', 'threads'];
    for (const platform of platforms) {
      const weights = getTemplateWeights(platform);
      const sum = weights.reduce((acc, [, w]) => acc + w, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });

  it('includes all templates from getAllTemplates in every platform', () => {
    const allTemplates = getAllTemplates();
    const platforms = ['instagram', 'tiktok', 'youtube', 'reddit', 'pinterest', 'twitter', 'threads'];
    for (const platform of platforms) {
      const weights = getTemplateWeights(platform);
      const templateIds = weights.map(([id]) => id);
      for (const tmpl of allTemplates) {
        expect(templateIds).toContain(tmpl);
      }
    }
  });

  it('all weights are positive numbers', () => {
    const platforms = ['instagram', 'tiktok', 'youtube', 'reddit', 'pinterest', 'twitter', 'threads'];
    for (const platform of platforms) {
      const weights = getTemplateWeights(platform);
      for (const [name, weight] of weights) {
        expect(weight).toBeGreaterThan(0);
        expect(typeof weight).toBe('number');
      }
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
  it('returns all 8 template IDs', () => {
    const templates = getAllTemplates();
    expect(templates.length).toBe(8);
  });

  it('includes core templates', () => {
    const templates = getAllTemplates();
    expect(templates).toContain('CinematicVertical');
    expect(templates).toContain('POVVertical');
    expect(templates).toContain('TextOnGradientVertical');
    expect(templates).toContain('TypewriterVertical');
    expect(templates).toContain('HandwrittenVertical');
    expect(templates).toContain('VoiceNarrationVertical');
    expect(templates).toContain('ClassicVertical');
    expect(templates).toContain('ModernVertical');
  });
});
