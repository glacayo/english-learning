import type { Exercise, Topic } from './types';
import { APPROVED_TOPICS, TOPICS } from '../content/topics';
import { LEVEL_COUNT } from '../content/levels';

/**
 * Expected catalog size (exercise-bank spec: "exactly 100 exercise records").
 */
export const EXPECTED_CATALOG_SIZE = 100;

/**
 * Expected number of exercises per level (exercise-bank + level-progression
 * specs: "exactly 10 levels of 10 exercises each"). The catalog validator
 * enforces that each `difficulty` bucket 1–10 has exactly this many records.
 */
export const EXPECTED_LEVEL_SIZE = 10;

/**
 * Valid `difficulty` range (exercise-bank spec: "a `difficulty` value in the
 * range 1-10"). `difficulty === levelId`, so 1 maps to Level 1 and 10 to
 * Level 10.
 */
export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 10;

/**
 * Per-topic distribution bounds. The spec requires each approved topic to have
 * either 12 or 13 exercises, with the eight counts summing to exactly 100
 * (four topics with 13 and four with 12, in any assignment).
 */
export const MIN_PER_TOPIC = 12;
export const MAX_PER_TOPIC = 13;

export interface CatalogIssue {
  code:
    | 'count'
    | 'unknown-topic'
    | 'duplicate-id'
    | 'empty-prompt'
    | 'empty-accepted-answers'
    | 'distribution'
    | 'difficulty-missing'
    | 'difficulty-out-of-range'
    | 'level-partition';
  message: string;
  /** 1-based index of the offending record when applicable. */
  index?: number;
  /** Topic involved in a distribution issue. */
  topic?: Topic;
  /** Difficulty value involved in a level-partition issue. */
  difficulty?: number;
}

export interface CatalogValidationResult {
  valid: boolean;
  issues: CatalogIssue[];
  /** Count of exercises per approved topic (0 when a topic is absent). */
  counts: Record<Topic, number>;
  /** Count of exercises per difficulty bucket 1–10 (0 when a bucket is empty). */
  difficultyCounts: Record<number, number>;
  total: number;
}

/**
 * Validate the fixed exercise catalog against the exercise-bank spec.
 *
 * Enforces, in order:
 *   1. Exactly 100 records (`count`).
 *   2. Every record's topic is one of the 8 approved topics (`unknown-topic`).
 *   3. Every `id` is unique (`duplicate-id`).
 *   4. Every `prompt` is non-empty after trim (`empty-prompt`).
 *   5. Every `acceptedAnswers` is a non-empty list of non-empty strings
 *      (`empty-accepted-answers`).
 *   6. Each approved topic has 12 or 13 exercises and the eight counts sum to
 *      exactly 100 (`distribution`). This flat-catalog rule applies to the full
 *      100-record catalog only, not to per-level topic distribution.
 *   7. Every record has a `difficulty` that is an integer in 1–10
 *      (`difficulty-missing`, `difficulty-out-of-range`). `difficulty === levelId`.
 *   8. The `difficulty` values partition the catalog into exactly 10 levels of
 *      10 (`level-partition`): each bucket 1–10 MUST contain exactly
 *      `EXPECTED_LEVEL_SIZE` exercises. This is the level-progression partition
 *      rule; it is independent of the flat topic-distribution rule above.
 *
 * `validateCatalog` is a pure function: it performs no I/O and mutates nothing.
 * It is safe to call from unit tests and from a build-time guard.
 */
export function validateCatalog(
  exercises: readonly Exercise[],
): CatalogValidationResult {
  const issues: CatalogIssue[] = [];

  const counts = TOPICS.reduce(
    (acc, topic) => {
      acc[topic] = 0;
      return acc;
    },
    {} as Record<Topic, number>,
  );

  const difficultyCounts: Record<number, number> = {};
  for (let d = MIN_DIFFICULTY; d <= MAX_DIFFICULTY; d += 1) {
    difficultyCounts[d] = 0;
  }

  if (exercises.length !== EXPECTED_CATALOG_SIZE) {
    issues.push({
      code: 'count',
      message: `Catalog must contain exactly ${EXPECTED_CATALOG_SIZE} exercises, but found ${exercises.length}.`,
    });
  }

  const seenIds = new Map<string, number>();

  exercises.forEach((exercise, i) => {
    const index = i + 1;

    if (!APPROVED_TOPICS.has(exercise.topic)) {
      issues.push({
        code: 'unknown-topic',
        message: `Exercise #${index} (id="${exercise.id}") has topic "${exercise.topic}" which is not one of the 8 approved topics.`,
        index,
      });
    } else {
      counts[exercise.topic] += 1;
    }

    const existingIndex = seenIds.get(exercise.id);
    if (existingIndex !== undefined) {
      issues.push({
        code: 'duplicate-id',
        message: `Exercise #${index} reuses id "${exercise.id}" first seen at #${existingIndex}.`,
        index,
      });
    } else {
      seenIds.set(exercise.id, index);
    }

    if (exercise.prompt.trim().length === 0) {
      issues.push({
        code: 'empty-prompt',
        message: `Exercise #${index} (id="${exercise.id}") has an empty prompt.`,
        index,
      });
    }

    if (!Array.isArray(exercise.acceptedAnswers) || exercise.acceptedAnswers.length === 0) {
      issues.push({
        code: 'empty-accepted-answers',
        message: `Exercise #${index} (id="${exercise.id}") has no accepted answers.`,
        index,
      });
    } else {
      const allNonEmpty = exercise.acceptedAnswers.every(
        (answer) => typeof answer === 'string' && answer.trim().length > 0,
      );
      if (!allNonEmpty) {
        issues.push({
          code: 'empty-accepted-answers',
          message: `Exercise #${index} (id="${exercise.id}") has an empty or whitespace-only accepted answer.`,
          index,
        });
      }
    }

    // Difficulty: must be present and an integer in 1–10 (difficulty === levelId).
    if (
      exercise.difficulty === undefined ||
      exercise.difficulty === null ||
      typeof exercise.difficulty !== 'number' ||
      Number.isNaN(exercise.difficulty)
    ) {
      issues.push({
        code: 'difficulty-missing',
        message: `Exercise #${index} (id="${exercise.id}") is missing a numeric difficulty.`,
        index,
      });
    } else if (
      !Number.isFinite(exercise.difficulty) ||
      !Number.isInteger(exercise.difficulty) ||
      exercise.difficulty < MIN_DIFFICULTY ||
      exercise.difficulty > MAX_DIFFICULTY
    ) {
      issues.push({
        code: 'difficulty-out-of-range',
        message: `Exercise #${index} (id="${exercise.id}") has difficulty ${exercise.difficulty}, which must be an integer in ${MIN_DIFFICULTY}-${MAX_DIFFICULTY}.`,
        index,
      });
    } else {
      difficultyCounts[exercise.difficulty] += 1;
    }
  });

  const total = TOPICS.reduce((sum, topic) => sum + counts[topic], 0);
  const outOfRange = TOPICS.filter(
    (topic) => counts[topic] < MIN_PER_TOPIC || counts[topic] > MAX_PER_TOPIC,
  );
  if (outOfRange.length > 0) {
    for (const topic of outOfRange) {
      issues.push({
        code: 'distribution',
        message: `Topic "${topic}" has ${counts[topic]} exercises; must be ${MIN_PER_TOPIC} or ${MAX_PER_TOPIC}.`,
        topic,
      });
    }
  }

  // Even when every topic is individually within range, the eight counts must
  // sum to exactly 100 (four topics with 13 and four with 12).
  if (outOfRange.length === 0 && total !== EXPECTED_CATALOG_SIZE) {
    issues.push({
      code: 'distribution',
      message: `Per-topic counts are within range but sum to ${total}, expected ${EXPECTED_CATALOG_SIZE}.`,
    });
  }

  // Level partition: each difficulty bucket 1–10 MUST contain exactly
  // EXPECTED_LEVEL_SIZE (10) exercises. This is the level-progression partition
  // rule and is independent of the flat topic-distribution rule above.
  for (let d = MIN_DIFFICULTY; d <= MAX_DIFFICULTY; d += 1) {
    const count = difficultyCounts[d];
    if (count !== EXPECTED_LEVEL_SIZE) {
      issues.push({
        code: 'level-partition',
        message: `Difficulty ${d} has ${count} exercises; each level 1-${LEVEL_COUNT} must contain exactly ${EXPECTED_LEVEL_SIZE}.`,
        difficulty: d,
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    counts,
    difficultyCounts,
    total,
  };
}

/**
 * Throw on an invalid catalog. Intended as a build-time / test-time guard so
 * a malformed catalog fails loudly instead of shipping silently.
 */
export function assertValidCatalog(exercises: readonly Exercise[]): void {
  const result = validateCatalog(exercises);
  if (!result.valid) {
    const bulletList = result.issues.map((i) => `  - ${i.message}`).join('\n');
    throw new Error(
      `Invalid exercise catalog (${result.issues.length} issue(s)):\n${bulletList}`,
    );
  }
}