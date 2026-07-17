import { describe, expect, it, vi } from 'vitest';
import { BlobsStore } from '../_store';
import type { Store } from '@netlify/blobs';

/**
 * BlobsStore adapter tests — guards the @netlify/blobs setJSON workaround.
 * setJSON in @netlify/blobs@10.x spreads onlyIfNew incorrectly, so the adapter
 * must call `set` with a JSON string for conditional writes to work.
 */
describe('BlobsStore', () => {
  it('routes setJSON through store.set with onlyIfNew (not broken setJSON)', async () => {
    const set = vi.fn(async () => ({ modified: true, etag: 'e1' }));
    const setJSON = vi.fn(async () => ({ modified: true, etag: 'e1' }));
    const get = vi.fn(async () => null);

    const store = { set, setJSON, get } as unknown as Store;
    const adapter = new BlobsStore(store);

    const result = await adapter.setJSON(
      'maria',
      { displayName: 'Maria', claimedAt: 1 },
      { onlyIfNew: true },
    );

    expect(result).toEqual({ modified: true });
    expect(set).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith(
      'maria',
      JSON.stringify({ displayName: 'Maria', claimedAt: 1 }),
      { onlyIfNew: true },
    );
    expect(setJSON).not.toHaveBeenCalled();
  });

  it('reads JSON with strong consistency', async () => {
    const get = vi.fn(async () => ({ displayName: 'Maria', claimedAt: 1 }));
    const store = { get } as unknown as Store;
    const adapter = new BlobsStore(store);

    const value = await adapter.getJSON('maria');

    expect(value).toEqual({ displayName: 'Maria', claimedAt: 1 });
    expect(get).toHaveBeenCalledWith('maria', {
      type: 'json',
      consistency: 'strong',
    });
  });

  it('propagates modified:false from store.set (onlyIfNew conflict)', async () => {
    const set = vi.fn(async () => ({ modified: false, etag: 'e0' }));
    const store = { set } as unknown as Store;
    const adapter = new BlobsStore(store);

    const result = await adapter.setJSON(
      'maria',
      { displayName: 'Maria', claimedAt: 1 },
      { onlyIfNew: true },
    );

    expect(result).toEqual({ modified: false });
    expect(set).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith(
      'maria',
      JSON.stringify({ displayName: 'Maria', claimedAt: 1 }),
      { onlyIfNew: true },
    );
  });
});
