/**
 * Netlify Function: claim-name
 *
 * `POST /claim-name { name } → { ok: true, name } | { ok: false, reason: 'invalid' }`
 *
 * Student-session + shared-leaderboard specs. Normalizes the name (trim +
 * case-fold) to a stable identity key, reserves it idempotently against the
 * `names` Netlify Blobs store, and always succeeds for a valid non-empty name
 * — first claim OR retake (v1 allows the same display name to start another
 * attempt without auth/PIN). Empty/whitespace-only names are rejected.
 */

import { claimName, getNamesStore, type StoreLike } from './_store';
import { json, withStoreReporting } from './_http';
import type { ClaimNameRequest, ClaimNameResponse } from '../../src/domain/types';

/**
 * Pure handler with an injectable store — the unit-test entry point. Kept free
 * of env resolution so tests pass a mock `StoreLike`.
 */
export async function handler(
  store: StoreLike,
  request: Request,
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ ok: false, reason: 'invalid' }, 405);
  }

  let body: Partial<ClaimNameRequest> | undefined;
  try {
    body = (await request.json()) as Partial<ClaimNameRequest>;
  } catch {
    return json({ ok: false, reason: 'invalid' }, 400);
  }

  const name = typeof body?.name === 'string' ? body.name : '';
  return withStoreReporting('claim-name', async () => {
    const result = await claimName(store, name);
    return json(result as ClaimNameResponse, result.ok ? 200 : 400);
  }, { ok: false, error: 'internal' });
}

/** Netlify deploy entry point — resolves the store from Netlify env. */
export default async (request: Request): Promise<Response> => {
  return handler(getNamesStore(), request);
};
