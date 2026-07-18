/**
 * Shared domain contracts for the English Exercise App.
 *
 * These types are the contract between the exercise catalog, grading,
 * recommendations, ranking, the attempt state machine, the API client, and the
 * UI. They are intentionally framework-free so pure domain modules can be unit
 * tested by Vitest without importing React or the DOM.
 *
 * Sources:
 * - design.md "Interfaces / Contracts"
 * - exercise-bank spec (catalog size, topic coverage, record shape, answers)
 * - student-session spec (name identity, attempt lifecycle)
 * - scoring-feedback spec (auto-grading, mistakes, recommendations)
 * - shared-leaderboard spec (submission, ranking, tie-breaks)
 */

/**
 * The 8 approved exercise topics.
 *
 * Identity values are stable string literals used as catalog, grading, and
 * recommendation keys. Human-readable labels live in `src/content/topics.ts`.
 */
export type Topic =
  | 'present-simple'
  | 'simple-past'
  | 'present-progressive'
  | 'simple-past-3rd'
  | 'present-simple-3rd'
  | 'present-progressive-3rd'
  | 'daily-routine'
  | 'like-dislike';

/**
 * A level identifier in the 1–10 partition (level-progression + exercise-bank
 * specs). `difficulty === levelId`: an exercise whose `difficulty` is `N`
 * belongs to Level `N`. Level 1 is easiest; Level 10 is hardest.
 */
export type LevelId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * A single exercise record in the fixed 100-exercise catalog.
 *
 * - `id` MUST be unique across the catalog.
 * - `topic` MUST be one of the approved topics.
 * - `prompt` MUST be non-empty.
 * - `acceptedAnswers` MUST be a non-empty list. Alternate answers (contractions,
 *   synonyms) keep grading fair.
 * - `difficulty` MUST be an integer in 1–10 and IS the exercise's level id
 *   (design.md: `difficulty === levelId`). The 100-record catalog MUST partition
 *   into exactly 10 levels of 10 by `difficulty`.
 */
export interface Exercise {
  id: string;
  topic: Topic;
  prompt: string;
  acceptedAnswers: string[];
  difficulty: number;
}

/**
 * One of the 10 levels built from the catalog by grouping exercises on
 * `difficulty` (level-progression spec). `exercises` is the ordered, frozen
 * bucket for that level id.
 */
export interface Level {
  id: LevelId;
  label: string;
  exercises: readonly Exercise[];
}

/**
 * Lifecycle states for a test attempt (student-session spec).
 *
 * `not-started → in-progress → completed`. Answers MUST only be recorded while
 * `in-progress`; after `completed` further submissions are rejected.
 */
export type AttemptState = 'not-started' | 'in-progress' | 'completed';

/**
 * A graded answer within an attempt. `correct` is derived from
 * `acceptedAnswers` using trim + case-fold normalization (scoring-feedback
 * spec). Mistakes are the subset where `correct === false`.
 */
export interface Answer {
  exerciseId: string;
  topic: Topic;
  given: string;
  correct: boolean;
}

/**
 * The result of a completed attempt. `score` is on a 0–10 scale (correct
 * answers out of the selected level's 10 exercises — scoring-feedback spec).
 * The score scale is moving from the legacy 0–100 (full 100-exercise catalog)
 * to 0–10 (one level at a time); see design.md "Score scale". `mistakes` lists
 * every incorrect answer with topic and given value. `recommendations` is the
 * ordered list of recommended topics (miss rate >= 40%, top 3).
 */
export interface AttemptResult {
  score: number;
  mistakes: Answer[];
  recommendations: Topic[];
}

/**
 * A leaderboard entry persisted in Netlify Blobs and read across devices
 * (shared-leaderboard spec). The blob key is the client-generated `attemptId`,
 * which acts as the idempotency key for the write.
 *
 * PR3 level-aware schema: every public entry MUST include `level` (LevelId
 * 1–10) and `score` on the 0–10 scale. The global leaderboard ranks `level`
 * desc first so harder-level attempts rank above easier ones. Legacy 0–100
 * rows without `level` are not part of this public contract — they are
 * rejected on read and removed by `scripts/reset-leaderboard.mjs`.
 */
export interface LeaderboardEntry {
  attemptId: string;
  name: string;
  score: number;
  /** Level the attempt was scoped to (1–10). Required on every public row. */
  level: LevelId;
  timestamp: number;
}

/**
 * Request payloads for the serverless API (design.md API contracts).
 * Kept here so the client, function handlers, and tests share one contract.
 */
export interface ClaimNameRequest {
  name: string;
}

export interface ClaimNameResponse {
  ok: boolean;
  name?: string;
  reason?: 'invalid';
}

export interface SubmitScoreRequest {
  name: string;
  score: number;
  /** Level the attempt was scoped to (1–10). Required for level-aware scoring. */
  level: LevelId;
  attemptId: string;
}

export interface SubmitScoreResponse {
  ok: boolean;
}