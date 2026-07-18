import type { JSX } from 'react';
import type { Level, LevelId } from '../domain/types';
import { levelLabel, LEVEL_COUNT } from '../content/levels';
import type { LevelProgress } from '../domain/levelProgress';
import { isPassed, isUnlocked } from '../domain/levelProgress';

/**
 * LevelSelect — level picker (level-progression spec).
 *
 * Renders one card per level (1–10). Each card reflects the student's
 * progression state for that level:
 *   - `passed`:    the student passed this level at least once.
 *   - `unlocked`:  available to start (Level 1 is always unlocked; level N>1
 *                  is unlocked when level N-1 has been passed).
 *   - `locked`:    not available yet. The card shows a friendly hint to pass
 *                  the previous level first (spec scenario: "Locked level
 *                  cannot be started").
 *
 * Selecting a locked level is blocked: `onSelect` is NOT invoked; instead the
 * card shows its hint (the parent does not need to re-validate the lock, but
 * the store helpers remain the source of truth for unlock logic).
 *
 * The student MAY start ANY unlocked level (passed or merely unlocked), and
 * retake any unlocked level — progression is never revoked (spec "Retake
 * Allowed"). This component is presentational: it receives the `levels`, the
 * student's `progress`, and a callback.
 */
export interface LevelSelectProps {
  levels: readonly Level[];
  progress: LevelProgress;
  /** Student display name, for a friendly greeting. */
  name: string;
  /** Called with the selected `LevelId` when the student starts an unlocked level. */
  onSelect: (id: LevelId) => void;
  /** Called when the student wants to see the leaderboard from level select. */
  onViewLeaderboard?: () => void;
}

/**
 * Status of a single level card, derived from `progress`. Exported for focused
 * unit tests (no React Testing Library available; the pure helper is the
 * source of truth for card rendering decisions).
 */
export type LevelCardStatus = 'locked' | 'unlocked' | 'passed';

/** Eyebrow copy above the level-select greeting. Exported so tests can assert without locking a free-form literal. */
export const LEVEL_SELECT_EYEBROW = 'Your adventure map';

/**
 * Derive the display status of a level card from the student's progress.
 *
 * A level is `passed` when it is in `progress.passed`; otherwise `unlocked`
 * when Level 1 or its predecessor has been passed; otherwise `locked`.
 *
 * Pure function: no I/O, no mutation.
 */
export function levelCardStatus(
  progress: LevelProgress,
  id: LevelId,
): LevelCardStatus {
  if (isPassed(progress, id)) return 'passed';
  if (isUnlocked(progress, id)) return 'unlocked';
  return 'locked';
}

/**
 * Human-readable status chip for a level card. Exported for tests that assert
 * the visible labels without mounting React.
 */
export function statusLabel(status: LevelCardStatus): string {
  if (status === 'passed') return 'Passed';
  if (status === 'unlocked') return 'Start';
  return 'Locked';
}

export function LevelSelect({
  levels,
  progress,
  name,
  onSelect,
  onViewLeaderboard,
}: LevelSelectProps): JSX.Element {
  const passedCount = levels.reduce((count, level) => {
    return levelCardStatus(progress, level.id) === 'passed' ? count + 1 : count;
  }, 0);

  return (
    <section className="card level-select" aria-labelledby="level-select-title">
      <header className="level-select__hero">
        <p className="level-select__eyebrow">{LEVEL_SELECT_EYEBROW}</p>
        <h2 id="level-select-title" className="level-select__title">
          Hi, {name}! Pick a level
        </h2>
        <p className="level-select__hint">
          Pass a level (9 out of 10) to unlock the next one. You can retake any
          level you&rsquo;ve unlocked.
        </p>
        <p className="level-select__progress" aria-live="polite">
          You passed <strong>{passedCount}</strong> of{' '}
          <strong>{LEVEL_COUNT}</strong> levels
        </p>
      </header>

      <ul className="level-select__grid">
        {levels.map((level) => {
          const status = levelCardStatus(progress, level.id);
          const locked = status === 'locked';
          const disabled = locked;
          return (
            <li key={level.id} className={`level-card level-card--${status}`}>
              <button
                type="button"
                className="level-card__button"
                disabled={disabled}
                onClick={() => onSelect(level.id)}
                aria-label={`${levelLabel(level.id)} — ${status}`}
              >
                <span className="level-card__number" aria-hidden="true">
                  {level.id}
                </span>
                <span className="level-card__body">
                  <span className="level-card__label">{level.label}</span>
                  <span className="level-card__status">{statusLabel(status)}</span>
                </span>
                <span className="level-card__icon" aria-hidden="true">
                  {status === 'passed' ? '✓' : status === 'locked' ? '🔒' : '▶'}
                </span>
              </button>
              {locked ? (
                <span className="level-card__hint">
                  Pass {levelLabel((level.id - 1) as LevelId)} first to unlock.
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {onViewLeaderboard ? (
        <div className="level-select__buttons">
          <button
            type="button"
            className="button button--secondary"
            onClick={onViewLeaderboard}
          >
            See leaderboard
          </button>
        </div>
      ) : null}
    </section>
  );
}

/** Total number of levels, re-exported for tests/convenience. */
export { LEVEL_COUNT };
