import type { Answer, Topic } from './types';
import { TOPICS } from '../content/topics';

/**
 * Minimum miss rate for a topic to be recommended (scoring-feedback spec:
 * "40% or higher"). Expressed as a fraction 0–1.
 */
export const RECOMMENDATION_THRESHOLD = 0.4;

/**
 * Maximum number of recommended topics (scoring-feedback spec: "up to 3").
 */
export const MAX_RECOMMENDATIONS = 3;

export interface TopicStats {
  topic: Topic;
  total: number;
  missed: number;
  /** Miss rate as a fraction 0–1; 0 when the topic has no answers. */
  missRate: number;
}

/**
 * Compute per-topic miss stats from a list of graded answers.
 *
 * Only answers are required — not the full catalog — so this works whether the
 * attempt covered all 100 exercises or a subset. Topics with zero answers get
 * `missRate: 0` (they are never recommended).
 *
 * Pure function: no I/O, no mutation.
 */
export function computeTopicStats(answers: readonly Answer[]): TopicStats[] {
  const totals = new Map<Topic, number>();
  const missed = new Map<Topic, number>();

  for (const answer of answers) {
    totals.set(answer.topic, (totals.get(answer.topic) ?? 0) + 1);
    if (!answer.correct) {
      missed.set(answer.topic, (missed.get(answer.topic) ?? 0) + 1);
    }
  }

  return TOPICS.map((topic) => {
    const total = totals.get(topic) ?? 0;
    const missCount = missed.get(topic) ?? 0;
    const missRate = total === 0 ? 0 : missCount / total;
    return { topic, total, missed: missCount, missRate };
  });
}

/**
 * Recommend up to 3 topics with a miss rate >= 40%, ordered from highest miss
 * rate to lowest (scoring-feedback spec).
 *
 * Tie-break between topics with identical miss rates is by topic name ascending
 * so the result is deterministic regardless of object key order.
 *
 * Pure function: no I/O, no mutation.
 */
export function recommendTopics(answers: readonly Answer[]): Topic[] {
  const stats = computeTopicStats(answers);
  return stats
    .filter((s) => s.total > 0 && s.missRate >= RECOMMENDATION_THRESHOLD)
    .sort((a, b) => {
      if (b.missRate !== a.missRate) return b.missRate - a.missRate;
      return a.topic < b.topic ? -1 : a.topic > b.topic ? 1 : 0;
    })
    .slice(0, MAX_RECOMMENDATIONS)
    .map((s) => s.topic);
}