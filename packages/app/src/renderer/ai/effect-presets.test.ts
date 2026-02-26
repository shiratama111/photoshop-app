/**
 * @module ai/effect-presets.test
 * Tests for the mood × font category → effect preset system.
 *
 * Covers:
 * - All mood × category combinations return valid effects
 * - Specific mood → effect type assertions (glow, stroke, shadow)
 * - Default fallback for unknown moods
 * - Effect objects are properly cloned (no shared references)
 *
 * @see {@link ./effect-presets.ts}
 */

import { describe, it, expect } from 'vitest';
import { getEffectsForMoodAndCategory } from './effect-presets';
import type { FontCategory } from './font-catalog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_CATEGORIES: FontCategory[] = ['serif', 'sans', 'display', 'handwriting', 'monospace'];

function hasEffectType(effects: ReadonlyArray<Record<string, unknown>>, type: string): boolean {
  return effects.some((e) => e.type === type);
}

// ---------------------------------------------------------------------------
// 1. Basic Contract Tests
// ---------------------------------------------------------------------------

describe('getEffectsForMoodAndCategory', () => {
  it('should always return a non-empty array', () => {
    for (const cat of ALL_CATEGORIES) {
      const effects = getEffectsForMoodAndCategory('unknown-mood', cat);
      expect(effects.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should return effects with type and enabled properties', () => {
    const effects = getEffectsForMoodAndCategory('urgent', 'display');
    for (const effect of effects) {
      expect(effect.type).toBeDefined();
      expect(typeof effect.type).toBe('string');
      expect(effect.enabled).toBe(true);
    }
  });

  it('should return cloned objects (no shared references)', () => {
    const effects1 = getEffectsForMoodAndCategory('urgent', 'display');
    const effects2 = getEffectsForMoodAndCategory('urgent', 'display');
    expect(effects1).not.toBe(effects2);
    if (effects1.length > 0 && effects2.length > 0) {
      expect(effects1[0]).not.toBe(effects2[0]);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Urgent/Exciting Mood Tests
// ---------------------------------------------------------------------------

describe('urgent mood effects', () => {
  it('display + urgent → thick stroke + shadow + yellow glow', () => {
    const effects = getEffectsForMoodAndCategory('urgent', 'display');
    expect(hasEffectType(effects, 'stroke')).toBe(true);
    expect(hasEffectType(effects, 'drop-shadow')).toBe(true);
    expect(hasEffectType(effects, 'outer-glow')).toBe(true);
  });

  it('sans + urgent → thick stroke + shadow + yellow glow', () => {
    const effects = getEffectsForMoodAndCategory('urgent', 'sans');
    expect(hasEffectType(effects, 'stroke')).toBe(true);
    expect(hasEffectType(effects, 'outer-glow')).toBe(true);
  });

  it('serif + urgent → thick stroke + shadow (no glow)', () => {
    const effects = getEffectsForMoodAndCategory('urgent', 'serif');
    expect(hasEffectType(effects, 'stroke')).toBe(true);
    expect(hasEffectType(effects, 'drop-shadow')).toBe(true);
  });

  it('exciting mood normalizes to urgent', () => {
    const effects = getEffectsForMoodAndCategory('exciting', 'display');
    expect(hasEffectType(effects, 'outer-glow')).toBe(true);
  });

  it('news mood normalizes to urgent', () => {
    const effects = getEffectsForMoodAndCategory('news', 'display');
    expect(hasEffectType(effects, 'outer-glow')).toBe(true);
  });

  it('速報 mood normalizes to urgent', () => {
    const effects = getEffectsForMoodAndCategory('速報', 'display');
    expect(hasEffectType(effects, 'outer-glow')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Elegant/Luxury Mood Tests
// ---------------------------------------------------------------------------

describe('elegant mood effects', () => {
  it('serif + elegant → thin shadow only', () => {
    const effects = getEffectsForMoodAndCategory('elegant', 'serif');
    expect(effects.length).toBe(1);
    expect(effects[0].type).toBe('drop-shadow');
    // Thin shadow has low opacity
    expect(effects[0].opacity).toBeLessThanOrEqual(0.5);
  });

  it('sans + elegant → thin shadow only', () => {
    const effects = getEffectsForMoodAndCategory('elegant', 'sans');
    expect(effects.length).toBe(1);
    expect(effects[0].type).toBe('drop-shadow');
  });

  it('luxury mood normalizes to elegant', () => {
    const effects = getEffectsForMoodAndCategory('luxury', 'serif');
    expect(effects.length).toBe(1);
    expect(effects[0].type).toBe('drop-shadow');
  });
});

// ---------------------------------------------------------------------------
// 4. Casual/Fun Mood Tests
// ---------------------------------------------------------------------------

describe('casual mood effects', () => {
  it('handwriting + casual → stroke + shadow', () => {
    const effects = getEffectsForMoodAndCategory('casual', 'handwriting');
    expect(hasEffectType(effects, 'stroke')).toBe(true);
    expect(hasEffectType(effects, 'drop-shadow')).toBe(true);
  });

  it('display + casual → stroke + shadow', () => {
    const effects = getEffectsForMoodAndCategory('casual', 'display');
    expect(hasEffectType(effects, 'stroke')).toBe(true);
    expect(hasEffectType(effects, 'drop-shadow')).toBe(true);
  });

  it('fun mood normalizes to casual', () => {
    const effects = getEffectsForMoodAndCategory('fun', 'display');
    expect(hasEffectType(effects, 'stroke')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Informative Mood Tests
// ---------------------------------------------------------------------------

describe('informative mood effects', () => {
  it('sans + informative → stroke + shadow', () => {
    const effects = getEffectsForMoodAndCategory('informative', 'sans');
    expect(hasEffectType(effects, 'stroke')).toBe(true);
    expect(hasEffectType(effects, 'drop-shadow')).toBe(true);
  });

  it('serif + informative → stroke + shadow', () => {
    const effects = getEffectsForMoodAndCategory('informative', 'serif');
    expect(hasEffectType(effects, 'stroke')).toBe(true);
    expect(hasEffectType(effects, 'drop-shadow')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Horror/Dark Mood Tests
// ---------------------------------------------------------------------------

describe('horror mood effects', () => {
  it('display + horror → red glow + dark shadow', () => {
    const effects = getEffectsForMoodAndCategory('horror', 'display');
    expect(hasEffectType(effects, 'outer-glow')).toBe(true);
    expect(hasEffectType(effects, 'drop-shadow')).toBe(true);
    // Glow should be red
    const glow = effects.find((e) => e.type === 'outer-glow');
    const color = glow?.color as { r: number; g: number; b: number } | undefined;
    expect(color?.r).toBeGreaterThan(100);
    expect(color?.g).toBe(0);
    expect(color?.b).toBe(0);
  });

  it('dark mood normalizes to horror', () => {
    const effects = getEffectsForMoodAndCategory('dark', 'display');
    expect(hasEffectType(effects, 'outer-glow')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Default Fallback Tests
// ---------------------------------------------------------------------------

describe('default effects fallback', () => {
  it('unknown mood → black stroke + drop shadow', () => {
    const effects = getEffectsForMoodAndCategory('completely-unknown-mood', 'monospace');
    expect(effects.length).toBe(2);
    expect(hasEffectType(effects, 'stroke')).toBe(true);
    expect(hasEffectType(effects, 'drop-shadow')).toBe(true);
  });

  it('empty mood → default effects', () => {
    const effects = getEffectsForMoodAndCategory('', 'sans');
    expect(effects.length).toBe(2);
  });
});
