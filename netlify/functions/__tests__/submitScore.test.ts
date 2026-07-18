import { describe, expect, it } from 'vitest';
import type { StoreLike } from '../_store';
import { submitScore } from '../_store';

function makeStore(): StoreLike & {
  data: Map<string, unknown>;
  setCalls: { key: string; options: { onlyIfNew?: boolean } | undefined }[];
} {
  const data = new Map<string, unknown>();
  const setCalls: { key: string; options: { onlyIfNew?: boolean } | undefined }[] = [];
  const store: StoreLike & { data: typeof data; setCalls: typeof setCalls } = {
    data,
    setCalls,
    async getJSON(key) {
      return data.has(key) ? (data.get(key) as unknown) : null;
    },
    async setJSON(key, value, options) {
      setCalls.push({ key, options });
      if (options?.onlyIfNew && data.has(key)) {
        return { modified: false };
      }
      data.set(key, value);
      return { modified: true };
    },
    async listKeys() {
      return [...data.keys()];
    },
  };
  return store;
}

describe('submitScore — PR3 level-aware schema (integer score 0-10, level 1-10)', () => {
  it('rejects invalid payloads defensively', async () => {
    const store = makeStore();
    expect(await submitScore(store, { name: '', score: 9, level: 1, attemptId: 'a' })).toEqual({ ok: false, reason: 'invalid' });
    expect(await submitScore(store, { name: 'Maria', score: -1, level: 1, attemptId: 'a' })).toEqual({ ok: false, reason: 'invalid' });
    expect(await submitScore(store, { name: 'Maria', score: 11, level: 1, attemptId: 'a' })).toEqual({ ok: false, reason: 'invalid' });
    expect(await submitScore(store, { name: 'Maria', score: 9, level: 1, attemptId: '' })).toEqual({ ok: false, reason: 'invalid' });
    expect(await submitScore(store, { name: 'Maria', score: NaN, level: 1, attemptId: 'a' })).toEqual({ ok: false, reason: 'invalid' });
    // Missing level is rejected (PR3: level is required).
    expect(await submitScore(store, { name: 'Maria', score: 9, attemptId: 'a' })).toEqual({ ok: false, reason: 'invalid' });
    expect(store.setCalls).toHaveLength(0);
  });

  it('rejects non-integer score (9.5) and non-integer level (3.2)', async () => {
    const store = makeStore();
    expect(await submitScore(store, { name: 'Maria', score: 9.5, level: 1, attemptId: 'a' })).toEqual({ ok: false, reason: 'invalid' });
    expect(await submitScore(store, { name: 'Maria', score: 9, level: 3.2, attemptId: 'a' })).toEqual({ ok: false, reason: 'invalid' });
    expect(store.setCalls).toHaveLength(0);
  });

  it('rejects out-of-range level (0 and 11)', async () => {
    const store = makeStore();
    expect(await submitScore(store, { name: 'Maria', score: 9, level: 0, attemptId: 'a' })).toEqual({ ok: false, reason: 'invalid' });
    expect(await submitScore(store, { name: 'Maria', score: 9, level: 11, attemptId: 'a' })).toEqual({ ok: false, reason: 'invalid' });
    expect(store.setCalls).toHaveLength(0);
  });

  it('writes a level-aware leaderboard entry keyed by attemptId with level', async () => {
    const store = makeStore();
    const r = await submitScore(store, { name: 'Maria', score: 9, level: 3, attemptId: 'att-1' });
    expect(r).toEqual({ ok: true });
    const entry = store.data.get('att-1') as {
      attemptId: string;
      name: string;
      score: number;
      level: number;
      timestamp: number;
    };
    expect(entry).toMatchObject({ attemptId: 'att-1', name: 'Maria', score: 9, level: 3 });
    expect(typeof entry.timestamp).toBe('number');
  });

  it('accepts boundary scores 0 and 10', async () => {
    const store = makeStore();
    expect(await submitScore(store, { name: 'A', score: 0, level: 1, attemptId: 'z' })).toEqual({ ok: true });
    expect(await submitScore(store, { name: 'B', score: 10, level: 10, attemptId: 'y' })).toEqual({ ok: true });
    expect((store.data.get('z') as { score: number }).score).toBe(0);
    expect((store.data.get('y') as { score: number }).score).toBe(10);
  });

  it('is idempotent: same attemptId retry does NOT create a second row', async () => {
    const store = makeStore();
    await submitScore(store, { name: 'Maria', score: 9, level: 1, attemptId: 'att-1' });
    const before = store.data.size;
    const r = await submitScore(store, { name: 'Maria', score: 9, level: 1, attemptId: 'att-1' });
    expect(r).toEqual({ ok: true });
    expect(store.data.size).toBe(before);
    // The setJSON call still happened with onlyIfNew but was a no-op.
    expect(store.setCalls.filter((c) => c.key === 'att-1')).toHaveLength(2);
    expect(store.setCalls.at(-1)?.options?.onlyIfNew).toBe(true);
  });

  it('a new attemptId (retake) creates a new leaderboard row', async () => {
    const store = makeStore();
    await submitScore(store, { name: 'Maria', score: 7, level: 1, attemptId: 'att-1' });
    await submitScore(store, { name: 'Maria', score: 9, level: 1, attemptId: 'att-2' });
    expect(store.data.has('att-1')).toBe(true);
    expect(store.data.has('att-2')).toBe(true);
    expect(store.data.size).toBe(2);
  });
});