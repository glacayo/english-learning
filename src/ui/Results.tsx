import type { JSX } from 'react';
import type { Answer, AttemptResult, LevelId, Topic } from '../domain/types';
import { levelLabel, PASS_THRESHOLD } from '../content/levels';
import { TOPIC_LABELS } from '../content/topics';
import type { ApiResult } from '../api/client';

/**
 * Results — end-of-test summary (scoring-feedback + level-progression specs).
 *
 * Shows the final score (0–10), the level number, the pass/fail status, the
 * mistakes list (each with topic, the student's answer, and a study hint —
 * without revealing exercise prompts or accepted answers), and the recommended
 * topics. Also renders the submit status for the leaderboard: pending,
 * submitted, or failed. On failure the student still sees their full local
 * results, with a retry button (same attemptId is safe — idempotent write).
 *
 * Navigation (design.md "Results / navigation contract"):
 *   - "Back to levels" — always available after complete. Shows
 *     locked/unlocked/passed on LevelSelect so the student may start any
 *     unlocked level.
 *   - "Try again" (retake) — always available. Starts a new attempt scoped to
 *     the same level with a new attemptId. Passed state is never revoked.
 *   - "Next level" — available only when the attempt passed AND the level is
 *     below 10. Starts the next level (levelId + 1).
 *   - Level 10 completion — when the attempt passed Level 10, there is no
 *     "next level" button; a completion state is shown instead.
 *   - "See leaderboard" — always available.
 */
export interface ResultsProps {
  result: AttemptResult;
  /** Student display name (for the summary line + leaderboard submit). */
  name: string;
  /** Level this attempt was scoped to (1–10). */
  levelId: LevelId;
  /** Submit status for the leaderboard entry. */
  submitStatus: SubmitStatus;
  onRetrySubmit: () => void;
  onRetake: () => void;
  /** Start the next unlocked level (levelId + 1). Only invoked when levelId < 10 and the attempt passed. */
  onNextLevel: () => void;
  /** Return to the level-select screen. */
  onBackToLevels: () => void;
  onViewLeaderboard: () => void;
}

/**
 * Leaderboard submit status. Non-idle variants carry `attemptId` so a late
 * network response for attempt A cannot pollute attempt B after a retake.
 */
export type SubmitStatus =
  | { kind: 'idle' }
  | { kind: 'submitting'; attemptId: string }
  | { kind: 'submitted'; attemptId: string }
  | { kind: 'failed'; attemptId: string; message: string };

/**
 * Whether a raw score (0–10) passes the level (scoring-feedback spec: >= 9).
 * Exported for focused unit tests (no React Testing Library available; the
 * pure helper is the source of truth for the pass/fail badge).
 *
 * Pure function: no I/O, no mutation.
 */
export function didPass(score: number): boolean {
  return score >= PASS_THRESHOLD;
}

/**
 * Whether a "Next level" action is available for a completed attempt
 * (design.md "Results / navigation contract"): passed AND levelId < 10.
 *
 * Pure function: no I/O, no mutation.
 */
export function canAdvance(levelId: LevelId, score: number): boolean {
  return didPass(score) && levelId < 10;
}

/**
 * Study advice for a topic — used in the mistakes review so students know what
 * to practice without being shown the accepted answer(s).
 *
 * Pure function: no I/O, no mutation. Never returns answer keys.
 * Exhaustive over `Topic` (no default fallback).
 */
export function studyHintForTopic(topic: Topic): string {
  switch (topic) {
    case 'present-simple':
      return 'Review Present Simple: everyday habits and facts. Practice base verbs and when to add -s.';
    case 'simple-past':
      return 'Review Simple Past: finished actions. Practice regular -ed endings and common irregular verbs.';
    case 'present-progressive':
      return 'Review Present Progressive: actions happening now. Practice am/is/are + verb-ing.';
    case 'simple-past-3rd':
      return 'Review Simple Past with he/she/it. Practice past forms for third-person subjects.';
    case 'present-simple-3rd':
      return 'Review Present Simple with he/she/it. Practice adding -s/-es for third person.';
    case 'present-progressive-3rd':
      return 'Review Present Progressive with he/she/it. Practice is + verb-ing for one person.';
    case 'daily-routine':
      return 'Review Daily Routine vocabulary and verbs. Practice common morning and school-day actions.';
    case 'like-dislike':
      return 'Review Like and Don\'t Like patterns. Practice saying what you enjoy and what you do not.';
  }
}

export function Results({
  result,
  name,
  levelId,
  submitStatus,
  onRetrySubmit,
  onRetake,
  onNextLevel,
  onBackToLevels,
  onViewLeaderboard,
}: ResultsProps): JSX.Element {
  const passed = didPass(result.score);
  const isLevel10 = levelId === 10;
  const showNext = canAdvance(levelId, result.score);

  return (
    <section className="card results" aria-labelledby="results-title">
      <h2 id="results-title" className="results__title">
        Great job, {name}!
      </h2>

      <div className="results__level" aria-live="polite">
        {levelLabel(levelId)}
        <span className={`results__badge ${passed ? 'results__badge--pass' : 'results__badge--fail'}`}>
          {passed ? 'Passed!' : 'Keep practicing'}
        </span>
      </div>

      <div className="results__score" aria-live="polite">
        <span className="results__score-number">{result.score}</span>
        <span className="results__score-label">out of 10</span>
      </div>

      <ResultsSubmitBanner
        status={submitStatus}
        onRetrySubmit={onRetrySubmit}
      />

      <section className="results__section">
        <h3 className="results__subtitle">Study tips</h3>
        {result.recommendations.length > 0 ? (
          <ul className="results__recommendations">
            {result.recommendations.map((topic) => (
              <li key={topic}>{TOPIC_LABELS[topic] ?? topic}</li>
            ))}
          </ul>
        ) : (
          <p className="results__hint">
            No topics need extra practice — nice work!
          </p>
        )}
      </section>

      <section className="results__section">
        <h3 className="results__subtitle">
          Mistakes ({result.mistakes.length})
        </h3>
        {result.mistakes.length === 0 ? (
          <p className="results__hint">No mistakes — perfect score!</p>
        ) : (
          <ul className="results__mistakes">
            {result.mistakes.map((m) => (
              <MistakeItem key={m.exerciseId} mistake={m} />
            ))}
          </ul>
        )}
      </section>

      {passed && isLevel10 ? (
        <p className="results__complete" role="status">
          You finished the last level. Amazing work!
        </p>
      ) : null}

      <div className="results__buttons">
        <button
          type="button"
          className="button button--primary"
          onClick={onRetake}
        >
          Try again
        </button>
        {showNext ? (
          <button
            type="button"
            className="button button--primary"
            onClick={onNextLevel}
          >
            Next level
          </button>
        ) : null}
        <button
          type="button"
          className="button button--secondary"
          onClick={onBackToLevels}
        >
          Back to levels
        </button>
        <button type="button" className="button button--secondary" onClick={onViewLeaderboard}>
          See leaderboard
        </button>
      </div>
    </section>
  );
}

/**
 * Final mistake review: topic + student answer + study advice only.
 * Never renders the exercise prompt or acceptedAnswers (catalog prompts often
 * embed answer-key hints such as "(go)").
 */
function MistakeItem({
  mistake,
}: {
  mistake: Answer;
}): JSX.Element {
  const topicLabel = TOPIC_LABELS[mistake.topic] ?? mistake.topic;
  const studyHint = studyHintForTopic(mistake.topic);
  return (
    <li className="mistake">
      <div className="mistake__meta">{topicLabel}</div>
      <div className="mistake__row">
        <span className="mistake__given">You: {mistake.given || '(blank)'}</span>
      </div>
      <p className="mistake__advice">{studyHint}</p>
    </li>
  );
}

function ResultsSubmitBanner({
  status,
  onRetrySubmit,
}: {
  status: SubmitStatus;
  onRetrySubmit: () => void;
}): JSX.Element {
  switch (status.kind) {
    case 'idle':
      return <p className="results__submit results__submit--idle">Your score will be sent to the leaderboard.</p>;
    case 'submitting':
      return <p className="results__submit results__submit--pending" role="status">Sending your score…</p>;
    case 'submitted':
      return <p className="results__submit results__submit--ok" role="status">Your score is on the leaderboard!</p>;
    case 'failed':
      return (
        <div className="results__submit results__submit--failed" role="alert">
          <p>{status.message}</p>
          <button type="button" className="button button--secondary" onClick={onRetrySubmit}>
            Try sending again
          </button>
        </div>
      );
  }
}

/** Re-export for callers that want the typed result from the api layer. */
export type { ApiResult };
