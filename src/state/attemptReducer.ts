import type { AttemptState, LevelId } from '../domain/types';
import { LEVEL_SIZE, toLevelId } from '../content/levels';

/**
 * Attempt lifecycle state machine (student-session + level-progression specs).
 *
 * The reducer models `not-started → in-progress → completed` and enforces:
 *   - Answers are recorded ONLY while `in-progress`.
 *   - After `completed`, further answer submissions are rejected (no-op).
 *   - A retake starts a fresh `in-progress` attempt with a brand-new
 *     `attemptId` (B ≠ A), so each attempt stays independent for scoring and
 *     leaderboard submission. A retake targets the SAME level as the attempt
 *     being retaken (student-session spec: "Retake targets the same level").
 *
 * Each attempt is bound to a single level's 10 exercises:
 *   - `start` carries a `levelId` (the selected unlocked level) and `total`
 *     (the level size, 10). The reducer stores `levelId` so grading, results,
 *     and leaderboard submission know which level this attempt belongs to.
 *   - `retake` preserves the `levelId` from the prior attempt.
 *   - `complete` uses the supplied `exerciseIds` (the level's 10 ids) and
 *     aligns `total` to that length so the attempt completes after 10 answers.
 *
 * The reducer is pure: given a state and an action it returns a new state and
 * never mutates the input. It does not generate ids or timestamps itself —
 * callers supply them so the reducer stays unit-testable without crypto/time.
 */

/**
 * A single recorded answer keyed by exercise id (student-session spec:
 * answers accepted only while in-progress).
 */
export interface AttemptAnswer {
  exerciseId: string;
  given: string;
}

/**
 * Full attempt state managed by the reducer.
 *
 * - `attemptId`: client-generated idempotency key for leaderboard submission
 *   (shared-leaderboard spec). New per attempt/retake.
 * - `name`: trimmed display name captured at start (empty until started).
 * - `levelId`: the level this attempt is scoped to (student-session spec:
 *   "Every attempt MUST be started against a specific unlocked level"). Empty
 *   (`0`) until started; preserved across `retake`.
 * - `answers`: ordered list of recorded answers (catalog order is enforced by
 *   the caller; the reducer preserves insertion order).
 * - `total`: number of exercises in the level (LEVEL_SIZE = 10); the attempt
 *   auto-completes once this many answers are recorded.
 */
export interface AttemptData {
  state: AttemptState;
  attemptId: string;
  name: string;
  /** Level id the attempt is scoped to (0 until started). */
  levelId: LevelId | 0;
  answers: AttemptAnswer[];
  total: number;
}

/**
 * Discriminated union of actions the reducer accepts.
 */
export type AttemptAction =
  | {
      type: 'start';
      name: string;
      attemptId: string;
      /** Level the attempt is scoped to (a selected unlocked LevelId). */
      levelId: LevelId;
      /**
       * Number of exercises in the level (the attempt completes after this
       * many answers). Defaults to `LEVEL_SIZE` (10) when omitted.
       */
      total?: number;
    }
  | { type: 'answer'; exerciseId: string; given: string }
  | {
      /**
       * Force-complete an in-progress attempt. Materializes one answer per
       * catalog exercise id (blank when unanswered/skipped) so grading and
       * results always see a full attempt even after Skip/Finish shortcuts.
       */
      type: 'complete';
      exerciseIds: readonly string[];
    }
  | { type: 'retake'; attemptId: string }
  | {
      /**
       * Restore an in-progress attempt from a refresh-safe draft (student-session
       * refresh resume). Replaces the current state with the saved answers,
       * attemptId, level, and total so the child continues where they left off.
       */
      type: 'restore';
      name: string;
      attemptId: string;
      levelId: LevelId;
      answers: readonly AttemptAnswer[];
      total: number;
    }
  | { type: 'reset' };

/**
 * Initial state factory. Kept as a function (not a constant) because callers
 * may want a fresh object per attempt; the reducer never shares mutable state.
 */
export function createInitialAttempt(): AttemptData {
  return {
    state: 'not-started',
    attemptId: '',
    name: '',
    levelId: 0,
    answers: [],
    total: 0,
  };
}

/**
 * Attempt reducer.
 *
 * Transitions:
 *   - `start`  : `not-started` → `in-progress`. Requires a non-empty normalized
 *                name, a non-empty attemptId, and a valid `levelId` (1–10);
 *                otherwise the state is returned unchanged. Records `levelId`
 *                and `total` (defaulting to LEVEL_SIZE) so grading knows which
 *                level's 10 exercises to grade.
 *   - `answer` : only while `in-progress`. Records the answer; if the exercise
 *                was already answered, the existing answer is replaced (same
 *                index) so the count never exceeds `total`. When the recorded
 *                answer count reaches `total`, the state transitions to
 *                `completed` (student-session spec: "completed after the
 *                level's 10th answer").
 *   - `complete`: only while `in-progress`. Builds a full answers list in
 *                catalog order from `exerciseIds`, keeping any recorded given
 *                values and filling blanks for skipped/unanswered items, then
 *                transitions to `completed`. Used by Finish so Skip/early
 *                navigation cannot leave results with a null grade.
  *   - `retake` : starts a new `in-progress` attempt reusing the existing name,
  *                `levelId`, and `total`, but with a NEW `attemptId`. The
  *                previous answers are cleared. Allowed from `completed` (the
  *                main retake path) and also defensively from
  *                `in-progress`/`not-started`.
  *   - `restore`: replaces state with a previously persisted in-progress draft
  *                (same attemptId, answers, level). Rejects invalid / completed
  *                payloads so corrupt drafts never crash the session.
  *   - `reset`  : returns to `not-started` with no name, no answers, no
  *                attemptId, and no level. Useful for full restart / switching
  *                student.
  *
  * Pure function: returns a new `AttemptData` and never mutates `state`.
  */
export function attemptReducer(
  state: AttemptData,
  action: AttemptAction,
): AttemptData {
  switch (action.type) {
    case 'start': {
      const trimmedName = action.name.trim();
      if (trimmedName.length === 0) return state;
      if (!action.attemptId) return state;
      if (toLevelId(action.levelId) === null) return state;
      return {
        state: 'in-progress',
        attemptId: action.attemptId,
        name: trimmedName,
        levelId: action.levelId,
        answers: [],
        total: action.total ?? LEVEL_SIZE,
      };
    }

    case 'answer': {
      if (state.state !== 'in-progress') return state;
      if (state.total <= 0) return state;

      const existingIndex = state.answers.findIndex(
        (a) => a.exerciseId === action.exerciseId,
      );
      const answers =
        existingIndex >= 0
          ? state.answers.map((a, i) =>
              i === existingIndex
                ? { ...a, given: action.given }
                : a,
            )
          : [...state.answers, { exerciseId: action.exerciseId, given: action.given }];

      const completed = answers.length >= state.total;
      return {
        ...state,
        answers,
        state: completed ? 'completed' : 'in-progress',
      };
    }

    case 'complete': {
      if (state.state !== 'in-progress') return state;
      if (action.exerciseIds.length === 0) return state;

      const existing = new Map(
        state.answers.map((a) => [a.exerciseId, a.given] as const),
      );
      const answers: AttemptAnswer[] = action.exerciseIds.map((exerciseId) => ({
        exerciseId,
        given: existing.get(exerciseId) ?? '',
      }));

      return {
        ...state,
        answers,
        // Align total with the level length used for completion (10).
        total: action.exerciseIds.length,
        state: 'completed',
      };
    }

    case 'retake': {
      if (!action.attemptId) return state;
      // Preserve name, levelId, and total; clear answers; new attemptId.
      // A retake targets the SAME level (student-session spec).
      return {
        state: 'in-progress',
        attemptId: action.attemptId,
        name: state.name,
        levelId: state.levelId,
        answers: [],
        total: state.total,
      };
    }

    case 'restore': {
      const trimmedName = action.name.trim();
      if (trimmedName.length === 0) return state;
      if (!action.attemptId) return state;
      if (toLevelId(action.levelId) === null) return state;
      if (!Number.isInteger(action.total) || action.total <= 0) return state;
      // Only restore incomplete attempts; a full answer list is "completed".
      if (action.answers.length >= action.total) return state;

      const answers: AttemptAnswer[] = [];
      const seen = new Set<string>();
      for (const a of action.answers) {
        if (typeof a.exerciseId !== 'string' || a.exerciseId.length === 0) return state;
        if (typeof a.given !== 'string') return state;
        if (seen.has(a.exerciseId)) return state;
        seen.add(a.exerciseId);
        answers.push({ exerciseId: a.exerciseId, given: a.given });
      }

      return {
        state: 'in-progress',
        attemptId: action.attemptId,
        name: trimmedName,
        levelId: action.levelId,
        answers,
        total: action.total,
      };
    }

    case 'reset':
      return createInitialAttempt();

    default:
      return state;
  }
}
