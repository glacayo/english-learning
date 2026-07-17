import type { AttemptState } from '../domain/types';

/**
 * Attempt lifecycle state machine (student-session spec).
 *
 * The reducer models `not-started → in-progress → completed` and enforces:
 *   - Answers are recorded ONLY while `in-progress`.
 *   - After `completed`, further answer submissions are rejected (no-op).
 *   - A retake starts a fresh `in-progress` attempt with a brand-new
 *     `attemptId` (B ≠ A), so each attempt stays independent for scoring and
 *     leaderboard submission.
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
 * - `answers`: ordered list of recorded answers (catalog order is enforced by
 *   the caller; the reducer preserves insertion order).
 * - `total`: number of exercises in the catalog; the attempt auto-completes
 *   once this many answers are recorded.
 */
export interface AttemptData {
  state: AttemptState;
  attemptId: string;
  name: string;
  answers: AttemptAnswer[];
  total: number;
}

/**
 * Discriminated union of actions the reducer accepts.
 */
export type AttemptAction =
  | { type: 'start'; name: string; attemptId: string; total: number }
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
    answers: [],
    total: 0,
  };
}

/**
 * Attempt reducer.
 *
 * Transitions:
 *   - `start`  : `not-started` → `in-progress`. Requires a non-empty normalized
 *                name and a non-empty attemptId; otherwise the state is
 *                returned unchanged (the caller validates and shows guidance,
 *                but the reducer defends itself too).
 *   - `answer` : only while `in-progress`. Records the answer; if the exercise
 *                was already answered, the existing answer is replaced (same
 *                index) so the count never exceeds `total`. When the recorded
 *                answer count reaches `total`, the state transitions to
 *                `completed`.
 *   - `complete`: only while `in-progress`. Builds a full answers list in
 *                catalog order from `exerciseIds`, keeping any recorded given
 *                values and filling blanks for skipped/unanswered items, then
 *                transitions to `completed`. Used by Finish so Skip/early
 *                navigation cannot leave results with a null grade.
 *   - `retake` : starts a new `in-progress` attempt reusing the existing name
 *                and `total`, but with a NEW `attemptId`. The previous answers
 *                are cleared. Allowed from `completed` (the main retake path)
 *                and also defensively from `in-progress`/`not-started`.
 *   - `reset`  : returns to `not-started` with no name, no answers, no
 *                attemptId. Useful for full restart / switching student.
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
      return {
        state: 'in-progress',
        attemptId: action.attemptId,
        name: trimmedName,
        answers: [],
        total: action.total,
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
        // Align total with the catalog length used for completion.
        total: action.exerciseIds.length,
        state: 'completed',
      };
    }

    case 'retake': {
      if (!action.attemptId) return state;
      // Preserve the captured name and total; clear answers; new attemptId.
      return {
        state: 'in-progress',
        attemptId: action.attemptId,
        name: state.name,
        answers: [],
        total: state.total,
      };
    }

    case 'reset':
      return createInitialAttempt();

    default:
      return state;
  }
}