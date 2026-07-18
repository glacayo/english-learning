import type { LevelId } from './types';
import { LEVEL_COUNT, PASS_THRESHOLD, toLevelId } from '../content/levels';

/**
 * Pure level-progression helpers (level-progression spec + design.md
 * "Progression store").
 *
 * Progression is a pure unlock function persisted to `localStorage` per claimed
 * student identity (same-browser v1). These functions are the single source of
 * truth for unlock/pass logic and are framework-free so they can be unit tested
 * by Vitest without the DOM. The I/O boundary lives in
 * `src/state/levelProgressStore.ts`.
 *
 * Invariants enforced here:
 *   - A fresh student has only Level 1 unlocked (level-progression spec:
 *     "start every student with only Level 1 unlocked").
 *   - A level unlocks when the immediately preceding level has been passed at
 *     least once.
 *   - Passing is sticky: a passed level is never revoked by a retake
 *     (level-progression spec "Retake Allowed": "existing passed/unlocked
 *     state MUST NOT be revoked regardless of the retake's outcome").
 *   - Level 10 has no next level; passing it is a completion state, not an
 *     unlock.
 */

/**
 * Persisted progression state for one student identity.
 *
 * `passed` is the set of level ids the student has passed at least once. A
 * level is unlocked when its id is 1 OR its `(id - 1)` is in `passed`. Stored
 * as a sorted array for JSON-friendliness; the pure helpers accept/return
 * `LevelProgress` and never mutate it.
 */
export interface LevelProgress {
  /** Level ids passed at least once, ascending and unique. */
  passed: LevelId[];
}

/**
 * Create a fresh progress state with no levels passed. Level 1 is the only
 * unlocked level for a new student.
 *
 * Pure function: no I/O.
 */
export function createInitialProgress(): LevelProgress {
  return { passed: [] };
}

/**
 * Whether a level id has been passed at least once.
 *
 * Pure function: no I/O, no mutation.
 */
export function isPassed(progress: LevelProgress, id: LevelId): boolean {
  return progress.passed.includes(id);
}

/**
 * Whether a level is unlocked for the student. Level 1 is always unlocked;
 * any other level N is unlocked when level N-1 has been passed.
 *
 * Pure function: no I/O, no mutation.
 */
export function isUnlocked(progress: LevelProgress, id: LevelId): boolean {
  if (id === 1) return true;
  return isPassed(progress, (id - 1) as LevelId);
}

/**
 * The next level to unlock after passing `id`, or `null` when `id` is Level 10
 * (no next level — completion state). Does NOT mutate progress; callers that
 * want to record the pass use `applyPass`.
 *
 * Pure function: no I/O, no mutation.
 */
export function nextLevel(id: LevelId): LevelId | null {
  if (id >= LEVEL_COUNT) return null;
  return (id + 1) as LevelId;
}

/**
 * Determine whether a score (raw correct count, 0–10) passes a level
 * (scoring-feedback + level-progression specs: "at least 9 out of 10 (90%)").
 *
 * Pure function: no I/O, no mutation.
 */
export function isPassingScore(score: number): boolean {
  return score >= PASS_THRESHOLD;
}

/**
 * Record a pass for `id` if the score meets the pass threshold, returning a new
 * `LevelProgress`. Passing is sticky and idempotent: recording an already-passed
 * level returns progress with the same set (no duplicate). A score below the
 * threshold returns progress unchanged (the level is not marked passed and no
 * level is unlocked).
 *
 * Pure function: returns a new `LevelProgress`; never mutates the input.
 */
export function applyPass(progress: LevelProgress, id: LevelId, score: number): LevelProgress {
  if (!isPassingScore(score)) return progress;
  if (progress.passed.includes(id)) return progress;
  return {
    passed: [...progress.passed, id].sort((a, b) => a - b),
  };
}

/**
 * Normalize an arbitrary parsed value (e.g. from localStorage JSON) into a valid
 * `LevelProgress`, or return `null` when the shape is invalid. Used by the
 * store loader so corrupt/legacy data falls back to fresh progress instead of
 * crashing the app.
 *
 * Pure function: no I/O.
 */
export function parseProgress(value: unknown): LevelProgress | null {
  if (value === null || typeof value !== 'object') return null;
  const raw = value as { passed?: unknown };
  if (!Array.isArray(raw.passed)) return null;
  const passed: LevelId[] = [];
  for (const item of raw.passed) {
    const id = toLevelId(item);
    if (id === null) return null;
    if (passed.includes(id)) continue; // de-dupe defensively
    passed.push(id);
  }
  passed.sort((a, b) => a - b);
  return { passed };
}