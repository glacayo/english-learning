import { describe, expect, it } from 'vitest';
import type { StoreLike } from '../_store';
import { claimName } from '../_store';

/**
 * In-memory `StoreLike` mock for the Netlify Blobs helpers. Records writes
 * keyed by blob key, supports `onlyIfNew` (create-if-absent), and lists keys.
 */
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

describe('claimName', () => {
  it('rejects an empty/whitespace-only name with ok:false invalid', async () => {
    const store = makeStore();
    const r = await claimName(store, '   ');
    expect(r).toEqual({ ok: false, reason: 'invalid' });
    expect(store.setCalls).toHaveLength(0);
  });

  it('reserves a new normalized identity on first claim and returns the trimmed name', async () => {
    const store = makeStore();
    const r = await claimName(store, '  Maria  ');
    expect(r).toEqual({ ok: true, name: 'Maria' });
    expect(store.data.get('maria')).toMatchObject({ displayName: 'Maria' });
  });

  it('treats "maria ", "MARIA" as the same identity as "Maria" (retake)', async () => {
    const store = makeStore();
    await claimName(store, 'Maria');
    const retake = await claimName(store, 'maria ');
    expect(retake.ok).toBe(true);
    if (retake.ok) expect(retake.name).toBe('Maria');
    // Only one blob key for the normalized identity.
    expect(store.data.size).toBe(1);
    expect(store.data.has('maria')).toBe(true);
  });

  it('keeps distinct identities for distinct display names', async () => {
    const store = makeStore();
    await claimName(store, 'Maria');
    await claimName(store, 'Marco');
    expect(store.data.has('maria')).toBe(true);
    expect(store.data.has('marco')).toBe(true);
  });

  it('returns the reserved canonical display name on a same-key retake', async () => {
    const store = makeStore();
    await claimName(store, 'Maria');
    // A later claim with different casing/whitespace still returns the first
    // reserved display name.
    const r = await claimName(store, 'MARIA ');
    expect(r).toEqual({ ok: true, name: 'Maria' });
  });

  it('preserves first claimed casing when retaking with spaces and lowercase (regression)', async () => {
    // Deployed smoke: first "Maria", then "  maria  " must still return "Maria".
    const store = makeStore();
    const first = await claimName(store, 'Maria');
    expect(first).toEqual({ ok: true, name: 'Maria' });

    const retake = await claimName(store, '  maria  ');
    expect(retake).toEqual({ ok: true, name: 'Maria' });
    expect(store.data.get('maria')).toMatchObject({ displayName: 'Maria' });
    expect(store.data.size).toBe(1);
  });

  it('still returns the first display name even if onlyIfNew is ignored (overwrite store)', async () => {
    // Simulates the @netlify/blobs setJSON bug where onlyIfNew is ignored and
    // every write reports modified:true. claimName must still not flip casing.
    const data = new Map<string, unknown>();
    const store: StoreLike = {
      async getJSON(key) {
        return data.has(key) ? data.get(key)! : null;
      },
      async setJSON(key, value) {
        data.set(key, value);
        return { modified: true };
      },
      async listKeys() {
        return [...data.keys()];
      },
    };

    expect(await claimName(store, 'Maria')).toEqual({ ok: true, name: 'Maria' });
    expect(await claimName(store, '  maria  ')).toEqual({
      ok: true,
      name: 'Maria',
    });
    expect(data.get('maria')).toMatchObject({ displayName: 'Maria' });
  });

  it('race-loser path: first read misses, set returns modified:false, then returns winner display name', async () => {
    // Concurrent first claims: this caller misses the initial read, loses the
    // onlyIfNew write, then must re-read the winner's canonical spelling.
    let getCount = 0;
    const store: StoreLike = {
      async getJSON() {
        getCount += 1;
        if (getCount === 1) return null;
        return { displayName: 'Maria', claimedAt: 1 };
      },
      async setJSON() {
        return { modified: false };
      },
      async listKeys() {
        return ['maria'];
      },
    };

    const r = await claimName(store, '  maria  ');
    expect(r).toEqual({ ok: true, name: 'Maria' });
    expect(getCount).toBe(2);
  });

  it('race-loser path falls back to trimmed name when winner displayName is invalid', async () => {
    let getCount = 0;
    const store: StoreLike = {
      async getJSON() {
        getCount += 1;
        if (getCount === 1) return null;
        return { displayName: '   ', claimedAt: 1 };
      },
      async setJSON() {
        return { modified: false };
      },
      async listKeys() {
        return ['maria'];
      },
    };

    const r = await claimName(store, '  maria  ');
    expect(r).toEqual({ ok: true, name: 'maria' });
  });
});