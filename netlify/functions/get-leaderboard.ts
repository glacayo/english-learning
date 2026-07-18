/**
 * Netlify Function: get-leaderboard
 *
 * `GET /get-leaderboard[?level=N] → LeaderboardEntry[]`
 *
 * shared-leaderboard spec. Returns the bare ranked `LeaderboardEntry[]` JSON
 * array (design API contract) — one best row per normalized student name,
 * ranked by the active view:
 *   - No `level` (global): `level` desc → `score` desc → `timestamp` asc →
 *     normalized name asc → `attemptId` asc. Higher levels outrank lower.
 *   - `?level=N` (per-level): only Level N rows, ranked by `score` desc then
 *     the same ties.
 *
 * `level` MUST be an integer in 1–10 when present. A non-integer or
 * out-of-range `level` is rejected with 400. Retakes may persist multiple
 * rows, but the active view collapses to the best-ranked row per name.
 *
 * PR 3: legacy rows (no `level`, 0–100 score) are hidden from reads by
 * `isValidEntry` and removed once by `scripts/reset-leaderboard.mjs`.
 */

import { getLeaderboardStore, getRankedLeaderboard, type StoreLike } from './_store';
import { json, withStoreReporting } from './_http';
import { toLeaderboardLevel } from './_leaderboard-classifier.mjs';
import type { LeaderboardEntry, LevelId } from '../../src/domain/types';

/** Pure handler with an injectable store — the unit-test entry point. */
export async function handler(
  store: StoreLike,
  request: Request,
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'method-not-allowed' }, 405);
  }

  // Parse optional ?level=N filter. Reject non-integer / out-of-range with 400
  // (netlify-deployment spec: "Leaderboard read endpoint filters by level").
  let level: LevelId | undefined;
  const url = new URL(request.url);
  const levelParam = url.searchParams.get('level');
  if (levelParam !== null) {
    const parsed = toLeaderboardLevel(Number(levelParam));
    if (parsed === null) {
      return json({ error: 'invalid-level' }, 400);
    }
    level = parsed;
  }

  return withStoreReporting('get-leaderboard', async () => {
    const entries = await getRankedLeaderboard(store, level);
    return json(entries as LeaderboardEntry[], 200);
  }, { error: 'internal' });
}

/** Netlify deploy entry point — resolves the store from Netlify env. */
export default async (request: Request): Promise<Response> => {
  return handler(getLeaderboardStore(), request);
};
