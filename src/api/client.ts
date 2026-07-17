import type {
  ClaimNameRequest,
  ClaimNameResponse,
  LeaderboardEntry,
  SubmitScoreRequest,
  SubmitScoreResponse,
} from '../domain/types';
import { rankEntries } from '../domain/leaderboard';

/**
 * Typed fetch wrappers for the three Netlify Functions
 * (claim-name, submit-score, get-leaderboard).
 *
 * These wrappers are the single I/O boundary in the client. They never throw
 * on transport/HTTP failures — instead they return a discriminated `ApiResult`
 * so the UI can always fall back to local results when the API is unavailable
 * (shared-leaderboard spec: "the student MUST still see their own results").
 *
 * PR 3 ships these wrappers BEFORE the functions exist (PR 4), so every call
 * will resolve to `{ ok: false, reason: 'unavailable' }` in local/dev. The UI
 * treats that as "leaderboard offline — local results still shown".
 *
 * Endpoints default to the Netlify Functions convention
 * (`/.netlify/functions/<name>`) and can be overridden via the optional
 * `baseURL` for tests or alternate deployments.
 */

export type ApiErrorReason =
  | 'unavailable' // network failure, DNS, function not deployed, CORS
  | 'bad-status' // non-2xx response
  | 'bad-response'; // response body could not be parsed / shape mismatch

export interface ApiError {
  ok: false;
  reason: ApiErrorReason;
  /** HTTP status when known (bad-status). */
  status?: number;
  /** Short human hint, never the raw error object. */
  message: string;
}

export type ApiSuccess<T> = { ok: true; value: T };
export type ApiResult<T> = ApiSuccess<T> | ApiError;

export interface ApiClientOptions {
  /** Base URL for function endpoints. Defaults to `/.netlify/functions`. */
  baseURL?: string;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

const DEFAULT_BASE = '/.netlify/functions';

function endpoint(base: string, name: string): string {
  return `${base.replace(/\/$/, '')}/${name}`;
}

function toError(reason: ApiErrorReason, message: string, status?: number): ApiError {
  return { ok: false, reason, status, message };
}

async function postJSON<T>(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    return toError(
      'unavailable',
      'No se pudo conectar con el servidor. Mostrando resultados locales.',
    );
  }

  if (!res.ok) {
    return toError(
      'bad-status',
      `El servidor respondió ${res.status}. Mostrando resultados locales.`,
      res.status,
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return toError('bad-response', 'Respuesta del servidor no válida.');
  }

  return { ok: true, value: data as T };
}

async function getJSON<T>(url: string, signal?: AbortSignal): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch {
    return toError(
      'unavailable',
      'No se pudo conectar con el servidor. Mostrando resultados locales.',
    );
  }

  if (!res.ok) {
    return toError(
      'bad-status',
      `El servidor respondió ${res.status}. Mostrando resultados locales.`,
      res.status,
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return toError('bad-response', 'Respuesta del servidor no válida.');
  }

  return { ok: true, value: data as T };
}

/**
 * Claim a student name (retake-safe). The server normalizes to a stable
 * identity key (trim + case-fold) and allows the same display name to start
 * another attempt. Empty/whitespace-only names are rejected client-side here
 * before any network call.
 *
 * On success returns `{ ok: true, value: { ok: true, name } }`. On an invalid
 * name it short-circuits with `{ ok: true, value: { ok: false, reason: 'invalid' } }`
 * (no network). On transport failure returns an `ApiError`.
 */
export async function claimName(
  request: ClaimNameRequest,
  options: ApiClientOptions = {},
): Promise<ApiResult<ClaimNameResponse>> {
  const trimmed = request.name.trim();
  if (trimmed.length === 0) {
    return {
      ok: true,
      value: { ok: false, reason: 'invalid' },
    };
  }

  const base = options.baseURL ?? DEFAULT_BASE;
  return postJSON<ClaimNameResponse>(
    endpoint(base, 'claim-name'),
    { name: trimmed },
    options.signal,
  );
}

/**
 * Submit a completed attempt's score. `attemptId` is the idempotency key
 * (shared-leaderboard spec): the same `attemptId` retry MUST NOT create a
 * duplicate row, so retrying on transport failure is always safe.
 */
export async function submitScore(
  request: SubmitScoreRequest,
  options: ApiClientOptions = {},
): Promise<ApiResult<SubmitScoreResponse>> {
  const base = options.baseURL ?? DEFAULT_BASE;
  return postJSON<SubmitScoreResponse>(
    endpoint(base, 'submit-score'),
    request,
    options.signal,
  );
}

/**
 * Fetch the shared leaderboard and rank it client-side using the pure
 * `rankEntries` (score desc → timestamp asc → normalized name asc →
 * attemptId asc). The leaderboard lists every attempt row; retakes produce
 * multiple rows per display name (shared-leaderboard spec).
 *
 * Contract (design.md, authoritative for PR 4):
 *   `GET /get-leaderboard → LeaderboardEntry[]`
 * A bare JSON array is required. Wrapped shapes such as `{ entries: [...] }`
 * are treated as `bad-response` so the Netlify function and client stay
 * unambiguous.
 *
 * On transport failure returns an `ApiError`; the UI falls back to local /
 * empty results. The ranking is deterministic and independent of the server.
 */
export async function getLeaderboard(
  options: ApiClientOptions = {},
): Promise<ApiResult<LeaderboardEntry[]>> {
  const base = options.baseURL ?? DEFAULT_BASE;
  const result = await getJSON<unknown>(
    endpoint(base, 'get-leaderboard'),
    options.signal,
  );
  if (!result.ok) return result;
  if (!Array.isArray(result.value)) {
    return toError('bad-response', 'Respuesta del servidor no válida.');
  }
  return { ok: true, value: rankEntries(result.value as LeaderboardEntry[]) };
}

/**
 * Generate a client-side `attemptId`. Each attempt/retake gets a fresh id
 * (student-session + shared-leaderboard specs). Used as the leaderboard write
 * idempotency key. Kept here so the UI has one place to swap the strategy.
 *
 * Uses `crypto.randomUUID` when available and falls back to a timestamp +
 * random string for older environments.
 */
export function createAttemptId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type { ClaimNameRequest, ClaimNameResponse, SubmitScoreRequest, SubmitScoreResponse, LeaderboardEntry };