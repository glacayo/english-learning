import type { Topic } from '../domain/types';

/**
 * Approved topic enum and human-readable labels.
 *
 * The 8 approved topics are the single source of truth for topic identity
 * across the catalog, grading, recommendations, and the UI. The `Topic` type
 * is defined in `src/domain/types.ts` and re-exported here for convenience.
 *
 * See `exercise-bank` spec: exactly these 8 topics MUST be represented, no
 * unapproved topics are allowed, and the 100-exercise catalog MUST distribute
 * 12 or 13 exercises per topic (four topics with 13 and four with 12).
 */
export const TOPICS = [
  'present-simple',
  'simple-past',
  'present-progressive',
  'simple-past-3rd',
  'present-simple-3rd',
  'present-progressive-3rd',
  'daily-routine',
  'like-dislike',
] as const satisfies readonly Topic[];

export const APPROVED_TOPICS: ReadonlySet<Topic> = new Set(TOPICS);

export const TOPIC_LABELS: Record<Topic, string> = {
  'present-simple': 'Present Simple',
  'simple-past': 'Simple Past',
  'present-progressive': 'Present Progressive',
  'simple-past-3rd': 'Simple Past (3rd person)',
  'present-simple-3rd': 'Present Simple (3rd person)',
  'present-progressive-3rd': 'Present Progressive (3rd person)',
  'daily-routine': 'Daily Routine',
  'like-dislike': "Like / Don't Like",
};

export function isTopic(value: unknown): value is Topic {
  return typeof value === 'string' && APPROVED_TOPICS.has(value as Topic);
}

export function labelTopic(topic: Topic): string {
  return TOPIC_LABELS[topic] ?? topic;
}

export type { Topic };