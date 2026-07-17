/**
 * Netlify Function: submit-score
 *
 * `POST /submit-score { name, score, attemptId } → { ok: true } | { ok: false, reason: 'invalid' }`
 *
 * shared-leaderboard spec. Idempotent by client `attemptId`: the server stamps
 * `timestamp` and writes the entry blob keyed by `attemptId` with create-if-
 * absent. A retry on the same `attemptId` returns `{ ok: true }` WITHOUT
 * creating a duplicate row; a new `attemptId` (retake) creates a new row.
 */

import { getLeaderboardStore, submitScore, type StoreLike } from './_store';
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

  try {
    const result = await submitScore(store, {
      name: typeof body?.name === 'string' ? body.name : '',
      score: typeof body?.score === 'number' ? body.score : NaN,
      attemptId: typeof body?.attemptId === 'string' ? body.attemptId : '',
    });
    return json(result as SubmitScoreResponse, result.ok ? 200 : 400);
  } catch (err) {
    console.error('[submit-score] store operation failed', err);
    return json({ ok: false, error: 'internal' }, 500);
  }
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