import type { Answer, AttemptResult, Exercise, Topic } from './types';
import { recommendTopics } from './recommendations';

/**
 * A single student response keyed by exercise id.
 *
 * `gradeAttempt` accepts either an array of these or a `Map<string, string>`.
 */
export interface StudentResponse {
  exerciseId: string;
  given: string;
}

/**
 * Normalize an answer or name for comparison.
 *
 * The scoring-feedback spec requires `trim` + case-fold (lowercase) so that
 * leading/trailing spaces or letter casing MUST NOT cause a correct answer to
 * fail. This single helper is the source of truth for that normalization and is
 * reused by grading and leaderboard ranking.
 */
export function normalizeAnswer(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Grade one answer against an exercise's accepted answers.
 *
 * Returns `true` when the normalized student answer equals any normalized
 * accepted answer; otherwise `false`. An empty/whitespace-only given answer
 * is never correct (it cannot match a non-empty accepted answer after trim).
 *
 * Pure function: no I/O, no mutation.
 */
export function gradeAnswer(exercise: Exercise, given: string): boolean {
  const normalizedGiven = normalizeAnswer(given);
  if (normalizedGiven.length === 0) return false;
  return exercise.acceptedAnswers.some(
    (accepted) => normalizeAnswer(accepted) === normalizedGiven,
  );
}

/**
 * Type guard distinguishing a `ReadonlyMap` of responses from an array of
 * `StudentResponse` records. Kept local to avoid exporting narrowing helpers.
 */
function isResponseMap(
  responses: readonly StudentResponse[] | ReadonlyMap<string, string>,
): responses is ReadonlyMap<string, string> {
  return typeof (responses as Map<string, string>).get === 'function';
}

/**
 * Grade a full attempt against the exercises of a single level
 * (scoring-feedback spec).
 *
 * Every exercise in `exercises` is graded. A response for an exercise id that
 * is not in `exercises` is ignored. An exercise with no matching response is
 * treated as unanswered and graded incorrect (spec: a skipped question counts
 * as incorrect).
 *
 * The returned `AttemptResult` contains:
 *   - `score`: the raw count of correct answers (0..N, where N is the number of
 *     graded exercises). For a level attempt N=10, so `score` is on a 0–10
 *     scale (design.md "Score scale": `gradeAttempt.score = correctCount`,
 *     no `*10`/`/10` rescaling). Passing is `score >= 9` (PASS_THRESHOLD).
 *   - `mistakes`: every incorrect `Answer` (wrong or unanswered), in catalog
 *     order, each with `exerciseId`, `topic`, `given` (empty string when
 *     unanswered), and `correct: false`.
 *   - `recommendations`: derived via `recommendTopics(answers)` — top 3 topics
 *     with miss rate >= 40% AND at least 2 questions in the attempt (level-
 *     scoped recommendation rule, scoring-feedback spec).
 *
 * When `exercises` is empty the score is 0 (defensive: a real level always has
 * 10 exercises; the catalog validator enforces this).
 *
 * Pure function: no I/O, no mutation of inputs.
 */
export function gradeAttempt(
  exercises: readonly Exercise[],
  responses: readonly StudentResponse[] | ReadonlyMap<string, string>,
): AttemptResult {
  const responseMap: Map<string, string> = new Map<string, string>();
  if (isResponseMap(responses)) {
    for (const [k, v] of responses) responseMap.set(k, v);
  } else {
    for (const r of responses) responseMap.set(r.exerciseId, r.given);
  }

  const answers: Answer[] = [];
  let correctCount = 0;

  for (const exercise of exercises) {
    const given = responseMap.get(exercise.id) ?? '';
    const correct = gradeAnswer(exercise, given);
    if (correct) {
      correctCount += 1;
    }
    answers.push({
      exerciseId: exercise.id,
      topic: exercise.topic,
      given,
      correct,
    });
  }

  // Score scale: raw correct count (0..N). For a 10-exercise level this is 0–10.
  // Previously (PR0) this was Math.round((correctCount / total) * 100).
  const score = correctCount;
  const mistakes = answers.filter((a) => !a.correct);
  const recommendations: Topic[] = recommendTopics(answers);

  return { score, mistakes, recommendations };
}