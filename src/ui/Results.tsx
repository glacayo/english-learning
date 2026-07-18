import type { JSX } from 'react';
import type { Answer, AttemptResult, Exercise, LevelId } from '../domain/types';
import { levelLabel, PASS_THRESHOLD } from '../content/levels';
import { TOPIC_LABELS } from '../content/topics';
import type { ApiResult } from '../api/client';

/**
 * Results — end-of-test summary (scoring-feedback + level-progression specs).
 *
 * Shows the final score (0–10), the level number, the pass/fail status, the
 * mistakes list (each with topic, the student's answer, and the accepted
 * answer(s)), and the recommended topics. Also renders the submit status for
 * the leaderboard: pending, submitted, or failed. On failure the student still
 * sees their full local results, with a retry button (same attemptId is safe —
 * idempotent write).
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
  /** Catalog for resolving accepted answers in the mistakes review. */
  exercises: readonly Exercise[];
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

export function Results({
  result,
  exercises,
  name,
  levelId,
  submitStatus,
  onRetrySubmit,
  onRetake,
  onNextLevel,
  onBackToLevels,
  onViewLeaderboard,
}: ResultsProps): JSX.Element {
  const acceptedById = new Map<string, Exercise>();
  for (const ex of exercises) acceptedById.set(ex.id, ex);

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
              <MistakeItem key={m.exerciseId} mistake={m} exercise={acceptedById.get(m.exerciseId)} />
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

function MistakeItem({
  mistake,
  exercise,
}: {
  mistake: Answer;
  exercise: Exercise | undefined;
}): JSX.Element {
  const accepted = exercise?.acceptedAnswers ?? [];
  const topicLabel = TOPIC_LABELS[mistake.topic] ?? mistake.topic;
  return (
    <li className="mistake">
      <div className="mistake__prompt">{exercise?.prompt ?? mistake.exerciseId}</div>
      <div className="mistake__meta">{topicLabel}</div>
      <div className="mistake__row">
        <span className="mistake__given">You: {mistake.given || '(blank)'}</span>
        <span className="mistake__accepted">
          Correct: {accepted.join(' / ') || '—'}
        </span>
      </div>
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
