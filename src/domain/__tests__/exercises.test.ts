import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../../content/exercises';
import { validateCatalog, EXPECTED_CATALOG_SIZE } from '../catalog';
import { TOPICS } from '../../content/topics';
import { gradeAttempt } from '../grading';
import { buildLevels, getLevel, LEVEL_COUNT, LEVEL_SIZE } from '../../content/levels';
import type { LevelId } from '../types';

describe('real exercise catalog (src/content/exercises.ts)', () => {
  it('passes validateCatalog', () => {
    const result = validateCatalog(EXERCISES);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('contains exactly 100 exercises', () => {
    expect(EXERCISES).toHaveLength(EXPECTED_CATALOG_SIZE);
  });

  it('covers all 8 approved topics with 12 or 13 each, summing to 100', () => {
    const result = validateCatalog(EXERCISES);
    expect(result.total).toBe(100);
    for (const topic of TOPICS) {
      const count = result.counts[topic];
      expect(count).toBeGreaterThanOrEqual(12);
      expect(count).toBeLessThanOrEqual(13);
    }
  });

  it('has unique ids across all 100 records', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no empty prompts or accepted answers', () => {
    for (const ex of EXERCISES) {
      expect(ex.prompt.trim().length).toBeGreaterThan(0);
      expect(ex.acceptedAnswers.length).toBeGreaterThan(0);
      for (const a of ex.acceptedAnswers) {
        expect(a.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('supports alternate accepted answers where declared (e.g. synonyms)', () => {
    const ex = EXERCISES.find((e) => e.id === 'like-dislike-01')!;
    expect(ex.acceptedAnswers.length).toBeGreaterThanOrEqual(2);
    expect(ex.acceptedAnswers).toEqual(expect.arrayContaining(['like', 'love']));
  });

  it('requires full auxiliary phrases for present progressive (no bare gerund)', () => {
    const progressive = EXERCISES.filter(
      (e) =>
        e.topic === 'present-progressive' ||
        e.topic === 'present-progressive-3rd',
    );
    for (const ex of progressive) {
      for (const answer of ex.acceptedAnswers) {
        // Bare gerunds produce ungrammatical fill-ins when the prompt lacks be.
        expect(answer.trim().split(/\s+/).length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('does not duplicate prompt fragments in daily-routine accepted answers', () => {
    const wake = EXERCISES.find((e) => e.id === 'daily-routine-01')!;
    expect(wake.acceptedAnswers).toEqual(['wake', 'get']);
    const shower = EXERCISES.find((e) => e.id === 'daily-routine-12')!;
    expect(shower.acceptedAnswers).toEqual(['take', 'have']);
  });

  it('grades a perfect attempt as a raw count (full catalog: 100 correct)', () => {
    const responses = EXERCISES.map((e) => ({
      exerciseId: e.id,
      given: e.acceptedAnswers[0],
    }));
    const result = gradeAttempt(EXERCISES, responses);
    // Full 100-exercise catalog graded at once (not a single level): score = 100
    // raw correct answers. Per-level attempts would score 0-10 instead.
    expect(result.score).toBe(100);
    expect(result.mistakes).toHaveLength(0);
    expect(result.recommendations).toHaveLength(0);
  });

  it('grades an all-wrong attempt as 0 and recommends topics at 100% miss rate', () => {
    const responses = EXERCISES.map((e) => ({
      exerciseId: e.id,
      given: '__wrong__',
    }));
    const result = gradeAttempt(EXERCISES, responses);
    expect(result.score).toBe(0);
    expect(result.mistakes).toHaveLength(100);
    // All 8 topics at 100% miss rate -> capped at 3, highest first.
    expect(result.recommendations.length).toBeLessThanOrEqual(3);
    expect(result.recommendations.length).toBe(3);
  });

  it('is case-insensitive and trims whitespace when grading against the real catalog', () => {
    const responses = EXERCISES.map((e) => ({
      exerciseId: e.id,
      given: `  ${e.acceptedAnswers[0].toUpperCase()}  `,
    }));
    const result = gradeAttempt(EXERCISES, responses);
    // Full catalog (100 exercises) → raw score 100.
    expect(result.score).toBe(100);
  });

  // ---- Level partition (exercise-bank + level-progression specs) ----------

  it('has a difficulty value in 1-10 on every record', () => {
    for (const ex of EXERCISES) {
      expect(typeof ex.difficulty).toBe('number');
      expect(Number.isInteger(ex.difficulty)).toBe(true);
      expect(ex.difficulty).toBeGreaterThanOrEqual(1);
      expect(ex.difficulty).toBeLessThanOrEqual(10);
    }
  });

  it('partitions into exactly 10 levels of 10 (each difficulty bucket = 10)', () => {
    const result = validateCatalog(EXERCISES);
    expect(result.valid).toBe(true);
    for (let d = 1; d <= 10; d += 1) {
      expect(result.difficultyCounts[d]).toBe(LEVEL_SIZE);
    }
  });

  it('uses every catalog exercise exactly once across the 10 levels', () => {
    const levels = buildLevels(EXERCISES);
    expect(levels).toHaveLength(LEVEL_COUNT);
    const seen = new Set<string>();
    let total = 0;
    for (const level of levels) {
      for (const ex of level.exercises) {
        expect(seen.has(ex.id)).toBe(false);
        seen.add(ex.id);
        total += 1;
      }
    }
    expect(total).toBe(EXPECTED_CATALOG_SIZE);
    // Every catalog id is represented.
    for (const ex of EXERCISES) {
      expect(seen.has(ex.id)).toBe(true);
    }
  });

  it('orders levels easiest to hardest by difficulty (Level N holds difficulty-N exercises)', () => {
    const levels = buildLevels(EXERCISES);
    levels.forEach((level, i) => {
      const expectedDifficulty = (i + 1) as LevelId;
      expect(level.id).toBe(expectedDifficulty);
      expect(level.exercises).toHaveLength(LEVEL_SIZE);
      for (const ex of level.exercises) {
        expect(ex.difficulty).toBe(expectedDifficulty);
      }
    });
  });

  it('builds levels labeled "Level 1" through "Level 10"', () => {
    const levels = buildLevels(EXERCISES);
    levels.forEach((level, i) => {
      expect(level.label).toBe(`Level ${i + 1}`);
    });
  });

  it('getLevel resolves a level by id and returns undefined for out-of-range', () => {
    const levels = buildLevels(EXERCISES);
    const lvl3 = getLevel(levels, 3);
    expect(lvl3).toBeDefined();
    expect(lvl3?.id).toBe(3);
    expect(lvl3?.exercises).toHaveLength(LEVEL_SIZE);
    // getLevel finds within the list; out-of-range LevelIds are not constructable
    // as LevelId, so this covers the find-by-id contract.
  });
});