import { describe, expect, it } from 'vitest';
import type { LeaderboardEntry } from '../../domain/types';
import {
  LEVEL_FILTER_OPTIONS,
  entriesForActiveFilter,
  levelFilterLabel,
} from '../Leaderboard';

function entry(
  overrides: Partial<LeaderboardEntry> & Pick<LeaderboardEntry, 'attemptId' | 'level'>,
): LeaderboardEntry {
  return {
    name: 'Student',
    score: 8,
    timestamp: 1,
    ...overrides,
  };
}

describe('Leaderboard filter helpers', () => {
  it('levelFilterLabel renders "Global" for null and "Level N" otherwise', () => {
    expect(levelFilterLabel(null)).toBe('Global');
    expect(levelFilterLabel(1)).toBe('Level 1');
    expect(levelFilterLabel(10)).toBe('Level 10');
  });

  it('LEVEL_FILTER_OPTIONS contains Global (null) plus Levels 1-10', () => {
    expect(LEVEL_FILTER_OPTIONS[0]).toBeNull();
    const levels = LEVEL_FILTER_OPTIONS.slice(1);
    expect(levels).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(LEVEL_FILTER_OPTIONS).toHaveLength(11);
  });

  it('every option maps to a non-empty label', () => {
    for (const opt of LEVEL_FILTER_OPTIONS) {
      expect(levelFilterLabel(opt).length).toBeGreaterThan(0);
    }
  });
});

describe('entriesForActiveFilter', () => {
  const mixed: readonly LeaderboardEntry[] = [
    entry({ attemptId: 'a1', level: 1, name: 'Ana', score: 10 }),
    entry({ attemptId: 'a2', level: 2, name: 'Ben', score: 9 }),
    entry({ attemptId: 'a3', level: 1, name: 'Cara', score: 7 }),
  ];

  it('keeps every row for the global filter', () => {
    expect(entriesForActiveFilter(mixed, null)).toEqual(mixed);
  });

  it('keeps only matching level rows for a per-level filter', () => {
    expect(entriesForActiveFilter(mixed, 1)).toEqual([
      entry({ attemptId: 'a1', level: 1, name: 'Ana', score: 10 }),
      entry({ attemptId: 'a3', level: 1, name: 'Cara', score: 7 }),
    ]);
    expect(entriesForActiveFilter(mixed, 2)).toEqual([
      entry({ attemptId: 'a2', level: 2, name: 'Ben', score: 9 }),
    ]);
  });

  it('returns empty when stale parent rows do not match the selected filter', () => {
    // Simulates global/old-level cache still present after switching to Level 3
    // while the matching request is loading.
    expect(entriesForActiveFilter(mixed, 3)).toEqual([]);
  });
});