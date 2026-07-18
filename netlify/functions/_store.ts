/**
 * Netlify Blobs helpers for the English Exercise App serverless API.
 *
 * Two stores back the shared state (design.md, netlify-deployment +
 * student-session + shared-leaderboard specs):
 *
 *   - `names`      — one blob per normalized display name identity. Key =
 *                    `normalizeName(name)`; value = `{ displayName, claimedAt }`.
 *                    Written with `onlyIfNew` so the FIRST claim reserves the
 *                    identity; a retake (same normalized key) MUST still succeed
 *                    and return the reserved display name.
 *   - `leaderboard` — one blob per attempt. Key = client `attemptId` (the
 *                    idempotency key); value = `{ attemptId, name, score,
 *                    level, timestamp }`. Written with `onlyIfNew` so a retry
 *                    on the same `attemptId` does NOT create a duplicate row,
 *                    while a new `attemptId` (retake) creates a new row.
 *
 * PR 3 level-aware schema: `score` is an integer 0–10 and `level` is an
 * integer 1–10 on every row. Legacy 0–100 rows without `level` are rejected
 * on read (`isValidEntry`) and are removed once by
 * `scripts/reset-leaderboard.mjs` before level-aware writes begin.
 *
 * The pure ranking/tie-break lives in `src/domain/leaderboard.ts`; this module
 * only handles persistence + listing. Tests inject a `StoreLike` so handlers
 * can be unit-tested without Netlify Blobs.
 *
 * Spec references:
 * - student-session: normalized identity, retakes allowed, new attemptId per retake
 * - shared-leaderboard: idempotent submit by attemptId, every attempt is a row
 * - netlify-deployment: shared persistence across function invocations
 */

import { getStore, type Store } from '@netlify/blobs';
import { normalizeName, rankEntries, type LeaderboardView } from '../../src/domain/leaderboard';
import type { LeaderboardEntry, LevelId } from '../../src/domain/types';
import {
  classifyForReset,
  isValidLevelValue,
  isValidScoreValue,
} from './_leaderboard-classifier.mjs';

export { classifyForReset } from './_leaderboard-classifier.mjs';

/** Names store name (Netlify Blobs store identifier). */
export const NAMES_STORE = 'names';
/** Leaderboard entries store name. */
export const LEADERBOARD_STORE = 'leaderboard';

/**
 * Persisted name claim. Keyed by normalized name; `displayName` is the trimmed
 * name from the first claim (so "MARIA " claims identity "maria" and later
 * retakes see the canonical display name).
 */
export interface NameClaim {
  displayName: string;
  claimedAt: number;
}

/**
 * Minimal store surface the handlers depend on. The real Netlify Blobs `Store`
 * satisfies this; tests pass a mock. Kept intentionally narrow so the function
 * handlers stay testable without the Blobs SDK.
 */
export interface StoreLike {
  /** Read a blob and parse it as JSON; `null` when the key is absent. */
  getJSON(key: string): Promise<unknown | null>;
  /**
   * Write a JSON blob. When `onlyIfNew` is true, the write is a no-op (returns
   * `modified: false`) if the key already exists. Otherwise it overwrites.
   * Returns `modified: boolean`.
   */
  setJSON(
    key: string,
    data: unknown,
    options?: { onlyIfNew?: boolean },
  ): Promise<{ modified: boolean }>;
  /** List all blob keys in the store. */
  listKeys(): Promise<string[]>;
}

/**
 * Adapter wrapping a Netlify Blobs `Store` as a `StoreLike`. `getJSON` uses the
 * typed `get(key, { type: 'json' })` call; `listKeys` paginates so large stores
 * stay correct under the 1,000-blob page boundary.
 */
export class BlobsStore implements StoreLike {
  constructor(private readonly store: Store) {}

  async getJSON(key: string): Promise<unknown | null> {
    // Strong consistency so a retake immediately after the first claim sees the
    // reserved display name (eventual reads can miss a just-written blob).
    return (await this.store.get(key, {
      type: 'json',
      consistency: 'strong',
    })) as unknown | null;
  }

  async setJSON(
    key: string,
    data: unknown,
    options?: { onlyIfNew?: boolean },
  ): Promise<{ modified: boolean }> {
    // Workaround for @netlify/blobs setJSON: it spreads conditional options
    // (`...conditions`) into makeRequest instead of nesting them under
    // `conditions`, so `onlyIfNew` is ignored and every write overwrites with
    // `modified: true`. `set()` passes `conditions` correctly.
    const result = await this.store.set(key, JSON.stringify(data), options);
    return { modified: result.modified };
  }

  async listKeys(): Promise<string[]> {
    const keys: string[] = [];
    for await (const page of this.store.list({ paginate: true })) {
      for (const blob of page.blobs) keys.push(blob.key);
    }
    return keys;
  }
}

/**
 * Resolve the `names` store as a `StoreLike`. In production this reads Netlify
 * environment automatically; tests pass an override.
 */
export function getNamesStore(): StoreLike {
  return new BlobsStore(getStore(NAMES_STORE));
}

/** Resolve the `leaderboard` store as a `StoreLike`. */
export function getLeaderboardStore(): StoreLike {
  return new BlobsStore(getStore(LEADERBOARD_STORE));
}

/**
 * Claim a normalized name identity. First claim reserves the identity; a
 * retake (same normalized key) MUST still succeed and return the reserved
 * canonical display name (student-session spec: "MUST allow a returning
 * student to start another attempt using the same display name").
 *
 * Returns `{ ok: true, name: displayName }` on success, or
 * `{ ok: false, reason: 'invalid' }` for an empty/whitespace-only name.
 *
 * The write uses `onlyIfNew`: the first write creates the reservation; a
 * retake hits `modified: false` and we read the existing canonical claim so
 * the client always gets back a valid display name.
 */
export async function claimName(
  store: StoreLike,
  rawName: string,
): Promise<{ ok: true; name: string } | { ok: false; reason: 'invalid' }> {
  const trimmed = rawName.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'invalid' };

  const key = normalizeName(trimmed);

  // Prefer any already-reserved display name so retakes with different casing
  // or extra spaces converge on the first successful claim (e.g. "Maria" then
  // "  maria  " → "Maria"). Read-first also protects against stores that ignore
  // onlyIfNew and would otherwise overwrite the canonical spelling.
  const existing = (await store.getJSON(key)) as NameClaim | null;
  if (
    existing &&
    typeof existing.displayName === 'string' &&
    existing.displayName.trim().length > 0
  ) {
    return { ok: true, name: existing.displayName };
  }

  const claim: NameClaim = { displayName: trimmed, claimedAt: Date.now() };
  const result = await store.setJSON(key, claim, { onlyIfNew: true });

  if (result.modified) {
    return { ok: true, name: trimmed };
  }
  // Concurrent first claim lost the race — return the winner's display name
  // with the same validation as the read-first path (non-empty string only).
  const winner = (await store.getJSON(key)) as NameClaim | null;
  if (
    winner &&
    typeof winner.displayName === 'string' &&
    winner.displayName.trim().length > 0
  ) {
    return { ok: true, name: winner.displayName };
  }
  return { ok: true, name: trimmed };
}

/**
 * Submit a leaderboard entry keyed by `attemptId` (shared-leaderboard spec).
 * Idempotent: a retry on the same `attemptId` MUST NOT create a second row and
 * MUST still indicate success. The server stamps `timestamp`.
 *
 * Returns `{ ok: true }` whether the write was new (`modified: true`) or a
 * no-op retry (`modified: false`). Rejects invalid payloads defensively
 * (empty name, non-integer / out-of-range `score`, non-integer / out-of-range
 * `level`, empty `attemptId`).
 *
 * PR 3 level-aware schema (netlify-deployment spec): `score` MUST be an
 * integer in 0–10 and `level` MUST be an integer in 1–10. Non-integer
 * (`9.5`, `3.2`) and out-of-range values are rejected. Legacy-shaped rows
 * (no `level`, 0–100 score) are no longer produced; legacy rows written
 * before PR3 MUST be removed by `scripts/reset-leaderboard.mjs`.
 */
export async function submitScore(
  store: StoreLike,
  payload: { name: string; score: number; level?: number; attemptId: string },
): Promise<{ ok: true } | { ok: false, reason: 'invalid' }> {
  const name = (payload.name ?? '').trim();
  const score = Number(payload.score);
  const attemptId = (payload.attemptId ?? '').trim();
  const level = payload.level;
  const levelId = isValidLevelValue(level) ? (level as LevelId) : null;
  if (
    name.length === 0 ||
    !isValidScoreValue(score) ||
    levelId === null ||
    attemptId.length === 0
  ) {
    return { ok: false, reason: 'invalid' };
  }

  const entry: LeaderboardEntry = {
    attemptId,
    name,
    score,
    level: levelId,
    timestamp: Date.now(),
  };
  // Idempotent: same attemptId retry returns success without a second row.
  await store.setJSON(attemptId, entry, { onlyIfNew: true });
  return { ok: true };
}

/**
 * Max concurrent `getJSON` calls when hydrating the leaderboard. Keeps normal
 * loads from scaling as sequential round-trips without unbounded fan-out.
 * Exported for tests that assert concurrent fetch behavior.
 */
export const LEADERBOARD_READ_CONCURRENCY = 16;

/**
 * Run `fn` over `items` with at most `concurrency` in-flight promises.
 * Preserves input order in the result array. Empty input returns `[]`.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

/**
 * List every leaderboard entry and rank it (shared-leaderboard spec). Returns
 * the bare ranked `LeaderboardEntry[]` per the design API contract. Malformed
 * blobs are skipped defensively so one bad entry never blanks the board.
 *
 * PR 3 level-aware schema: `level` is now REQUIRED on every persisted row.
 * Legacy rows missing `level` are treated as invalid (`isValidEntry` returns
 * false) and are hidden from reads — they MUST be removed by the deploy-time
 * `scripts/reset-leaderboard.mjs`. A valid row MUST have integer `level` 1–10
 * and integer `score` 0–10.
 *
 * `level` filter (optional): when provided, only rows whose `level` matches
 * are returned, ranked by the per-level view (score desc then ties). Omitting
 * it returns the global view (level desc → score desc → ties).
 *
 * Reads blob values with bounded concurrency (`LEADERBOARD_READ_CONCURRENCY`)
 * so leaderboard loads do not wait on sequential N+1 round-trips.
 */
export async function getRankedLeaderboard(
  store: StoreLike,
  level?: LevelId,
): Promise<LeaderboardEntry[]> {
  const keys = await store.listKeys();
  const raws = await mapWithConcurrency(
    keys,
    LEADERBOARD_READ_CONCURRENCY,
    (key) => store.getJSON(key),
  );
  const entries: LeaderboardEntry[] = [];
  for (const raw of raws) {
    if (!raw) continue;
    // Validate unknown blob shapes; never trust raw storage as LeaderboardEntry.
    if (!isValidEntry(raw)) continue;
    const entry = raw as LeaderboardEntry;
    if (level !== undefined && entry.level !== level) continue;
    entries.push(entry);
  }
  const view: LeaderboardView = level !== undefined ? 'per-level' : 'global';
  return rankEntries(entries, view);
}

/**
 * Runtime shape check for a leaderboard entry read from a blob.
 *
 * PR 3 level-aware schema: `level` is REQUIRED. A row is valid ONLY when it
 * has integer `level` 1–10 AND integer `score` 0–10 (plus the existing
 * `attemptId`, `name`, `timestamp` checks). Legacy rows without `level` or
 * with a 0–100 score are invalid and hidden from reads — they are cleaned up
 * once by `scripts/reset-leaderboard.mjs` and MUST NOT be displayed.
 */
function isValidEntry(raw: unknown): boolean {
  return classifyForReset(raw).valid;
}
