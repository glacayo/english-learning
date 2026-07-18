import type { JSX } from 'react';
import type { LeaderboardEntry, LevelId } from '../domain/types';
import type { ApiError } from '../api/client';
import { LEVEL_COUNT } from '../content/levels';

/**
 * Leaderboard — shared cross-device rankings (shared-leaderboard spec).
 *
 * Lists every submitted attempt row (retakes produce multiple rows per
 * display name — v1 does NOT collapse to best-score-only). Ranking is done
 * client-side by the pure `rankEntries` before reaching this component, so the
 * display order is always the spec order regardless of the server.
 *
 * The board supports two views (shared-leaderboard spec "Level-Aware
 * Leaderboard Views"):
 *   - Global (default): all levels ranked together by `level` desc →
 *     `score` desc → ties. A "Level" column shows which level each row
 *     belongs to.
 *   - Per-level: filtered to one `level` and ranked by `score` desc → ties.
 * A control toggles between Global and Level N (1–10). The parent owns the
 * selected filter (`levelFilter`) and reloads via `onLevelFilterChange` so the
 * API call (`?level=N`) and ranking stay in sync.
 *
 * When the API is unavailable (`ApiError`), the board shows a friendly
 * message and an empty state — local results are still available elsewhere.
 */
export interface LeaderboardProps {
  /** Ranked entries (already sorted by `rankEntries` for the active view). */
  entries: readonly LeaderboardEntry[];
  /** Optional load status from the API client. */
  status: LeaderboardStatus;
  /** Current level filter: `null` = global, `1..10` = per-level. */
  levelFilter: LevelId | null;
  onLevelFilterChange: (level: LevelId | null) => void;
  onRefresh: () => void;
  onBack: () => void;
}

export type LeaderboardStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded' }
  | { kind: 'error'; error: ApiError };

/** The selectable level filter values: Global plus Levels 1–10. */
export const LEVEL_FILTER_OPTIONS: readonly (LevelId | null)[] = [
  null,
  ...Array.from({ length: LEVEL_COUNT }, (_, i) => (i + 1) as LevelId),
];

/**
 * Human label for the filter control. Exported so the UI and tests share one
 * source of truth (e.g. `levelFilterLabel(null) === 'Global'`).
 */
export function levelFilterLabel(level: LevelId | null): string {
  return level === null ? 'Global' : `Level ${level}`;
}

/**
 * Rows safe to paint for the active view. Global keeps every entry; per-level
 * drops rows whose `level` does not match so a stale parent cache cannot show
 * global/old-level scores under the newly selected filter while loading.
 */
export function entriesForActiveFilter(
  entries: readonly LeaderboardEntry[],
  levelFilter: LevelId | null,
): readonly LeaderboardEntry[] {
  if (levelFilter === null) return entries;
  return entries.filter((entry) => entry.level === levelFilter);
}

export function Leaderboard({
  entries,
  status,
  levelFilter,
  onLevelFilterChange,
  onRefresh,
  onBack,
}: LeaderboardProps): JSX.Element {
  const displayEntries = entriesForActiveFilter(entries, levelFilter);

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

      <LeaderboardFilter
        levelFilter={levelFilter}
        onLevelFilterChange={onLevelFilterChange}
      />

      <LeaderboardStatusLine status={status} />

      {displayEntries.length === 0 ? (
        <p className="leaderboard__empty">
          No scores yet. Be the first to finish the practice!
        </p>
      ) : (
        <ol className="leaderboard__list">
          {displayEntries.map((entry, i) => (
            <li
              key={entry.attemptId}
              className={`leaderboard__row${i < 3 ? ' leaderboard__row--top' : ''}`}
            >
              <span className="leaderboard__rank">{i + 1}</span>
              <span className="leaderboard__name">{entry.name}</span>
              <span className="leaderboard__level">{`L${entry.level}`}</span>
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

function LeaderboardFilter({
  levelFilter,
  onLevelFilterChange,
}: {
  levelFilter: LevelId | null;
  onLevelFilterChange: (level: LevelId | null) => void;
}): JSX.Element {
  return (
    <div className="leaderboard__filter" role="group" aria-label="Leaderboard view">
      <label className="leaderboard__filter-label" htmlFor="leaderboard-level-filter">
        View:
      </label>
      <select
        id="leaderboard-level-filter"
        className="leaderboard__filter-select"
        value={levelFilter === null ? 'global' : String(levelFilter)}
        onChange={(e) => {
          const v = e.target.value;
          onLevelFilterChange(v === 'global' ? null : (Number(v) as LevelId));
        }}
      >
        {LEVEL_FILTER_OPTIONS.map((opt) => (
          <option key={opt === null ? 'global' : `l${opt}`} value={opt === null ? 'global' : String(opt)}>
            {levelFilterLabel(opt)}
          </option>
        ))}
      </select>
    </div>
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
