import type { LeaderboardEntry, LevelId } from './types';

/**
 * Normalize a display name into a stable identity key (student-session +
 * shared-leaderboard specs): `trim` + case-fold (lowercase).
 *
 * "Maria", "maria ", and "MARIA" all collapse to `"maria"`. This is the single
 * source of truth for name identity used by claim-name (PR4), the leaderboard
 * tie-break (here), and any UI that compares names.
 *
 * Pure function: no I/O, no mutation.
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * The leaderboard view in use. `global` ranks every level together with a
 * level-aware primary key; `per-level` ranks a single level's rows by score
 * first (shared-leaderboard spec).
 */
export type LeaderboardView = 'global' | 'per-level';

/**
 * Rank leaderboard entries per the shared-leaderboard spec.
 *
 * The active `view` changes the primary ranking keys (spec "Ranking"):
 *   - Global view: `level` desc → `score` desc → `timestamp` asc →
 *     normalized name asc → `attemptId` asc. Higher levels outrank lower
 *     levels regardless of score, so a perfect Level 1 never outranks a
 *     harder-level attempt.
 *   - Per-level view: `score` desc → `timestamp` asc → normalized name asc →
 *     `attemptId` asc. (All rows share one level, so the level key is dropped.)
 *
 * Tie-breaks (same primary keys for the active view) are identical across
 * views: earlier `timestamp` first; if equal, lower normalized name; if still
 * equal, lower `attemptId`.
 *
 * The leaderboard lists **every** submitted attempt row; it does NOT collapse
 * to best-score-only (multiple rows per display name are allowed for retakes).
 *
 * Pure function: returns a new array; does not mutate the input.
 */
export function rankEntries(
  entries: readonly LeaderboardEntry[],
  view: LeaderboardView = 'global',
): LeaderboardEntry[] {
  return [...entries].sort((a, b) => compareEntries(a, b, view));
}

/**
 * Comparator implementing the deterministic tie-break order for the given
 * view. Exported for direct use in tests and by callers that already hold a
 * mutable array.
 *
 * In the global view, higher `level` ranks first. In the per-level view every
 * row belongs to one level so the level key is never consulted. Callers MUST
 * pass valid public `LeaderboardEntry` rows (`level` required); raw/legacy
 * blobs are filtered in the store before ranking.
 */
export function compareEntries(
  a: LeaderboardEntry,
  b: LeaderboardEntry,
  view: LeaderboardView = 'global',
): number {
  if (view === 'global') {
    if (a.level !== b.level) return b.level - a.level;
  }
  if (a.score !== b.score) return b.score - a.score;
  if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
  const nameA = normalizeName(a.name);
  const nameB = normalizeName(b.name);
  if (nameA !== nameB) return nameA < nameB ? -1 : 1;
  if (a.attemptId !== b.attemptId)
    return a.attemptId < b.attemptId ? -1 : 1;
  return 0;
}

/**
 * Filter leaderboard entries to a single `level`. Returns a new array; does
 * not mutate the input. Public entries always carry `level` (PR3 contract).
 */
export function filterByLevel(
  entries: readonly LeaderboardEntry[],
  level: LevelId,
): LeaderboardEntry[] {
  return entries.filter((e) => e.level === level);
}