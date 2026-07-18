import { describe, expect, it } from 'vitest';
import { PASS_THRESHOLD } from '../../content/levels';
import {
  applyPass,
  createInitialProgress,
  isPassed,
  isPassingScore,
  isUnlocked,
  nextLevel,
  parseProgress,
} from '../levelProgress';

describe('createInitialProgress', () => {
  it('starts with no levels passed', () => {
    const p = createInitialProgress();
    expect(p.passed).toEqual([]);
  });

  it('returns a fresh object each call', () => {
    const a = createInitialProgress();
    a.passed.push(1);
    const b = createInitialProgress();
    expect(b.passed).toEqual([]);
  });
});

describe('isPassingScore', () => {
  it('passes at 9 (PASS_THRESHOLD)', () => {
    expect(isPassingScore(PASS_THRESHOLD)).toBe(true);
  });

  it('passes at 10', () => {
    expect(isPassingScore(10)).toBe(true);
  });

  it('does not pass below 9', () => {
    expect(isPassingScore(8)).toBe(false);
    expect(isPassingScore(0)).toBe(false);
  });
});

describe('isPassed / isUnlocked (fresh student)', () => {
  const fresh = createInitialProgress();

  it('Level 1 is unlocked for a fresh student', () => {
    expect(isUnlocked(fresh, 1)).toBe(true);
  });

  it('Levels 2-10 are locked for a fresh student', () => {
    for (let id = 2; id <= 10; id += 1) {
      expect(isUnlocked(fresh, id as never)).toBe(false);
    }
  });

  it('no level is passed for a fresh student', () => {
    for (let id = 1; id <= 10; id += 1) {
      expect(isPassed(fresh, id as never)).toBe(false);
    }
  });
});

describe('applyPass', () => {
  it('marks the level passed when the score meets the threshold', () => {
    const fresh = createInitialProgress();
    const p = applyPass(fresh, 1, PASS_THRESHOLD);
    expect(p.passed).toEqual([1]);
    expect(isPassed(p, 1)).toBe(true);
  });

  it('does NOT mark the level passed when the score is below the threshold', () => {
    const fresh = createInitialProgress();
    const p = applyPass(fresh, 1, PASS_THRESHOLD - 1);
    expect(p.passed).toEqual([]);
    expect(isPassed(p, 1)).toBe(false);
  });

  it('unlocks the next level after passing', () => {
    // Spec scenario: "Nine or more correct answers passes the level".
    const p = applyPass(createInitialProgress(), 4, 9);
    expect(isPassed(p, 4)).toBe(true);
    expect(isUnlocked(p, 5)).toBe(true);
  });

  it('does not unlock the next level when the score does not pass', () => {
    // Spec scenario: "Fewer than nine correct answers does not pass".
    const p = applyPass(createInitialProgress(), 4, 8);
    expect(isPassed(p, 4)).toBe(false);
    expect(isUnlocked(p, 5)).toBe(false);
  });

  it('is idempotent (passing an already-passed level does not duplicate)', () => {
    const p1 = applyPass(createInitialProgress(), 1, 9);
    const p2 = applyPass(p1, 1, 10);
    expect(p2.passed).toEqual([1]);
  });

  it('is sticky: passing is never revoked even on a retake score below threshold', () => {
    // Spec scenario: "Retaking a passed level ... passed/unlocked state MUST
    // NOT be revoked regardless of the retake's outcome".
    const p1 = applyPass(createInitialProgress(), 2, 10);
    const p2 = applyPass(p1, 2, 0);
    expect(isPassed(p2, 2)).toBe(true);
    expect(isUnlocked(p2, 3)).toBe(true);
  });

  it('sorts the passed array ascending', () => {
    let p = createInitialProgress();
    p = applyPass(p, 3, 9);
    p = applyPass(p, 1, 9);
    expect(p.passed).toEqual([1, 3]);
  });

  it('does not mutate the input progress', () => {
    const fresh = createInitialProgress();
    const next = applyPass(fresh, 1, 9);
    expect(fresh.passed).toEqual([]);
    expect(next).not.toBe(fresh);
  });
});

describe('nextLevel', () => {
  it('returns the next level id for levels 1-9', () => {
    expect(nextLevel(1)).toBe(2);
    expect(nextLevel(9)).toBe(10);
  });

  it('returns null for Level 10 (no next level)', () => {
    expect(nextLevel(10)).toBe(null);
  });
});

describe('parseProgress', () => {
  it('parses a valid progress object', () => {
    const p = parseProgress({ passed: [1, 3, 5] });
    expect(p).not.toBeNull();
    expect(p?.passed).toEqual([1, 3, 5]);
  });

  it('sorts and de-dupes the passed array', () => {
    const p = parseProgress({ passed: [3, 1, 3, 5] });
    expect(p?.passed).toEqual([1, 3, 5]);
  });

  it('returns null for non-object input', () => {
    expect(parseProgress(null)).toBeNull();
    expect(parseProgress('string')).toBeNull();
    expect(parseProgress(42)).toBeNull();
  });

  it('returns null when passed is not an array', () => {
    expect(parseProgress({ passed: 'nope' })).toBeNull();
    expect(parseProgress({})).toBeNull();
  });

  it('returns null when a passed id is out of range or non-integer', () => {
    expect(parseProgress({ passed: [0] })).toBeNull();
    expect(parseProgress({ passed: [11] })).toBeNull();
    expect(parseProgress({ passed: [1.5] })).toBeNull();
    expect(parseProgress({ passed: ['2'] })).toBeNull();
  });

  it('returns null for an empty passed array (valid fresh state)', () => {
    // An empty array is a valid fresh state.
    const p = parseProgress({ passed: [] });
    expect(p).not.toBeNull();
    expect(p?.passed).toEqual([]);
  });
});