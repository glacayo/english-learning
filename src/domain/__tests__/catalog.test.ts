import { describe, expect, it } from 'vitest';
import type { Exercise, Topic } from '../types';
import {
  assertValidCatalog,
  EXPECTED_CATALOG_SIZE,
  MAX_PER_TOPIC,
  MIN_PER_TOPIC,
  validateCatalog,
} from '../catalog';
import { TOPICS } from '../../content/topics';

/**
 * Builds a syntactically valid 100-exercise catalog with a balanced
 * distribution (four topics with 13, four with 12). Each exercise has a unique
 * id, an approved topic, a non-empty prompt, and one accepted answer.
 */
function validCatalog(): Exercise[] {
  const exercises: Exercise[] = [];
  let n = 0;
  // Four topics get 13, the rest get 12 -> 4*13 + 4*12 = 52 + 48 = 100.
  const counts: Record<Topic, number> = {
    'present-simple': 13,
    'simple-past': 13,
    'present-progressive': 13,
    'simple-past-3rd': 13,
    'present-simple-3rd': 12,
    'present-progressive-3rd': 12,
    'daily-routine': 12,
    'like-dislike': 12,
  };
  for (const topic of TOPICS) {
    for (let i = 0; i < counts[topic]; i++) {
      n += 1;
      exercises.push({
        id: `ex-${n.toString().padStart(3, '0')}`,
        topic,
        prompt: `Prompt ${n}`,
        acceptedAnswers: [`answer-${n}`],
      });
    }
  }
  return exercises;
}

describe('validateCatalog', () => {
  it('accepts a balanced 100-exercise catalog across the 8 approved topics', () => {
    const result = validateCatalog(validCatalog());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.total).toBe(EXPECTED_CATALOG_SIZE);
    for (const topic of TOPICS) {
      expect(result.counts[topic]).toBeGreaterThanOrEqual(MIN_PER_TOPIC);
      expect(result.counts[topic]).toBeLessThanOrEqual(MAX_PER_TOPIC);
    }
  });

  it('rejects a catalog that does not total exactly 100 records', () => {
    const catalog = validCatalog().slice(0, 99);
    const result = validateCatalog(catalog);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'count')).toBe(true);
  });

  it('rejects an unknown topic', () => {
    const catalog = validCatalog();
    catalog[0] = { ...catalog[0], topic: 'future-perfect' as Topic };
    const result = validateCatalog(catalog);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'unknown-topic')).toBe(true);
  });

  it('rejects duplicate ids', () => {
    const catalog = validCatalog();
    catalog[1] = { ...catalog[1], id: catalog[0].id };
    const result = validateCatalog(catalog);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'duplicate-id')).toBe(true);
  });

  it('rejects an empty prompt', () => {
    const catalog = validCatalog();
    catalog[2] = { ...catalog[2], prompt: '   ' };
    const result = validateCatalog(catalog);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'empty-prompt')).toBe(true);
  });

  it('rejects an empty acceptedAnswers list', () => {
    const catalog = validCatalog();
    catalog[3] = { ...catalog[3], acceptedAnswers: [] };
    const result = validateCatalog(catalog);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((i) => i.code === 'empty-accepted-answers'),
    ).toBe(true);
  });

  it('rejects a whitespace-only accepted answer', () => {
    const catalog = validCatalog();
    catalog[4] = { ...catalog[4], acceptedAnswers: ['  '] };
    const result = validateCatalog(catalog);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((i) => i.code === 'empty-accepted-answers'),
    ).toBe(true);
  });

  it('rejects an unbalanced distribution (one topic with 11)', () => {
    const catalog = validCatalog();
    // Move two exercises out of the first topic into another topic so one ends
    // up below the minimum and another exceeds the maximum.
    const firstTopic = catalog[0].topic;
    const moved = catalog.filter((e) => e.topic === firstTopic).slice(0, 2);
    const targetTopic = TOPICS.find((t) => t !== firstTopic)!;
    for (const ex of moved) ex.topic = targetTopic;
    const result = validateCatalog(catalog);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'distribution')).toBe(true);
  });

  it('assertValidCatalog throws on an invalid catalog', () => {
    expect(() => assertValidCatalog(validCatalog().slice(0, 10))).toThrow();
  });

  it('assertValidCatalog does not throw on a valid catalog', () => {
    expect(() => assertValidCatalog(validCatalog())).not.toThrow();
  });
});