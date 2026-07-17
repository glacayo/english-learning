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
});