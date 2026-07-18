import { describe, expect, it } from 'vitest';
import type { LeaderboardEntry, LevelId } from '../types';
import {
  collapseToBestPerName,
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
    const entries = [entry('Ana', 7, 100, 'a', 1), entry('Bob', 9, 200, 'b', 1)];
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
      entry('maria ', 8, 500, 'aaa', 2),
    ];
    // Same normalized name + identical rank keys collapse to the lower attemptId.
    expect(rankEntries(entries).map((e) => e.attemptId)).toEqual(['aaa']);
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

  it('collapses retakes to the best row per normalized name (global)', () => {
    const entries = [
      entry('Ximena', 5, 100, 'low', 1),
      entry('Ximena', 9, 200, 'high', 1), // retake, better score
    ];
    const ranked = rankEntries(entries);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({ attemptId: 'high', score: 9, name: 'Ximena' });
  });

  it('keeps the higher-level attempt when the same name appears on multiple levels', () => {
    const entries = [
      entry('Maria', 10, 100, 'l1-perfect', 1),
      entry('Maria', 7, 200, 'l3-mid', 3),
    ];
    const ranked = rankEntries(entries, 'global');
    expect(ranked).toHaveLength(1);
    expect(ranked[0].attemptId).toBe('l3-mid');
  });

  it('collapses case/whitespace variants of the same name to one best row', () => {
    const entries = [
      entry('Ximena', 5, 100, 'a', 1),
      entry('ximena ', 9, 200, 'b', 1),
      entry('XIMENA', 7, 150, 'c', 1),
    ];
    const ranked = rankEntries(entries);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].attemptId).toBe('b');
    expect(ranked[0].score).toBe(9);
  });

  it('does not mutate the input array', () => {
    const entries = [
      entry('Ana', 7, 100, 'a', 1),
      entry('Bob', 9, 200, 'b', 1),
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
      entry('Zoe', 8, 5, 'z1', 2),
      entry('Al', 8, 5, 'a1', 2),
      entry('Bo', 9, 1, 'b1', 3),
      entry('Al', 8, 2, 'a2', 2), // better timestamp for Al → kept
    ];
    const ids = rankEntries(entries).map((e) => e.attemptId);
    // Level 3 (Bo 9) first; then Level 2: Al@2 (a2), Zoe@5 (z1). Duplicate Al dropped.
    expect(ids).toEqual(['b1', 'a2', 'z1']);
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
      entry('Bob', 8, 200, 'c', 1), // earlier timestamp
    ];
    const ids = rankEntries(entries, 'per-level').map((e) => e.attemptId);
    // c (Bob, t=200) first; then b (ana, t=500); then z (maria, t=500).
    expect(ids).toEqual(['c', 'b', 'z']);
  });

  it('per-level view ignores the level key so two same-level rows keep score order', () => {
    const entries = [
      entry('A', 5, 1, 'low', 5),
      entry('B', 9, 2, 'high', 5),
    ];
    expect(rankEntries(entries, 'per-level').map((e) => e.attemptId)).toEqual(['high', 'low']);
  });

  it('collapses retakes to the best score within the level view', () => {
    const entries = [
      entry('Ximena', 5, 100, 'low', 2),
      entry('Ximena', 9, 300, 'high', 2),
      entry('Ana', 8, 200, 'ana', 2),
    ];
    const ranked = rankEntries(entries, 'per-level');
    expect(ranked.map((e) => e.attemptId)).toEqual(['high', 'ana']);
  });
});

describe('collapseToBestPerName', () => {
  it('keeps the first occurrence of each normalized name (pre-ranked input)', () => {
    const ranked = [
      entry('Ximena', 9, 200, 'best', 1),
      entry('Ana', 8, 100, 'ana', 1),
      entry('ximena', 5, 50, 'worse', 1),
    ];
    expect(collapseToBestPerName(ranked).map((e) => e.attemptId)).toEqual(['best', 'ana']);
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
