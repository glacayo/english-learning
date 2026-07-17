import type { JSX } from 'react';
import type { LeaderboardEntry } from '../domain/types';
import type { ApiError } from '../api/client';

/**
 * Leaderboard — shared cross-device rankings (shared-leaderboard spec).
 *
 * Lists every submitted attempt row (retakes produce multiple rows per
 * display name — v1 does NOT collapse to best-score-only). Ranking is done
 * client-side by the pure `rankEntries` before reaching this component, so the
 * display order is always the spec order regardless of the server.
 *
 * When the API is unavailable (`ApiError`), the board shows a friendly
 * message and an empty state — local results are still available elsewhere.
 */
export interface LeaderboardProps {
  /** Ranked entries (already sorted by `rankEntries`). */
  entries: readonly LeaderboardEntry[];
  /** Optional load status from the API client. */
  status: LeaderboardStatus;
  onRefresh: () => void;
  onBack: () => void;
}

export type LeaderboardStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded' }
  | { kind: 'error'; error: ApiError };

export function Leaderboard({
  entries,
  status,
  onRefresh,
  onBack,
}: LeaderboardProps): JSX.Element {
  return (
    <section className="card leaderboard" aria-labelledby="leaderboard-title">
      <div className="leaderboard__header">
        <h2 id="leaderboard-title" className="leaderboard__title">
          Leaderboard
        </h2>
        <button
          type="button"
          className="button button--secondary"
          onClick={onRefresh}
          disabled={status.kind === 'loading'}
        >
          {status.kind === 'loading' ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <LeaderboardStatusLine status={status} />

      {entries.length === 0 ? (
        <p className="leaderboard__empty">
          No scores yet. Be the first to finish the practice!
        </p>
      ) : (
        <ol className="leaderboard__list">
          {entries.map((entry, i) => (
            <li
              key={entry.attemptId}
              className={`leaderboard__row${i < 3 ? ' leaderboard__row--top' : ''}`}
            >
              <span className="leaderboard__rank">{i + 1}</span>
              <span className="leaderboard__name">{entry.name}</span>
              <span className="leaderboard__score">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="leaderboard__footer">
        <button type="button" className="button button--secondary" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}

function LeaderboardStatusLine({ status }: { status: LeaderboardStatus }): JSX.Element | null {
  if (status.kind === 'error') {
    return (
      <p className="leaderboard__status leaderboard__status--error" role="status">
        {status.error.message}
      </p>
    );
  }
  if (status.kind === 'loading') {
    return <p className="leaderboard__status" role="status">Loading the leaderboard…</p>;
  }
  return null;
}