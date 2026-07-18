import { describe, expect, it } from 'vitest';
import type { StoreLike } from '../_store';
import {
  getRankedLeaderboard,
  mapWithConcurrency,
  LEADERBOARD_READ_CONCURRENCY,
} from '../_store';
import type { LeaderboardEntry } from '../../../src/domain/types';

function makeStore(initial: Record<string, unknown>): StoreLike {
  const data = new Map<string, unknown>(Object.entries(initial));
  return {
    async getJSON(key) {
      return data.has(key) ? (data.get(key) as unknown) : null;
    },
    async setJSON() {
      throw new Error('setJSON not used in get-leaderboard tests');
    },
    async listKeys() {
      return [...data.keys()];
    },
  };
}

/** Build a valid level-aware entry. */
function entry(
  attemptId: string,
  name: string,
  score: number,
  timestamp: number,
  level: LeaderboardEntry['level'] = 1,
): LeaderboardEntry {
  return { attemptId, name, score, level, timestamp };
}

describe('getRankedLeaderboard — global view (level desc → score desc → ties)', () => {
  it('returns an empty array when the store is empty', async () => {
    const store = makeStore({});
    expect(await getRankedLeaderboard(store)).toEqual([]);
  });

  it('collapses retakes to one best row per normalized name', async () => {
    const store = makeStore({
      'att-1': entry('att-1', 'Ximena', 5, 10_000, 1),
      'att-2': entry('att-2', 'Ximena', 9, 20_000, 1),
    });
    const board = await getRankedLeaderboard(store);
    expect(board).toHaveLength(1);
    expect(board.map((e) => e.attemptId)).toEqual(['att-2']);
    expect(board[0].score).toBe(9);
  });

  it('higher level ranks above lower level regardless of score (global view)', async () => {
    const store = makeStore({
      'low-highscore': entry('low-highscore', 'Ana', 10, 5, 1),
      'high-lowscore': entry('high-lowscore', 'Bob', 7, 50, 10),
    });
    const board = await getRankedLeaderboard(store);
    // Level 10 (score 7) ranks ABOVE Level 1 (score 10) in the global view.
    expect(board.map((e) => e.attemptId)).toEqual(['high-lowscore', 'low-highscore']);
  });

  it('ranks by score descending within the same level (global view)', async () => {
    const store = makeStore({
      'att-1': entry('att-1', 'Maria', 7, 10_000, 3),
      'att-2': entry('att-2', 'Marco', 9, 20_000, 3),
    });
    const board = await getRankedLeaderboard(store);
    expect(board.map((e) => e.score)).toEqual([9, 7]);
    expect(board.map((e) => e.attemptId)).toEqual(['att-2', 'att-1']);
  });

  it('breaks score ties within a level by earlier timestamp first', async () => {
    const store = makeStore({
      'att-1': entry('att-1', 'Maria', 8, 10_000, 2),
      'att-2': entry('att-2', 'Marco', 8, 20_000, 2),
    });
    const board = await getRankedLeaderboard(store);
    expect(board.map((e) => e.attemptId)).toEqual(['att-1', 'att-2']);
  });

  it('breaks equal score+timestamp ties by normalized name asc then attemptId asc', async () => {
    const store = makeStore({
      'att-3': entry('att-3', 'Zoe', 8, 10_000, 2),
      'att-1': entry('att-1', 'Marco', 8, 10_000, 2),
      'att-2': entry('att-2', 'Maria', 8, 10_000, 2),
    });
    const board = await getRankedLeaderboard(store);
    // Same score + timestamp: marco < maria < zoe (normalized name asc).
    expect(board.map((e) => e.attemptId)).toEqual(['att-1', 'att-2', 'att-3']);
  });

  it('orders mixed levels globally: higher level group first, score within group', async () => {
    const store = makeStore({
      'l1-9': entry('l1-9', 'A', 9, 100, 1),
      'l2-5': entry('l2-5', 'B', 5, 100, 2),
      'l2-9': entry('l2-9', 'C', 9, 100, 2),
    });
    const board = await getRankedLeaderboard(store);
    // Level 2 group first (9 then 5), then Level 1 (9).
    expect(board.map((e) => e.attemptId)).toEqual(['l2-9', 'l2-5', 'l1-9']);
  });
});

describe('getRankedLeaderboard — per-level filter (score desc → ties)', () => {
  it('returns only rows of the selected level, ranked by score desc', async () => {
    const store = makeStore({
      'l1-a': entry('l1-a', 'Ana', 9, 10, 1),
      'l2-a': entry('l2-a', 'Bob', 5, 10, 2),
      'l2-b': entry('l2-b', 'Cat', 9, 20, 2),
    });
    const board = await getRankedLeaderboard(store, 2);
    expect(board.map((e) => e.attemptId)).toEqual(['l2-b', 'l2-a']);
  });

  it('returns empty when no rows match the selected level', async () => {
    const store = makeStore({
      'l1-a': entry('l1-a', 'Ana', 9, 10, 1),
    });
    expect(await getRankedLeaderboard(store, 5)).toEqual([]);
  });

  it('per-level ranking uses score-first (no level key)', async () => {
    const store = makeStore({
      'low-level-high-score': entry('low-level-high-score', 'A', 10, 5, 1),
      'same-level-low-score': entry('same-level-low-score', 'B', 4, 100, 1),
    });
    const board = await getRankedLeaderboard(store, 1);
    expect(board.map((e) => e.attemptId)).toEqual(['low-level-high-score', 'same-level-low-score']);
  });

  it('collapses duplicate normalized names within the selected level', async () => {
    const store = makeStore({
      'ximena-low': entry('ximena-low', 'Ximena', 5, 10, 1),
      'ximena-high': entry('ximena-high', 'ximena ', 9, 20, 1),
      'test-row': entry('test-row', 'Test', 6, 30, 1),
      'other-level': entry('other-level', 'Ximena', 10, 5, 2),
    });
    const board = await getRankedLeaderboard(store, 1);
    expect(board.map((e) => e.attemptId)).toEqual(['ximena-high', 'test-row']);
  });
});

describe('getRankedLeaderboard — legacy/invalid row rejection (PR3 schema)', () => {
  it('hides legacy rows without level (PR1 full-catalog entries)', async () => {
    const store = makeStore({
      'att-legacy': {
        attemptId: 'att-legacy',
        name: 'Maria',
        score: 85, // 0-100 scale
        timestamp: 10_000,
      },
      'att-level': entry('att-level', 'Marco', 9, 20_000, 3),
    });
    const board = await getRankedLeaderboard(store);
    expect(board).toHaveLength(1);
    expect(board[0].attemptId).toBe('att-level');
    expect(board[0].level).toBe(3);
  });

  it('hides legacy rows with a 0-100 score even if a level is present', async () => {
    const store = makeStore({
      'att-100': { attemptId: 'att-100', name: 'X', score: 100, level: 1, timestamp: 1 },
    });
    expect(await getRankedLeaderboard(store)).toEqual([]);
  });

  it('skips malformed blobs defensively so one bad entry never blanks the board', async () => {
    const store = makeStore({
      'att-1': entry('att-1', 'Maria', 9, 10_000, 1),
      'bad': { attemptId: 123, name: 'x' }, // missing/invalid fields
      'bad2': null,
    });
    const board = await getRankedLeaderboard(store);
    expect(board).toHaveLength(1);
    expect(board[0].attemptId).toBe('att-1');
  });

  it('rejects entries with present-but-invalid level while keeping valid rows', async () => {
    const store = makeStore({
      'att-ok': entry('att-ok', 'Maria', 9, 10_000, 1),
      'att-level-zero': { attemptId: 'att-level-zero', name: 'Bad', score: 5, level: 0, timestamp: 11_000 },
      'att-level-float': { attemptId: 'att-level-float', name: 'Bad', score: 5, level: 1.5, timestamp: 12_000 },
      'att-level-string': { attemptId: 'att-level-string', name: 'Bad', score: 5, level: '1', timestamp: 13_000 },
      'att-level-high': { attemptId: 'att-level-high', name: 'Bad', score: 5, level: 11, timestamp: 14_000 },
    });
    const board = await getRankedLeaderboard(store);
    expect(board).toHaveLength(1);
    expect(board[0].attemptId).toBe('att-ok');
  });

  it('rejects non-integer score (9.5) while keeping valid rows', async () => {
    const store = makeStore({
      'att-ok': entry('att-ok', 'Maria', 9, 10_000, 1),
      'att-float': { attemptId: 'att-float', name: 'Bad', score: 9.5, level: 1, timestamp: 11_000 },
    });
    const board = await getRankedLeaderboard(store);
    expect(board).toHaveLength(1);
    expect(board[0].attemptId).toBe('att-ok');
  });
});

describe('getRankedLeaderboard — bounded concurrent reads', () => {
  it('reads multiple keys concurrently (not strictly sequential)', async () => {
    const keys = Array.from({ length: 8 }, (_, i) => `att-${i}`);
    const initial: Record<string, unknown> = {};
    for (const [i, key] of keys.entries()) {
      // Distinct names so collapse-by-name does not hide concurrency coverage.
      initial[key] = entry(key, `Student-${i}`, 5, 1_000, 1);
    }

    let inFlight = 0;
    let maxInFlight = 0;
    const data = new Map<string, unknown>(Object.entries(initial));
    const store: StoreLike = {
      async getJSON(key) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 15));
        inFlight -= 1;
        return data.has(key) ? (data.get(key) as unknown) : null;
      },
      async setJSON() {
        throw new Error('setJSON not used');
      },
      async listKeys() {
        return [...data.keys()];
      },
    };

    const board = await getRankedLeaderboard(store);
    expect(board).toHaveLength(8);
    // Sequential reads would keep maxInFlight at 1; concurrency must exceed 1.
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(LEADERBOARD_READ_CONCURRENCY);
  });
});

describe('mapWithConcurrency', () => {
  it('preserves order and respects the concurrency bound', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = [1, 2, 3, 4, 5, 6];
    const results = await mapWithConcurrency(items, 2, async (n) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight -= 1;
      return n * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50, 60]);
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it('returns [] for empty input without calling the worker', async () => {
    let calls = 0;
    const results = await mapWithConcurrency([], 4, async () => {
      calls += 1;
      return 1;
    });
    expect(results).toEqual([]);
    expect(calls).toBe(0);
  });
});
