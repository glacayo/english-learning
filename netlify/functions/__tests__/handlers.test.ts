import { describe, expect, it } from 'vitest';
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
});

describe('submit-score handler', () => {
  it('writes an entry and returns ok:true on valid payload', async () => {
    const store = makeStore();
    const res = await submitScoreHandler(store, jsonReq({ name: 'Maria', score: 90, attemptId: 'att-1' }));
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ ok: true });
    expect(store.data.has('att-1')).toBe(true);
  });

  it('is idempotent: retry same attemptId returns ok:true without a duplicate row', async () => {
    const store = makeStore();
    await submitScoreHandler(store, jsonReq({ name: 'Maria', score: 90, attemptId: 'att-1' }));
    const sizeBefore = store.data.size;
    const res = await submitScoreHandler(store, jsonReq({ name: 'Maria', score: 90, attemptId: 'att-1' }));
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ ok: true });
    expect(store.data.size).toBe(sizeBefore);
  });

  it('rejects invalid payload with 400', async () => {
    const store = makeStore();
    const res = await submitScoreHandler(store, jsonReq({ name: '', score: 90, attemptId: 'a' }));
    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects non-POST with 405', async () => {
    const store = makeStore();
    const res = await submitScoreHandler(store, new Request('https://x.test', { method: 'GET' }));
    expect(res.status).toBe(405);
  });
});

describe('get-leaderboard handler', () => {
  it('returns bare ranked LeaderboardEntry[] on GET', async () => {
    const store = makeStore({
      'att-1': { attemptId: 'att-1', name: 'Maria', score: 70, timestamp: 10_000 },
      'att-2': { attemptId: 'att-2', name: 'Marco', score: 90, timestamp: 20_000 },
    });
    const res = await getLeaderboardHandler(store, new Request('https://x.test', { method: 'GET' }));
    expect(res.status).toBe(200);
    const entries = await body<{ attemptId: string; score: number }[]>(res);
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.map((e) => e.attemptId)).toEqual(['att-2', 'att-1']);
  });

  it('returns [] for an empty store', async () => {
    const store = makeStore();
    const res = await getLeaderboardHandler(store, new Request('https://x.test', { method: 'GET' }));
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual([]);
  });

  it('rejects non-GET with 405', async () => {
    const store = makeStore();
    const res = await getLeaderboardHandler(store, new Request('https://x.test', { method: 'POST' }));
    expect(res.status).toBe(405);
  });
});