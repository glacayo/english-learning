import { describe, expect, it, vi } from 'vitest';
import type { StoreLike } from '../_store';
import { handler as claimNameHandler } from '../claim-name';
import { handler as submitScoreHandler } from '../submit-score';
import { handler as getLeaderboardHandler } from '../get-leaderboard';

type BlobData = Record<string, unknown>;

function makeStore(initial: BlobData = {}): StoreLike & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>(Object.entries(initial));
  return {
    data,
    async getJSON(key) {
      return data.has(key) ? (data.get(key) as unknown) : null;
    },
    async setJSON(key, value, options) {
      if (options?.onlyIfNew && data.has(key)) return { modified: false };
      data.set(key, value);
      return { modified: true };
    },
    async listKeys() {
      return [...data.keys()];
    },
  };
}

function jsonReq(body: unknown, method = 'POST'): Request {
  return new Request('https://example.test/.netlify/functions/x', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function body<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

describe('claim-name handler', () => {
  it('rejects empty name with 400 and ok:false invalid', async () => {
    const store = makeStore();
    const res = await claimNameHandler(store, jsonReq({ name: '   ' }));
    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('first claim succeeds with 200 and the trimmed name', async () => {
    const store = makeStore();
    const res = await claimNameHandler(store, jsonReq({ name: '  Maria  ' }));
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ ok: true, name: 'Maria' });
  });

  it('retake with same normalized identity still returns 200 and canonical name', async () => {
    const store = makeStore();
    await claimNameHandler(store, jsonReq({ name: 'Maria' }));
    const res = await claimNameHandler(store, jsonReq({ name: 'maria ' }));
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ ok: true, name: 'Maria' });
  });

  it('rejects malformed JSON body with 400', async () => {
    const store = makeStore();
    const req = new Request('https://x.test/fn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    const res = await claimNameHandler(store, req);
    expect(res.status).toBe(400);
  });

  it('rejects non-POST with 405', async () => {
    const store = makeStore();
    const res = await claimNameHandler(store, new Request('https://x.test', { method: 'GET' }));
    expect(res.status).toBe(405);
  });

  it('returns 500 and logs structured report when store operation throws', async () => {
    const err = new Error('blobs down');
    const store: StoreLike = {
      async getJSON() {
        throw err;
      },
      async setJSON() {
        throw err;
      },
      async listKeys() {
        throw err;
      },
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await claimNameHandler(store, jsonReq({ name: 'Maria' }));
    expect(res.status).toBe(500);
    expect(await body(res)).toEqual({ ok: false, error: 'internal' });
    // reportError logs a structured JSON line (not the old free-form string).
    expect(spy).toHaveBeenCalledTimes(1);
    const logged = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logged) as { functionName: string; message: string; errorType?: string };
    expect(parsed.functionName).toBe('claim-name');
    expect(parsed.message).toBe('store operation failed');
    expect(parsed.errorType).toBe('Error');
    spy.mockRestore();
  });
});

describe('submit-score handler — PR3 level-aware schema', () => {
  it('writes a level-aware entry and returns ok:true on valid payload', async () => {
    const store = makeStore();
    const res = await submitScoreHandler(store, jsonReq({ name: 'Maria', score: 9, level: 1, attemptId: 'att-1' }));
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ ok: true });
    expect(store.data.has('att-1')).toBe(true);
    expect((store.data.get('att-1') as { level?: number }).level).toBe(1);
  });

  it('is idempotent: retry same attemptId returns ok:true without a duplicate row', async () => {
    const store = makeStore();
    await submitScoreHandler(store, jsonReq({ name: 'Maria', score: 9, level: 1, attemptId: 'att-1' }));
    const sizeBefore = store.data.size;
    const res = await submitScoreHandler(store, jsonReq({ name: 'Maria', score: 9, level: 1, attemptId: 'att-1' }));
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ ok: true });
    expect(store.data.size).toBe(sizeBefore);
  });

  it('rejects missing level with 400', async () => {
    const store = makeStore();
    const res = await submitScoreHandler(store, jsonReq({ name: 'Maria', score: 9, attemptId: 'a' }));
    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects non-integer score (9.5) with 400', async () => {
    const store = makeStore();
    const res = await submitScoreHandler(store, jsonReq({ name: 'Maria', score: 9.5, level: 1, attemptId: 'a' }));
    expect(res.status).toBe(400);
  });

  it('rejects out-of-range level (0) with 400', async () => {
    const store = makeStore();
    const res = await submitScoreHandler(store, jsonReq({ name: 'Maria', score: 9, level: 0, attemptId: 'a' }));
    expect(res.status).toBe(400);
  });

  it('rejects invalid payload with 400', async () => {
    const store = makeStore();
    const res = await submitScoreHandler(store, jsonReq({ name: '', score: 9, level: 1, attemptId: 'a' }));
    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects non-POST with 405', async () => {
    const store = makeStore();
    const res = await submitScoreHandler(store, new Request('https://x.test', { method: 'GET' }));
    expect(res.status).toBe(405);
  });

  it('returns 500 and logs structured report when store operation throws', async () => {
    const err = new Error('blobs down');
    const store: StoreLike = {
      async getJSON() {
        throw err;
      },
      async setJSON() {
        throw err;
      },
      async listKeys() {
        throw err;
      },
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await submitScoreHandler(
      store,
      jsonReq({ name: 'Maria', score: 9, level: 1, attemptId: 'att-1' }),
    );
    expect(res.status).toBe(500);
    expect(await body(res)).toEqual({ ok: false, error: 'internal' });
    expect(spy).toHaveBeenCalledTimes(1);
    const logged = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logged) as { functionName: string; message: string };
    expect(parsed.functionName).toBe('submit-score');
    expect(parsed.message).toBe('store operation failed');
    spy.mockRestore();
  });
});

describe('get-leaderboard handler — global + ?level filter', () => {
  it('returns bare ranked LeaderboardEntry[] on GET (global view, level-aware rank)', async () => {
    const store = makeStore({
      'att-1': { attemptId: 'att-1', name: 'Maria', score: 10, level: 1, timestamp: 10_000 },
      'att-2': { attemptId: 'att-2', name: 'Marco', score: 7, level: 10, timestamp: 20_000 },
    });
    const res = await getLeaderboardHandler(store, new Request('https://x.test', { method: 'GET' }));
    expect(res.status).toBe(200);
    const entries = await body<{ attemptId: string; score: number }[]>(res);
    expect(Array.isArray(entries)).toBe(true);
    // Level 10 (score 7) ranks above Level 1 (score 10) in the global view.
    expect(entries.map((e) => e.attemptId)).toEqual(['att-2', 'att-1']);
  });

  it('returns [] for an empty store', async () => {
    const store = makeStore();
    const res = await getLeaderboardHandler(store, new Request('https://x.test', { method: 'GET' }));
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual([]);
  });

  it('filters by ?level=N and ranks by score desc (per-level view)', async () => {
    const store = makeStore({
      'l1-a': { attemptId: 'l1-a', name: 'Ana', score: 9, level: 1, timestamp: 10 },
      'l2-a': { attemptId: 'l2-a', name: 'Bob', score: 5, level: 2, timestamp: 10 },
      'l2-b': { attemptId: 'l2-b', name: 'Cat', score: 9, level: 2, timestamp: 20 },
    });
    const res = await getLeaderboardHandler(store, new Request('https://x.test/?level=2', { method: 'GET' }));
    expect(res.status).toBe(200);
    const entries = await body<{ attemptId: string }[]>(res);
    expect(entries.map((e) => e.attemptId)).toEqual(['l2-b', 'l2-a']);
  });

  it('rejects non-integer ?level=3.2 with 400', async () => {
    const store = makeStore();
    const res = await getLeaderboardHandler(store, new Request('https://x.test/?level=3.2', { method: 'GET' }));
    expect(res.status).toBe(400);
  });

  it('rejects out-of-range ?level=0 with 400', async () => {
    const store = makeStore();
    const res = await getLeaderboardHandler(store, new Request('https://x.test/?level=0', { method: 'GET' }));
    expect(res.status).toBe(400);
  });

  it('hides legacy rows without level in the global view', async () => {
    const store = makeStore({
      'legacy': { attemptId: 'legacy', name: 'Old', score: 85, timestamp: 10_000 },
      'att-2': { attemptId: 'att-2', name: 'Marco', score: 9, level: 1, timestamp: 20_000 },
    });
    const res = await getLeaderboardHandler(store, new Request('https://x.test', { method: 'GET' }));
    expect(res.status).toBe(200);
    const entries = await body<{ attemptId: string }[]>(res);
    expect(entries.map((e) => e.attemptId)).toEqual(['att-2']);
  });

  it('rejects non-GET with 405', async () => {
    const store = makeStore();
    const res = await getLeaderboardHandler(store, new Request('https://x.test', { method: 'POST' }));
    expect(res.status).toBe(405);
  });

  it('returns 500 and logs structured report when store operation throws', async () => {
    const err = new Error('blobs down');
    const store: StoreLike = {
      async getJSON() {
        throw err;
      },
      async setJSON() {
        throw err;
      },
      async listKeys() {
        throw err;
      },
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await getLeaderboardHandler(
      store,
      new Request('https://x.test', { method: 'GET' }),
    );
    expect(res.status).toBe(500);
    expect(await body(res)).toEqual({ error: 'internal' });
    expect(spy).toHaveBeenCalledTimes(1);
    const logged = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logged) as { functionName: string; message: string };
    expect(parsed.functionName).toBe('get-leaderboard');
    expect(parsed.message).toBe('store operation failed');
    spy.mockRestore();
  });
});