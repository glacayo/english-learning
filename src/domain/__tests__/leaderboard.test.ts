import { describe, expect, it } from 'vitest';
import type { LeaderboardEntry, LevelId } from '../types';
import {
  compareEntries,
  filterByLevel,
  normalizeName,
  rankEntries,
} from '../leaderboard';

function entry(
  name: string,
  score: number,
  timestamp: number,
  attemptId: string,
  level: LevelId = 1,
): LeaderboardEntry {
  return { attemptId, name, score, level, timestamp };
}

describe('normalizeName', () => {
  it('trims and lowercases', () => {
    expect(normalizeName('  Maria ')).toBe('maria');
  });

  it('collapses "Maria", "maria ", and "MARIA" to the same key', () => {
    expect(normalizeName('Maria')).toBe(normalizeName('maria '));
    expect(normalizeName('MARIA')).toBe(normalizeName('Maria'));
  });
});

describe('rankEntries — global view (level desc → score desc → ties)', () => {
  it('ranks higher score above lower score within the same level', () => {
    const entries = [entry('Ana', 7, 100, 'a', 1), entry('Ana', 9, 200, 'b', 1)];
    expect(rankEntries(entries).map((e) => e.score)).toEqual([9, 7]);
  });

  it('ranks higher level above lower level regardless of score (spec scenario)', () => {
    const entries = [
      entry('Ana', 10, 100, 'low-high', 1), // Level 1, score 10
      entry('Bob', 7, 200, 'high-low', 10), // Level 10, score 7
    ];
    // Level 10 (score 7) ranks ABOVE Level 1 (score 10).
    expect(rankEntries(entries).map((e) => e.attemptId)).toEqual(['high-low', 'low-high']);
  });

  it('breaks score ties within a level by earlier timestamp first', () => {
    const entries = [
      entry('Ana', 8, 1000, 'a', 2), // 10:00
      entry('Bob', 8, 2000, 'b', 2), // later
    ];
    expect(rankEntries(entries).map((e) => e.attemptId)).toEqual(['a', 'b']);
  });

  it('breaks equal-score, equal-timestamp ties by normalized name ascending', () => {
    const entries = [
      entry('Maria', 8, 500, 'a', 2),
      entry('ana', 8, 500, 'b', 2), // "ana" < "maria"
    ];
    expect(rankEntries(entries).map((e) => e.name)).toEqual(['ana', 'Maria']);
  });

  it('breaks full ties (score, timestamp, normalized name) by attemptId ascending', () => {
    const entries = [
      entry('Maria', 8, 500, 'zzz', 2),
      entry('maria', 8, 500, 'aaa', 2), // same normalized name
    ];
    expect(rankEntries(entries).map((e) => e.attemptId)).toEqual(['aaa', 'zzz']);
  });

  it('orders mixed levels: higher level group first, score within group', () => {
    const entries = [
      entry('A', 9, 100, 'l1-9', 1),
      entry('B', 5, 100, 'l2-5', 2),
      entry('C', 9, 100, 'l2-9', 2),
    ];
    const ids = rankEntries(entries).map((e) => e.attemptId);
    // Level 2 group (9 then 5), then Level 1 (9).
    expect(ids).toEqual(['l2-9', 'l2-5', 'l1-9']);
  });

  it('lists every attempt row (no best-score collapse) for retakes', () => {
    const entries = [
      entry('Maria', 7, 100, 'A', 1),
      entry('Maria', 9, 200, 'B', 1), // retake, new attemptId
    ];
    const ranked = rankEntries(entries);
    expect(ranked).toHaveLength(2);
    expect(ranked.map((e) => e.attemptId)).toEqual(['B', 'A']);
  });

  it('does not mutate the input array', () => {
    const entries = [
      entry('Ana', 7, 100, 'a', 1),
      entry('Ana', 9, 200, 'b', 1),
    ];
    const snapshot = entries.map((e) => ({ ...e }));
    rankEntries(entries);
    expect(entries).toEqual(snapshot);
  });

  it('handles an empty list', () => {
    expect(rankEntries([])).toEqual([]);
  });

  it('handles a single entry', () => {
    const e = entry('Solo', 4, 1, 'x', 1);
    expect(rankEntries([e])).toEqual([e]);
  });

  it('produces a fully deterministic order for a mixed set (global)', () => {
    const entries = [
      entry('Zoe', 8, 5, 'z2', 2),
      entry('Zoe', 8, 5, 'z1', 2),
      entry('Al', 8, 5, 'a1', 2),
      entry('Bo', 9, 1, 'b1', 3),
      entry('Al', 8, 2, 'a2', 2),
    ];
    const ids = rankEntries(entries).map((e) => e.attemptId);
    // Level 3 (Bo 9) first; then Level 2 group: Al@2 (a2), 80@5 Al (a1), 80@5 Zoe z1, 80@5 Zoe z2
    expect(ids).toEqual(['b1', 'a2', 'a1', 'z1', 'z2']);
  });
});

describe('rankEntries — per-level view (score desc → ties, no level key)', () => {
  it('ranks by score desc only (level does not affect per-level order)', () => {
    const entries = [
      entry('A', 10, 5, 'hi', 1),
      entry('B', 4, 100, 'lo', 1),
    ];
    const ids = rankEntries(entries, 'per-level').map((e) => e.attemptId);
    expect(ids).toEqual(['hi', 'lo']);
  });

  it('breaks ties by timestamp then name then attemptId (per-level)', () => {
    const entries = [
      entry('Maria', 8, 500, 'z', 1),
      entry('ana', 8, 500, 'b', 1), // name asc
      entry('ana', 8, 200, 'c', 1), // earlier timestamp
    ];
    const ids = rankEntries(entries, 'per-level').map((e) => e.attemptId);
    // c (ana, t=200) first; then b (ana, t=500); then z (maria, t=500).
    expect(ids).toEqual(['c', 'b', 'z']);
  });

  it('per-level view ignores the level key so two same-level rows keep score order', () => {
    const entries = [
      entry('A', 5, 1, 'low', 5),
      entry('B', 9, 2, 'high', 5),
    ];
    expect(rankEntries(entries, 'per-level').map((e) => e.attemptId)).toEqual(['high', 'low']);
  });
});

describe('compareEntries', () => {
  it('returns negative when a should rank above b (global: higher level)', () => {
    // Level 10 entry ranks above Level 1 entry.
    expect(compareEntries(entry('A', 7, 1, 'x', 10), entry('B', 10, 1, 'y', 1))).toBeLessThan(0);
  });

  it('returns 0 for identical entries', () => {
    expect(compareEntries(entry('A', 9, 1, 'x', 1), entry('A', 9, 1, 'x', 1))).toBe(0);
  });

  it('per-level compare ignores level (same-level rows by score)', () => {
    expect(
      compareEntries(entry('A', 9, 1, 'x', 1), entry('B', 7, 1, 'y', 1), 'per-level'),
    ).toBeLessThan(0);
  });
});

describe('filterByLevel', () => {
  it('keeps only rows of the given level', () => {
    const entries = [
      entry('A', 9, 1, 'a1', 1),
      entry('B', 5, 1, 'b2', 2),
      entry('C', 7, 1, 'c2', 2),
    ];
    const filtered = filterByLevel(entries, 2 as LevelId);
    expect(filtered.map((e) => e.attemptId)).toEqual(['b2', 'c2']);
  });

  it('returns empty when no rows match the level', () => {
    const entries = [entry('A', 9, 1, 'a1', 1), entry('B', 5, 1, 'b2', 2)];
    expect(filterByLevel(entries, 3 as LevelId)).toEqual([]);
  });
});