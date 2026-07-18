import { describe, expect, it } from 'vitest';
import type { Exercise } from '../../domain/types';
import {
  buildLevels,
  getLevel,
  levelLabel,
  LEVEL_COUNT,
  LEVEL_SIZE,
  PASS_THRESHOLD,
  toLevelId,
} from '../levels';

/**
 * Build a synthetic catalog with a given per-difficulty bucket count.
 * `perBucket` defaults to 10 (the valid partition). Exercises are spread
 * across topics so the shape is realistic; only difficulty matters here.
 */
function catalogWith(perBucket: number): Exercise[] {
  const exs: Exercise[] = [];
  for (let d = 1; d <= LEVEL_COUNT; d += 1) {
    for (let i = 0; i < perBucket; i += 1) {
      exs.push({
        id: `ex-d${d}-${i}`,
        topic: 'present-simple',
        prompt: `q ${d}-${i}`,
        acceptedAnswers: [`a-${d}-${i}`],
        difficulty: d,
      });
    }
  }
  return exs;
}

describe('toLevelId', () => {
  it('coerces integers 1-10 to LevelId', () => {
    expect(toLevelId(1)).toBe(1);
    expect(toLevelId(5)).toBe(5);
    expect(toLevelId(10)).toBe(10);
  });

  it('returns null for out-of-range integers', () => {
    expect(toLevelId(0)).toBeNull();
    expect(toLevelId(11)).toBeNull();
    expect(toLevelId(-1)).toBeNull();
  });

  it('returns null for non-integers', () => {
    expect(toLevelId(1.5)).toBeNull();
    expect(toLevelId(9.999)).toBeNull();
  });

  it('returns null for non-number / invalid values', () => {
    expect(toLevelId(undefined)).toBeNull();
    expect(toLevelId(null)).toBeNull();
    expect(toLevelId('3')).toBeNull();
    expect(toLevelId(NaN)).toBeNull();
    expect(toLevelId(Infinity)).toBeNull();
  });
});

describe('buildLevels', () => {
  it('builds exactly 10 levels from a valid 10-per-bucket catalog', () => {
    const levels = buildLevels(catalogWith(LEVEL_SIZE));
    expect(levels).toHaveLength(LEVEL_COUNT);
    levels.forEach((level, i) => {
      expect(level.id).toBe(i + 1);
      expect(level.exercises).toHaveLength(LEVEL_SIZE);
    });
  });

  it('groups exercises by difficulty (Level N contains difficulty-N exercises)', () => {
    const levels = buildLevels(catalogWith(LEVEL_SIZE));
    levels.forEach((level) => {
      for (const ex of level.exercises) {
        expect(ex.difficulty).toBe(level.id);
      }
    });
  });

  it('orders levels from 1 (easiest) to 10 (hardest)', () => {
    const levels = buildLevels(catalogWith(LEVEL_SIZE));
    const ids = levels.map((l) => l.id);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('labels levels "Level 1" through "Level 10"', () => {
    const levels = buildLevels(catalogWith(LEVEL_SIZE));
    levels.forEach((level, i) => {
      expect(level.label).toBe(`Level ${i + 1}`);
    });
  });

  it('preserves catalog order within each bucket', () => {
    const catalog = catalogWith(LEVEL_SIZE);
    const levels = buildLevels(catalog);
    // For each level, the exercises should appear in the same order as in the
    // source catalog (stable groupBy).
    for (const level of levels) {
      const sourceOrder = catalog
        .filter((e) => e.difficulty === level.id)
        .map((e) => e.id);
      expect(level.exercises.map((e) => e.id)).toEqual(sourceOrder);
    }
  });

  it('emits empty buckets for missing difficulties (does not throw)', () => {
    // A catalog with only difficulty-1 exercises: levels 2-10 are empty.
    const single: Exercise[] = Array.from({ length: 5 }, (_, i) => ({
      id: `ex-1-${i}`,
      topic: 'present-simple',
      prompt: `q${i}`,
      acceptedAnswers: [`a${i}`],
      difficulty: 1,
    }));
    const levels = buildLevels(single);
    expect(levels).toHaveLength(LEVEL_COUNT);
    expect(levels[0].exercises).toHaveLength(5);
    for (let i = 1; i < LEVEL_COUNT; i += 1) {
      expect(levels[i].exercises).toHaveLength(0);
    }
  });

  it('skips records with invalid difficulty rather than throwing', () => {
    const mixed: Exercise[] = [
      { id: 'a', topic: 'present-simple', prompt: 'q', acceptedAnswers: ['x'], difficulty: 1 },
      { id: 'b', topic: 'present-simple', prompt: 'q', acceptedAnswers: ['x'], difficulty: 1 },
      { id: 'c', topic: 'present-simple', prompt: 'q', acceptedAnswers: ['x'], difficulty: 99 },
      { id: 'd', topic: 'present-simple', prompt: 'q', acceptedAnswers: ['x'] } as Exercise,
    ];
    const levels = buildLevels(mixed);
    expect(levels[0].exercises).toHaveLength(2); // only a and b
  });

  it('does not mutate the input catalog', () => {
    const catalog = catalogWith(LEVEL_SIZE);
    const snapshot = catalog.map((e) => ({ ...e }));
    buildLevels(catalog);
    expect(catalog).toEqual(snapshot);
  });
});

describe('getLevel', () => {
  it('resolves a level by id', () => {
    const levels = buildLevels(catalogWith(LEVEL_SIZE));
    const lvl7 = getLevel(levels, 7);
    expect(lvl7).toBeDefined();
    expect(lvl7?.id).toBe(7);
  });

  it('returns undefined when the id is not in the list', () => {
    const levels = buildLevels(catalogWith(LEVEL_SIZE)).slice(0, 3);
    expect(getLevel(levels, 7)).toBeUndefined();
  });
});

describe('level constants', () => {
  it('exposes LEVEL_SIZE = 10', () => {
    expect(LEVEL_SIZE).toBe(10);
  });

  it('exposes PASS_THRESHOLD = 9 (90%)', () => {
    expect(PASS_THRESHOLD).toBe(9);
  });

  it('exposes LEVEL_COUNT = 10', () => {
    expect(LEVEL_COUNT).toBe(10);
  });
});

describe('levelLabel', () => {
  it('returns "Level N" for a level id', () => {
    expect(levelLabel(1)).toBe('Level 1');
    expect(levelLabel(5)).toBe('Level 5');
    expect(levelLabel(10)).toBe('Level 10');
  });
});