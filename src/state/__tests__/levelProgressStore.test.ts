import { describe, expect, it } from 'vitest';
import {
  loadProgress,
  progressStorageKey,
  saveProgress,
  PROGRESS_STORAGE_PREFIX,
} from '../levelProgressStore';
import { createInitialProgress, applyPass } from '../../domain/levelProgress';

/**
 * Minimal in-memory `Storage`-like stub for tests. The real `localStorage` is
 * unavailable in the `node` vitest environment, and the store accepts a
 * `Storage | null` so tests can inject a mock without the DOM.
 */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string): string | null {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number): string | null {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    },
  };
}

describe('progressStorageKey', () => {
  it('builds the v1 key for a name claim key', () => {
    expect(progressStorageKey('maria')).toBe(`${PROGRESS_STORAGE_PREFIX}maria`);
  });

  it('uses the prefix constant', () => {
    expect(PROGRESS_STORAGE_PREFIX).toBe('english-learning:progress:v1:');
  });
});

describe('loadProgress', () => {
  it('returns fresh progress when storage is null', () => {
    const p = loadProgress(null, 'maria');
    expect(p).toEqual(createInitialProgress());
  });

  it('returns fresh progress when the key is absent', () => {
    const storage = memoryStorage();
    const p = loadProgress(storage, 'maria');
    expect(p).toEqual(createInitialProgress());
  });

  it('round-trips progress written by saveProgress', () => {
    const storage = memoryStorage();
    const passed = applyPass(createInitialProgress(), 1, 9);
    saveProgress(storage, 'maria', passed);
    const loaded = loadProgress(storage, 'maria');
    expect(loaded).toEqual(passed);
    expect(loaded.passed).toEqual([1]);
  });

  it('returns fresh progress when the stored JSON is corrupt', () => {
    const storage = memoryStorage();
    storage.setItem(progressStorageKey('maria'), '{not valid json');
    const p = loadProgress(storage, 'maria');
    expect(p).toEqual(createInitialProgress());
  });

  it('returns fresh progress when the stored JSON shape is invalid', () => {
    const storage = memoryStorage();
    storage.setItem(progressStorageKey('maria'), JSON.stringify({ passed: [99] }));
    const p = loadProgress(storage, 'maria');
    expect(p).toEqual(createInitialProgress());
  });

  it('isolates progress per name claim key (shared device)', () => {
    // Spec scenario: a second identity does NOT inherit the first's unlocks.
    const storage = memoryStorage();
    const maria = applyPass(createInitialProgress(), 1, 9);
    saveProgress(storage, 'maria', maria);
    const ana = loadProgress(storage, 'ana');
    expect(ana.passed).toEqual([]);
  });

  it('survives a page refresh: progress read back matches progress written', () => {
    // Spec scenario: "Progress survives a refresh".
    // Passing Levels 1-3 → after reload, Levels 1-4 unlocked with 1-3 passed.
    const storage = memoryStorage();
    let p = createInitialProgress();
    p = applyPass(p, 1, 9);
    p = applyPass(p, 2, 9);
    p = applyPass(p, 3, 9);
    saveProgress(storage, 'maria', p);
    // Simulate a refresh by re-loading from the same storage.
    const reloaded = loadProgress(storage, 'maria');
    expect(reloaded.passed).toEqual([1, 2, 3]);
    // Levels 1-4 are unlocked (1-3 passed → 4 unlocked); 5+ remain locked.
    expect(reloaded).toEqual(p);
  });

  it('a fresh device shows only Level 1 unlocked (no cross-device sync in v1)', () => {
    // Spec scenario: "Progress does not follow to a new device".
    // Device A has progress; Device B (empty storage) starts fresh.
    const deviceA = memoryStorage();
    saveProgress(deviceA, 'maria', applyPass(applyPass(applyPass(createInitialProgress(), 1, 9), 2, 9), 3, 9));
    const deviceB = memoryStorage(); // different storage → different device
    const onB = loadProgress(deviceB, 'maria');
    expect(onB.passed).toEqual([]);
  });

  it('treats "maria" and "MARIA" as different raw keys (caller normalizes)', () => {
    // The store does not normalize; the caller supplies the normalized claim
    // key so the same student resolves to the same store regardless of
    // casing typed. Here we verify the store is a pure key-value lookup.
    const storage = memoryStorage();
    saveProgress(storage, 'maria', applyPass(createInitialProgress(), 1, 9));
    expect(loadProgress(storage, 'MARIA').passed).toEqual([]);
    expect(loadProgress(storage, 'maria').passed).toEqual([1]);
  });
});

describe('saveProgress', () => {
  it('is a no-op when storage is null', () => {
    expect(() => saveProgress(null, 'maria', createInitialProgress())).not.toThrow();
  });

  it('persists the progress as JSON', () => {
    const storage = memoryStorage();
    const p = applyPass(createInitialProgress(), 5, 9);
    saveProgress(storage, 'maria', p);
    const raw = storage.getItem(progressStorageKey('maria'));
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual(p);
  });
});