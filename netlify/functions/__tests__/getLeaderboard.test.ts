import { describe, expect, it } from 'vitest';
import type { StoreLike } from '../_store';
import { getRankedLeaderboard } from '../_store';
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

function entry(
  attemptId: string,
  name: string,
  score: number,
  timestamp: number,
): LeaderboardEntry {
  return { attemptId, name, score, timestamp };
}

describe('getRankedLeaderboard', () => {
  it('returns an empty array when the store is empty', async () => {
    const store = makeStore({});
    expect(await getRankedLeaderboard(store)).toEqual([]);
  });

  it('lists every attempt row (retakes produce multiple rows per name)', async () => {
    const store = makeStore({
      'att-1': entry('att-1', 'Maria', 70, 10_000),
      'att-2': entry('att-2', 'Maria', 90, 20_000),
    });
    const board = await getRankedLeaderboard(store);
    expect(board).toHaveLength(2);
    expect(board.map((e) => e.attemptId)).toEqual(['att-2', 'att-1']);
  });

  it('ranks by score descending', async () => {
    const store = makeStore({
      'att-1': entry('att-1', 'Maria', 70, 10_000),
      'att-2': entry('att-2', 'Marco', 90, 20_000),
    });
    const board = await getRankedLeaderboard(store);
    expect(board.map((e) => e.score)).toEqual([90, 70]);
    expect(board.map((e) => e.attemptId)).toEqual(['att-2', 'att-1']);
  });

  it('breaks score ties by earlier timestamp first', async () => {
    const store = makeStore({
      'att-1': entry('att-1', 'Maria', 85, 10_000),
      'att-2': entry('att-2', 'Marco', 85, 20_000),
    });
    const board = await getRankedLeaderboard(store);
    expect(board.map((e) => e.attemptId)).toEqual(['att-1', 'att-2']);
  });

  it('breaks equal score+timestamp ties by normalized name asc then attemptId asc', async () => {
    const store = makeStore({
      'att-3': entry('att-3', 'Maria', 85, 10_000),
      'att-1': entry('att-1', 'Marco', 85, 10_000),
      'att-2': entry('att-2', 'Maria', 85, 10_000),
    });
    const board = await getRankedLeaderboard(store);
    // Same score + timestamp: marco (c) before maria (i); then within maria, att-2 before att-3.
    expect(board.map((e) => e.attemptId)).toEqual(['att-1', 'att-2', 'att-3']);
  });

  it('skips malformed blobs defensively so one bad entry never blanks the board', async () => {
    const store = makeStore({
      'att-1': entry('att-1', 'Maria', 90, 10_000),
      'bad': { attemptId: 123, name: 'x' }, // missing/invalid fields
      'bad2': null,
    });
    const board = await getRankedLeaderboard(store);
    expect(board).toHaveLength(1);
    expect(board[0].attemptId).toBe('att-1');
  });
});