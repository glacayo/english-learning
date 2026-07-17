import { describe, expect, it } from 'vitest';
import type { LeaderboardEntry } from '../types';
import { compareEntries, normalizeName, rankEntries } from '../leaderboard';

function entry(
  name: string,
  score: number,
  timestamp: number,
  attemptId: string,
): LeaderboardEntry {
  return { attemptId, name, score, timestamp };
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

describe('rankEntries', () => {
  it('ranks higher score above lower score', () => {
    const entries = [entry('Ana', 70, 100, 'a'), entry('Ana', 90, 200, 'b')];
    expect(rankEntries(entries).map((e) => e.score)).toEqual([90, 70]);
  });

  it('breaks score ties by earlier timestamp first', () => {
    const entries = [
      entry('Ana', 85, 1000, 'a'), // 10:00
      entry('Bob', 85, 2000, 'b'), // later
    ];
    expect(rankEntries(entries).map((e) => e.attemptId)).toEqual(['a', 'b']);
  });

  it('breaks equal-score, equal-timestamp ties by normalized name ascending', () => {
    const entries = [
      entry('Maria', 85, 500, 'a'),
      entry('ana', 85, 500, 'b'), // "ana" < "maria"
    ];
    expect(rankEntries(entries).map((e) => e.name)).toEqual(['ana', 'Maria']);
  });

  it('breaks full ties (score, timestamp, normalized name) by attemptId ascending', () => {
    const entries = [
      entry('Maria', 85, 500, 'zzz'),
      entry('maria', 85, 500, 'aaa'), // same normalized name
    ];
    expect(rankEntries(entries).map((e) => e.attemptId)).toEqual(['aaa', 'zzz']);
  });

  it('lists every attempt row (no best-score collapse) for retakes', () => {
    const entries = [
      entry('Maria', 70, 100, 'A'),
      entry('Maria', 90, 200, 'B'), // retake, new attemptId
    ];
    const ranked = rankEntries(entries);
    expect(ranked).toHaveLength(2);
    expect(ranked.map((e) => e.attemptId)).toEqual(['B', 'A']);
  });

  it('preserves all entries when scores, timestamps, and names differ', () => {
    const entries = [
      entry('Carlos', 60, 300, 'c1'),
      entry('Diana', 95, 100, 'd1'),
      entry('Carlos', 95, 100, 'c2'),
    ];
    const ranked = rankEntries(entries);
    // 95/100/Carlos < 95/100/Diana -> c2 first, then d1, then 60 c1
    expect(ranked.map((e) => e.attemptId)).toEqual(['c2', 'd1', 'c1']);
  });

  it('does not mutate the input array', () => {
    const entries = [
      entry('Ana', 70, 100, 'a'),
      entry('Ana', 90, 200, 'b'),
    ];
    const snapshot = entries.map((e) => ({ ...e }));
    rankEntries(entries);
    expect(entries).toEqual(snapshot);
  });

  it('handles an empty list', () => {
    expect(rankEntries([])).toEqual([]);
  });

  it('handles a single entry', () => {
    const e = entry('Solo', 42, 1, 'x');
    expect(rankEntries([e])).toEqual([e]);
  });

  it('produces a fully deterministic order for a mixed set', () => {
    const entries = [
      entry('Zoe', 80, 5, 'z2'),
      entry('Zoe', 80, 5, 'z1'),
      entry('Al', 80, 5, 'a1'),
      entry('Bo', 90, 1, 'b1'),
      entry('Al', 80, 2, 'a2'),
    ];
    const ids = rankEntries(entries).map((e) => e.attemptId);
    // Bo 90 first; then 80s: Al@2 (a2) < 80@5 Al (a1) < 80@5 Zoe z1 < 80@5 Zoe z2
    expect(ids).toEqual(['b1', 'a2', 'a1', 'z1', 'z2']);
  });
});

describe('compareEntries', () => {
  it('returns negative when a should rank above b', () => {
    expect(compareEntries(entry('A', 90, 1, 'x'), entry('B', 80, 1, 'y'))).toBeLessThan(0);
  });

  it('returns 0 for identical entries', () => {
    expect(compareEntries(entry('A', 90, 1, 'x'), entry('A', 90, 1, 'x'))).toBe(0);
  });
});