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

/**
 * Minimum number of questions a topic must have within a single level attempt
 * to be eligible for recommendation (scoring-feedback spec: "the topic has at
 * least 2 questions in the level attempt"). A topic with only one question in
 * the attempt MUST NOT be recommended even if that single question was missed.
 *
 * This rule is level-scoped: the attempt only contains the 10 exercises of the
 * selected level, so the sample size is the count within those 10 — not the
 * full 100-exercise catalog. The rule avoids noisy 1/1 (100%) recommendations
 * on mixed 10-question levels (design.md "Recommendations").
 */
export const MIN_RECOMMENDATION_SAMPLE = 2;

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
 * Recommend up to 3 topics that satisfy BOTH (scoring-feedback spec):
 *   1. the topic has at least `MIN_RECOMMENDATION_SAMPLE` (2) questions in the
 *      attempt (minimum sample size), AND
 *   2. the topic miss rate is `RECOMMENDATION_THRESHOLD` (40%) or higher,
 * ordered from highest miss rate to lowest.
 *
 * This is level-scoped: `answers` is the graded answer set for one 10-question
 * level attempt, so a topic with only one question in the attempt MUST NOT be
 * recommended even if that single question was missed (spec scenario
 * "Single-question miss is not recommended (insufficient sample)").
 *
 * Tie-break between topics with identical miss rates is by topic name ascending
 * so the result is deterministic regardless of object key order.
 *
 * Pure function: no I/O, no mutation.
 */
export function recommendTopics(answers: readonly Answer[]): Topic[] {
  const stats = computeTopicStats(answers);
  return stats
    .filter(
      (s) =>
        s.total >= MIN_RECOMMENDATION_SAMPLE &&
        s.missRate >= RECOMMENDATION_THRESHOLD,
    )
    .sort((a, b) => {
      if (b.missRate !== a.missRate) return b.missRate - a.missRate;
      return a.topic < b.topic ? -1 : a.topic > b.topic ? 1 : 0;
    })
    .slice(0, MAX_RECOMMENDATIONS)
    .map((s) => s.topic);
}