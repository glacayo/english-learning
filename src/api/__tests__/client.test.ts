import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  claimName,
  submitScore,
  getLeaderboard,
  createAttemptId,
  type ApiError,
} from '../client';
import type { LeaderboardEntry } from '../../domain/types';

const BASE = '/.netlify/functions';

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockFetchOnce(res: Response | Error): void {
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
    if (res instanceof Error) throw res;
    return res;
  });
}

describe('claimName', () => {
  it('short-circuits with ok:false invalid on empty/whitespace name (no fetch)', async () => {
    const r = await claimName({ name: '   ' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({ ok: false, reason: 'invalid' });
    }
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('trims the name before sending', async () => {
    mockFetchOnce(jsonRes({ ok: true, name: 'Maria' }));
    await claimName({ name: '  Maria  ' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/claim-name`,
      expect.objectContaining({ method: 'POST' }),
    );
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(call[1].body)).toEqual({ name: 'Maria' });
  });

  it('returns ok:true value on success (first claim)', async () => {
    mockFetchOnce(jsonRes({ ok: true, name: 'Maria' }));
    const r = await claimName({ name: 'Maria' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ ok: true, name: 'Maria' });
  });

  it('returns ok:true value on success (retake — already claimed still succeeds)', async () => {
    // Server returns the reserved canonical spelling, not the typed casing.
    mockFetchOnce(jsonRes({ ok: true, name: 'Maria' }));
    const r = await claimName({ name: 'maria ' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ ok: true, name: 'Maria' });
  });

  it('returns unavailable ApiError when fetch throws', async () => {
    mockFetchOnce(new Error('network'));
    const r = await claimName({ name: 'Maria' });
    expect(r.ok).toBe(false);
    const err = r as ApiError;
    expect(err.reason).toBe('unavailable');
  });

  it('returns bad-status ApiError on non-2xx', async () => {
    mockFetchOnce(jsonRes({ error: 'boom' }, 500));
    const r = await claimName({ name: 'Maria' });
    expect(r.ok).toBe(false);
    const err = r as ApiError;
    expect(err.reason).toBe('bad-status');
    expect(err.status).toBe(500);
  });

  it('returns bad-response ApiError when body is not JSON', async () => {
    mockFetchOnce(new Response('not json', { status: 200 }));
    const r = await claimName({ name: 'Maria' });
    expect(r.ok).toBe(false);
    const err = r as ApiError;
    expect(err.reason).toBe('bad-response');
  });
});

describe('submitScore', () => {
  it('posts the full payload and returns ok on success', async () => {
    mockFetchOnce(jsonRes({ ok: true }));
    const r = await submitScore({ name: 'Maria', score: 90, attemptId: 'A' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ ok: true });
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(call[1].body)).toEqual({ name: 'Maria', score: 90, attemptId: 'A' });
  });

  it('returns unavailable on network failure (retry safe with same attemptId)', async () => {
    mockFetchOnce(new Error('network'));
    const r = await submitScore({ name: 'Maria', score: 90, attemptId: 'A' });
    expect(r.ok).toBe(false);
    const err = r as ApiError;
    expect(err.reason).toBe('unavailable');
  });
});

describe('getLeaderboard', () => {
  it('returns ranked entries on success (bare array contract + client-side sort)', async () => {
    const entries: LeaderboardEntry[] = [
      { attemptId: 'B', name: 'Maria', score: 70, timestamp: 10 },
      { attemptId: 'A', name: 'Marco', score: 90, timestamp: 5 },
      { attemptId: 'C', name: 'Maria', score: 90, timestamp: 5 }, // retake, same score/time as A -> name asc
    ];
    // design.md: GET /get-leaderboard → LeaderboardEntry[] (bare array)
    mockFetchOnce(jsonRes(entries));
    const r = await getLeaderboard();
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Same score 90 and timestamp 5 -> normalized name asc: "marco" < "maria"
      // (c < i), so A (Marco) ranks above C (Maria); B (70) last.
      expect(r.value.map((e) => e.attemptId)).toEqual(['A', 'C', 'B']);
    }
  });

  it('returns bad-response for wrapped { entries } shape (not the design contract)', async () => {
    mockFetchOnce(
      jsonRes({
        entries: [{ attemptId: 'A', name: 'Maria', score: 90, timestamp: 5 }],
      }),
    );
    const r = await getLeaderboard();
    expect(r.ok).toBe(false);
    const err = r as ApiError;
    expect(err.reason).toBe('bad-response');
  });

  it('returns bad-response when body is not a JSON array', async () => {
    mockFetchOnce(jsonRes({}));
    const r = await getLeaderboard();
    expect(r.ok).toBe(false);
    const err = r as ApiError;
    expect(err.reason).toBe('bad-response');
  });

  it('returns unavailable when fetch throws', async () => {
    mockFetchOnce(new Error('network'));
    const r = await getLeaderboard();
    expect(r.ok).toBe(false);
    const err = r as ApiError;
    expect(err.reason).toBe('unavailable');
  });

  it('respects a custom baseURL', async () => {
    mockFetchOnce(jsonRes([]));
    await getLeaderboard({ baseURL: 'https://example.com/api' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://example.com/api/get-leaderboard',
      expect.anything(),
    );
  });
});

describe('createAttemptId', () => {
  it('returns a non-empty string', () => {
    const id = createAttemptId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns distinct ids across calls (retake independence)', () => {
    const a = createAttemptId();
    const b = createAttemptId();
    expect(a).not.toBe(b);
  });

  it('uses crypto.randomUUID when available', () => {
    const uuidSpy = vi.fn().mockReturnValue('uuid-1');
    vi.stubGlobal('crypto', { randomUUID: uuidSpy });
    expect(createAttemptId()).toBe('uuid-1');
    expect(uuidSpy).toHaveBeenCalled();
  });
});