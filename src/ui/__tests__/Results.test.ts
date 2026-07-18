import { describe, expect, it } from 'vitest';
import {
  canAdvance,
  didPass,
} from '../Results';
import { PASS_THRESHOLD } from '../../content/levels';

describe('didPass (pure helper)', () => {
  it('passes at PASS_THRESHOLD (9)', () => {
    expect(didPass(PASS_THRESHOLD)).toBe(true);
  });

  it('passes at 10', () => {
    expect(didPass(10)).toBe(true);
  });

  it('does not pass below 9', () => {
    expect(didPass(8)).toBe(false);
    expect(didPass(0)).toBe(false);
  });
});

describe('canAdvance (pure helper)', () => {
  it('allows advancing when passed and levelId < 10', () => {
    expect(canAdvance(1, 9)).toBe(true);
    expect(canAdvance(5, 10)).toBe(true);
    expect(canAdvance(9, 9)).toBe(true);
  });

  it('blocks advancing when not passed', () => {
    expect(canAdvance(1, 8)).toBe(false);
  });

  it('blocks advancing from Level 10 (no next level)', () => {
    // Spec: "Level 10 completed" — no "next level" button.
    expect(canAdvance(10, 10)).toBe(false);
    expect(canAdvance(10, 9)).toBe(false);
  });

  it('Level 10 passed: no next level, but retake/level-select stay available', () => {
    // Spec scenario: "Level 10 completed" — passing Level 10 shows a
    // completion state; the student MAY still retake Level 10 or return to
    // LevelSelect. canAdvance gating only disables "next level"; retake and
    // back-to-levels stay available because leaderboard submit is best-effort.
    expect(canAdvance(10, 10)).toBe(false);
    expect(canAdvance(10, 9)).toBe(false);
  });
});
