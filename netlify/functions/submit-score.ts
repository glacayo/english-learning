/**
 * Netlify Function: submit-score
 *
 * `POST /submit-score { name, score, level, attemptId } → { ok: true } | { ok: false, reason: 'invalid' }`
 *
 * shared-leaderboard spec. Idempotent by client `attemptId`: the server stamps
 * `timestamp` and writes the entry blob keyed by `attemptId` with create-if-
 * absent. A retry on the same `attemptId` returns `{ ok: true }` WITHOUT
 * creating a duplicate row; a new `attemptId` (retake) creates a new row.
 *
 * PR 3 level-aware schema (netlify-deployment spec): `score` MUST be an
 * integer in 0–10 and `level` MUST be an integer in 1–10. Non-integer
 * (`9.5`, `3.2`) and out-of-range values are rejected with a 400. Legacy
 * rows (no `level`, 0–100 score) are no longer accepted; they are removed
 * once by `scripts/reset-leaderboard.mjs` before level-aware writes begin.
 */

import { getLeaderboardStore, submitScore, type StoreLike } from './_store';
import { json, withStoreReporting } from './_http';
import type { SubmitScoreRequest, SubmitScoreResponse } from '../../src/domain/types';

/** Pure handler with an injectable store — the unit-test entry point. */
export async function handler(
  store: StoreLike,
  request: Request,
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ ok: false, reason: 'invalid' }, 405);
  }

  let body: Partial<SubmitScoreRequest> | undefined;
  try {
    body = (await request.json()) as Partial<SubmitScoreRequest>;
  } catch {
    return json({ ok: false, reason: 'invalid' }, 400);
  }

  return withStoreReporting('submit-score', async () => {
    const result = await submitScore(store, {
      name: typeof body?.name === 'string' ? body.name : '',
      score: typeof body?.score === 'number' ? body.score : NaN,
      level: typeof body?.level === 'number' ? body.level : undefined,
      attemptId: typeof body?.attemptId === 'string' ? body.attemptId : '',
    });
    return json(result as SubmitScoreResponse, result.ok ? 200 : 400);
  }, { ok: false, error: 'internal' });
}

/** Netlify deploy entry point — resolves the store from Netlify env. */
export default async (request: Request): Promise<Response> => {
  return handler(getLeaderboardStore(), request);
};
