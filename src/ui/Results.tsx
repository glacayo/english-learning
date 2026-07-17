import type { JSX } from 'react';
import type { Answer, AttemptResult, Exercise } from '../domain/types';
import { TOPIC_LABELS } from '../content/topics';
import type { ApiResult } from '../api/client';

/**
 * Results — end-of-test summary (scoring-feedback + shared-leaderboard specs).
 *
 * Shows the final score (0–100), the mistakes list (each with topic, the
 * student's answer, and the accepted answer(s)), and the recommended topics.
 * Also renders the submit status for the leaderboard: pending, submitted, or
 * failed. On failure the student still sees their full local results, with a
 * retry button (same attemptId is safe — idempotent write).
 */
export interface ResultsProps {
  result: AttemptResult;
  /** Catalog for resolving accepted answers in the mistakes review. */
  exercises: readonly Exercise[];
  /** Student display name (for the summary line + leaderboard submit). */
  name: string;
  /** Submit status for the leaderboard entry. */
  submitStatus: SubmitStatus;
  onRetrySubmit: () => void;
  onRetake: () => void;
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

export function Results({
  result,
  exercises,
  name,
  submitStatus,
  onRetrySubmit,
  onRetake,
  onViewLeaderboard,
}: ResultsProps): JSX.Element {
  const acceptedById = new Map<string, Exercise>();
  for (const ex of exercises) acceptedById.set(ex.id, ex);

  return (
    <section className="card results" aria-labelledby="results-title">
      <h2 id="results-title" className="results__title">
        Great job, {name}!
      </h2>

      <div className="results__score" aria-live="polite">
        <span className="results__score-number">{result.score}</span>
        <span className="results__score-label">out of 100</span>
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

      <div className="results__buttons">
        <button
          type="button"
          className="button button--primary"
          onClick={onRetake}
          disabled={submitStatus.kind === 'submitting'}
        >
          Try again
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