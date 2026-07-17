import type { Exercise, Topic } from './types';
import { APPROVED_TOPICS, TOPICS } from '../content/topics';

/**
 * Expected catalog size (exercise-bank spec: "exactly 100 exercise records").
 */
export const EXPECTED_CATALOG_SIZE = 100;

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
    | 'distribution';
  message: string;
  /** 1-based index of the offending record when applicable. */
  index?: number;
  /** Topic involved in a distribution issue. */
  topic?: Topic;
}

export interface CatalogValidationResult {
  valid: boolean;
  issues: CatalogIssue[];
  /** Count of exercises per approved topic (0 when a topic is absent). */
  counts: Record<Topic, number>;
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
 *      exactly 100 (`distribution`).
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

  return {
    valid: issues.length === 0,
    issues,
    counts,
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