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
 *                    timestamp }`. Written with `onlyIfNew` so a retry on the
 *                    same `attemptId` does NOT create a duplicate row, while a
 *                    new `attemptId` (retake) creates a new row.
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
import { normalizeName, rankEntries } from '../../src/domain/leaderboard';
import type { LeaderboardEntry } from '../../src/domain/types';

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
    return (await this.store.get(key, { type: 'json' })) as unknown | null;
  }

  async setJSON(
    key: string,
    data: unknown,
    options?: { onlyIfNew?: boolean },
  ): Promise<{ modified: boolean }> {
    return this.store.setJSON(key, data, options);
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
  const claim: NameClaim = { displayName: trimmed, claimedAt: Date.now() };
  const result = await store.setJSON(key, claim, { onlyIfNew: true });

  if (result.modified) {
    return { ok: true, name: trimmed };
  }
  // Already claimed identity — retake. Return the reserved canonical display
  // name so cross-device clients converge on one spelling.
  const existing = (await store.getJSON(key)) as NameClaim | null;
  return { ok: true, name: existing?.displayName ?? trimmed };
}

/**
 * Submit a leaderboard entry keyed by `attemptId` (shared-leaderboard spec).
 * Idempotent: a retry on the same `attemptId` MUST NOT create a second row and
 * MUST still indicate success. The server stamps `timestamp`.
 *
 * Returns `{ ok: true }` whether the write was new (`modified: true`) or a
 * no-op retry (`modified: false`). Rejects invalid payloads defensively
 * (empty name, non-finite score, empty attemptId).
 */
export async function submitScore(
  store: StoreLike,
  payload: { name: string; score: number; attemptId: string },
): Promise<{ ok: true } | { ok: false; reason: 'invalid' }> {
  const name = (payload.name ?? '').trim();
  const score = Number(payload.score);
  const attemptId = (payload.attemptId ?? '').trim();
  if (
    name.length === 0 ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 100 ||
    attemptId.length === 0
  ) {
    return { ok: false, reason: 'invalid' };
  }

  const entry: LeaderboardEntry = {
    attemptId,
    name,
    score,
    timestamp: Date.now(),
  };
  // Idempotent: same attemptId retry returns success without a second row.
  await store.setJSON(attemptId, entry, { onlyIfNew: true });
  return { ok: true };
}

/**
 * List every leaderboard entry and rank it (shared-leaderboard spec: score desc
 * → timestamp asc → normalized name asc → attemptId asc). Returns the bare
 * ranked `LeaderboardEntry[]` per the design API contract. Malformed blobs are
 * skipped defensively so one bad entry never blanks the whole board.
 */
export async function getRankedLeaderboard(
  store: StoreLike,
): Promise<LeaderboardEntry[]> {
  const keys = await store.listKeys();
  const entries: LeaderboardEntry[] = [];
  for (const key of keys) {
    const raw = (await store.getJSON(key)) as Partial<LeaderboardEntry> | null;
    if (!raw) continue;
    if (!isValidEntry(raw)) continue;
    entries.push(raw as LeaderboardEntry);
  }
  return rankEntries(entries);
}

/** Runtime shape check for a leaderboard entry read from a blob. */
function isValidEntry(raw: Partial<LeaderboardEntry>): boolean {
  return (
    typeof raw.attemptId === 'string' &&
    raw.attemptId.length > 0 &&
    typeof raw.name === 'string' &&
    typeof raw.score === 'number' &&
    Number.isFinite(raw.score) &&
    typeof raw.timestamp === 'number' &&
    Number.isFinite(raw.timestamp)
  );
}