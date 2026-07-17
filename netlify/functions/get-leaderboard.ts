/**
 * Netlify Function: get-leaderboard
 *
 * `GET /get-leaderboard → LeaderboardEntry[]`
 *
 * shared-leaderboard spec. Returns the bare ranked `LeaderboardEntry[]` JSON
 * array (design API contract) — every submitted attempt row, ranked by score
 * desc → timestamp asc → normalized name asc → attemptId asc. Retakes produce
 * multiple rows per display name (v1 does not collapse to best-only).
 */

import { getLeaderboardStore, getRankedLeaderboard, type StoreLike } from './_store';
import type { LeaderboardEntry } from '../../src/domain/types';

/** Pure handler with an injectable store — the unit-test entry point. */
export async function handler(
  store: StoreLike,
  request: Request,
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'method-not-allowed' }, 405);
  }

  const entries = await getRankedLeaderboard(store);
  return json(entries as LeaderboardEntry[], 200);
}

/** Netlify deploy entry point — resolves the store from Netlify env. */
export default async (request: Request): Promise<Response> => {
  return handler(getLeaderboardStore(), request);
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}