import type { LeaderboardEntry } from './types';

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
 * Rank leaderboard entries per the shared-leaderboard spec.
 *
 * Sort order (deterministic):
 *   1. score descending (higher score first)
 *   2. timestamp ascending (earlier submission first)
 *   3. normalized name ascending (lower normalized name first)
 *   4. attemptId ascending (lower attemptId first)
 *
 * The leaderboard lists **every** submitted attempt row; it does NOT collapse
 * to best-score-only (multiple rows per display name are allowed for retakes).
 *
 * Pure function: returns a new array; does not mutate the input.
 */
export function rankEntries(
  entries: readonly LeaderboardEntry[],
): LeaderboardEntry[] {
  return [...entries].sort(compareEntries);
}

/**
 * Comparator implementing the deterministic tie-break order. Exported for
 * direct use in tests and by callers that already hold a mutable array.
 */
export function compareEntries(
  a: LeaderboardEntry,
  b: LeaderboardEntry,
): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
  const nameA = normalizeName(a.name);
  const nameB = normalizeName(b.name);
  if (nameA !== nameB) return nameA < nameB ? -1 : 1;
  if (a.attemptId !== b.attemptId)
    return a.attemptId < b.attemptId ? -1 : 1;
  return 0;
}