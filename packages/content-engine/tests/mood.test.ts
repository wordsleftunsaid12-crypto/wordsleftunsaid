import { describe, it, expect, vi } from 'vitest';
import { detectMood } from '../src/pipeline/mood.js';

// Suppress console.log from detectMood
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('detectMood', () => {
  it('detects tender mood from love-related content', () => {
    expect(detectMood('I love you more than words can say', 'Me', 'Mom')).toBe('tender');
  });

  it('detects tender mood from family-related "to" field', () => {
    expect(detectMood('I miss you every single day', 'Your child', 'Mom')).toBe('tender');
  });

  it('detects regretful mood from apology content', () => {
    expect(detectMood("I'm sorry for everything. I should have told you sooner. Forgive me.", 'Me', 'You')).toBe('regretful');
  });

  it('detects regretful mood from "too late" content', () => {
    expect(detectMood("It's too late now. I wish I hadn't been such a coward.", 'Me', 'You')).toBe('regretful');
  });

  it('detects hopeful mood from encouraging content', () => {
    expect(detectMood("One day you'll realize how strong you are. Keep going. I believe in you.", 'Me', 'You')).toBe('hopeful');
  });

  it('detects hopeful mood from survival-themed content', () => {
    expect(detectMood("You survived everything that tried to break you. Brighter days ahead.", 'Me', 'Future self')).toBe('hopeful');
  });

  it('detects bittersweet mood from nostalgic content', () => {
    expect(detectMood("Remember when we used to sit by the lake? Those days feel so far away now.", 'Me', 'You')).toBe('bittersweet');
  });

  it('detects bittersweet mood from memory content', () => {
    expect(detectMood("I still think about the way things used to be. Time changes everything.", 'Me', 'Old friend')).toBe('bittersweet');
  });

  it('detects raw mood from angry content', () => {
    expect(detectMood("You left me broken and alone. How could you ghost me like that?", 'Me', 'You')).toBe('raw');
  });

  it('detects raw mood from betrayal content', () => {
    expect(detectMood("You lied. You destroyed everything. I hate what you did.", 'Me', 'Ex')).toBe('raw');
  });

  it('defaults to bittersweet for ambiguous content', () => {
    // Very short, no strong signals
    expect(detectMood('Hello there.', 'Me', 'You')).toBe('bittersweet');
  });

  it('defaults to bittersweet for empty content', () => {
    expect(detectMood('', '', '')).toBe('bittersweet');
  });

  it('is case insensitive', () => {
    expect(detectMood("I LOVE YOU SO MUCH", 'Me', 'You')).toBe('tender');
    expect(detectMood("I'M SORRY FOR EVERYTHING", 'Me', 'You')).toBe('regretful');
  });

  it('considers "from" and "to" fields in mood scoring', () => {
    // "Mom" in "to" field triggers tender keywords
    const withMom = detectMood('Thank you for everything', 'Me', 'Mom');
    expect(withMom).toBe('tender');
  });

  it('handles content with multiple mood signals by picking strongest', () => {
    // Strong raw signals should win even with mild tender signals
    const mixed = detectMood("I loved you but you destroyed me. You ghosted me and I hate you for it.", 'Me', 'You');
    expect(mixed).toBe('raw');
  });
});
