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

describe('submitScore', () => {
  it('rejects invalid payloads defensively', async () => {
    const store = makeStore();
    expect(await submitScore(store, { name: '', score: 90, attemptId: 'a' })).toEqual({ ok: false, reason: 'invalid' });
    expect(await submitScore(store, { name: 'Maria', score: -1, attemptId: 'a' })).toEqual({ ok: false, reason: 'invalid' });
    expect(await submitScore(store, { name: 'Maria', score: 101, attemptId: 'a' })).toEqual({ ok: false, reason: 'invalid' });
    expect(await submitScore(store, { name: 'Maria', score: 90, attemptId: '' })).toEqual({ ok: false, reason: 'invalid' });
    expect(await submitScore(store, { name: 'Maria', score: NaN, attemptId: 'a' })).toEqual({ ok: false, reason: 'invalid' });
    expect(store.setCalls).toHaveLength(0);
  });

  it('writes a leaderboard entry keyed by attemptId', async () => {
    const store = makeStore();
    const r = await submitScore(store, { name: 'Maria', score: 90, attemptId: 'att-1' });
    expect(r).toEqual({ ok: true });
    const entry = store.data.get('att-1') as { attemptId: string; name: string; score: number; timestamp: number };
    expect(entry).toMatchObject({ attemptId: 'att-1', name: 'Maria', score: 90 });
    expect(typeof entry.timestamp).toBe('number');
  });

  it('is idempotent: same attemptId retry does NOT create a second row', async () => {
    const store = makeStore();
    await submitScore(store, { name: 'Maria', score: 90, attemptId: 'att-1' });
    const before = store.data.size;
    const r = await submitScore(store, { name: 'Maria', score: 90, attemptId: 'att-1' });
    expect(r).toEqual({ ok: true });
    expect(store.data.size).toBe(before);
    // The setJSON call still happened with onlyIfNew but was a no-op.
    expect(store.setCalls.filter((c) => c.key === 'att-1')).toHaveLength(2);
    expect(store.setCalls.at(-1)?.options?.onlyIfNew).toBe(true);
  });

  it('a new attemptId (retake) creates a new leaderboard row', async () => {
    const store = makeStore();
    await submitScore(store, { name: 'Maria', score: 70, attemptId: 'att-1' });
    await submitScore(store, { name: 'Maria', score: 90, attemptId: 'att-2' });
    expect(store.data.has('att-1')).toBe(true);
    expect(store.data.has('att-2')).toBe(true);
    expect(store.data.size).toBe(2);
  });
});