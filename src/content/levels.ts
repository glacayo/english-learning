import type { Exercise, Level, LevelId } from '../domain/types';

/**
 * Level partition built from the 100-exercise catalog (exercise-bank +
 * level-progression specs; design.md "Level source of truth").
 *
 * `difficulty === levelId`: an exercise's `difficulty` IS its level id, so the
 * partition is a pure `groupBy(difficulty)` over the flat catalog. There is no
 * second source of truth — `buildLevels()` groups by `difficulty` and the
 * catalog validator enforces exactly 10 exercises per bucket (1–10). This keeps
 * the partition self-validating: a drift between `difficulty` counts and the
 * level table cannot happen because the table is derived, not authored.
 */

/**
 * Number of exercises per level (level-progression + exercise-bank specs:
 * "exactly 10 levels of 10 exercises each").
 */
export const LEVEL_SIZE = 10;

/**
 * Minimum score (out of 10) to pass a level (scoring-feedback + level-
 * progression specs: "at least 9 out of 10 (90%)"). `score >= PASS_THRESHOLD`
 * marks the level passed and unlocks the next.
 */
export const PASS_THRESHOLD = 9;

/**
 * Total number of levels (1–10). `LevelId` is the union `1 | 2 | ... | 10`.
 */
export const LEVEL_COUNT = 10;

/**
 * Validate and coerce a `difficulty` value into a `LevelId`, or return `null`
 * when it is missing or out of range. Used by `buildLevels` and by catalog
 * validation helpers that need to narrow `number` → `LevelId`.
 *
 * Pure function: no I/O, no mutation.
 */
export function toLevelId(value: unknown): LevelId | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value)) return null;
  if (value < 1 || value > LEVEL_COUNT) return null;
  return value as LevelId;
}

/**
 * Build the 10 levels from the flat exercise catalog by grouping exercises on
 * `difficulty` (design.md: `difficulty === levelId`).
 *
 * The result is ordered Level 1 → Level 10. Each level contains the catalog
 * exercises whose `difficulty` equals its id, in catalog order. Levels with no
 * exercises are still emitted (with an empty `exercises` array) so callers can
 * index by id without `undefined` checks; the catalog validator flags empty
 * buckets as a build error.
 *
 * The returned `Level.exercises` arrays are fresh arrays (not aliases of the
 * catalog's internal storage), but the `Exercise` objects inside are shared by
 * reference with the catalog — they are treated as read-only by convention
 * (`readonly Exercise[]`).
 *
 * Pure function: no I/O, no mutation of the input. It does not throw; callers
 * that need strict validation should run `validateCatalog` first (which
 * enforces the 10-per-bucket partition) or `assertValidLevels`.
 *
 * Spec references:
 * - exercise-bank: "exactly 10 levels of 10 records each, using each exercise's
 *   `difficulty` to order levels from easiest (Level 1) to hardest (Level 10)".
 * - level-progression: "exactly 10 levels of 10 exercises each, using all 100
 *   exercises exactly once, ordered from Level 1 (easiest) to Level 10
 *   (hardest) by each exercise's `difficulty` value".
 */
export function buildLevels(
  exercises: readonly Exercise[],
): readonly Level[] {
  const buckets = new Map<LevelId, Exercise[]>();
  for (let id = 1; id <= LEVEL_COUNT; id += 1) {
    buckets.set(id as LevelId, []);
  }

  for (const exercise of exercises) {
    const id = toLevelId(exercise.difficulty);
    if (id === null) continue; // invalid difficulties are surfaced by validateCatalog
    buckets.get(id)!.push(exercise);
  }

  const levels: Level[] = [];
  for (let id = 1; id <= LEVEL_COUNT; id += 1) {
    const levelId = id as LevelId;
    levels.push({
      id: levelId,
      label: levelLabel(levelId),
      exercises: buckets.get(levelId)!,
    });
  }
  return levels;
}

/**
 * Resolve a level by id from a prebuilt level list. Returns `undefined` when
 * the id is out of range or the list was not built with that level. Callers
 * that hold the full `buildLevels()` output can index it directly; this helper
 * exists for tests and callers that receive a subset.
 *
 * Pure function: no I/O, no mutation.
 */
export function getLevel(
  levels: readonly Level[],
  id: LevelId,
): Level | undefined {
  return levels.find((level) => level.id === id);
}

/**
 * Human-readable label for a level id ("Level 1" … "Level 10"). Kept here so
 * the UI and tests share one label source.
 */
export function levelLabel(id: LevelId): string {
  return `Level ${id}`;
}