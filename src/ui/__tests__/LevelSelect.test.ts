import { describe, expect, it } from 'vitest';
import { levelCardStatus } from '../LevelSelect';
import { applyPass, createInitialProgress, type LevelProgress } from '../../domain/levelProgress';

describe('levelCardStatus (pure helper)', () => {
  it('returns "unlocked" for Level 1 on a fresh student', () => {
    // Spec scenario: "Fresh student sees only Level 1 unlocked".
    expect(levelCardStatus(createInitialProgress(), 1)).toBe('unlocked');
  });

  it('returns "locked" for Levels 2-10 on a fresh student', () => {
    const fresh = createInitialProgress();
    for (let id = 2; id <= 10; id += 1) {
      expect(levelCardStatus(fresh, id as never)).toBe('locked');
    }
  });

  it('returns "passed" for a level that has been passed', () => {
    const p = applyPass(createInitialProgress(), 2, 9) as LevelProgress;
    expect(levelCardStatus(p, 2)).toBe('passed');
  });

  it('returns "unlocked" for the next level after passing', () => {
    const p = applyPass(createInitialProgress(), 2, 9) as LevelProgress;
    expect(levelCardStatus(p, 3)).toBe('unlocked');
  });

  it('returns "locked" for a level two steps ahead', () => {
    const p = applyPass(createInitialProgress(), 2, 9) as LevelProgress;
    expect(levelCardStatus(p, 4)).toBe('locked');
  });

  it('Level 10 is "locked" until Level 9 is passed', () => {
    const p = applyPass(createInitialProgress(), 9, 9) as LevelProgress;
    expect(levelCardStatus(p, 10)).toBe('unlocked');
    expect(levelCardStatus(applyPass(createInitialProgress(), 8, 9) as LevelProgress, 10)).toBe('locked');
  });

  it('a locked level reports "locked" (UI MUST block start with a friendly hint)', () => {
    // Spec scenario: "Locked level cannot be started".
    // The UI uses levelCardStatus to gate the start button; "locked" means
    // the button is disabled and the card shows a pass-the-previous-level hint.
    const fresh = createInitialProgress();
    for (let id = 2; id <= 10; id += 1) {
      expect(levelCardStatus(fresh, id as never)).toBe('locked');
    }
    // After passing Level 1, only Level 2 unlocks; 3-10 stay locked.
    const p1 = applyPass(fresh, 1, 9) as LevelProgress;
    expect(levelCardStatus(p1, 2)).toBe('unlocked');
    for (let id = 3; id <= 10; id += 1) {
      expect(levelCardStatus(p1, id as never)).toBe('locked');
    }
  });
});