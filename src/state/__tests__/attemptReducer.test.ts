import { describe, expect, it } from 'vitest';
import {
  attemptReducer,
  createInitialAttempt,
  type AttemptData,
} from '../attemptReducer';
import { LEVEL_SIZE } from '../../content/levels';

function inProgress(overrides: Partial<AttemptData> = {}): AttemptData {
  return {
    state: 'in-progress',
    attemptId: 'att-1',
    name: 'Maria',
    levelId: 2,
    answers: [],
    total: LEVEL_SIZE,
    ...overrides,
  };
}

function startAction(overrides: Partial<{
  name: string;
  attemptId: string;
  levelId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  total: number;
}> = {}) {
  return {
    type: 'start' as const,
    name: 'Maria',
    attemptId: 'att-1',
    levelId: 2 as const,
    total: LEVEL_SIZE,
    ...overrides,
  };
}

describe('createInitialAttempt', () => {
  it('starts in not-started with no name, level, or answers', () => {
    const s = createInitialAttempt();
    expect(s.state).toBe('not-started');
    expect(s.name).toBe('');
    expect(s.levelId).toBe(0);
    expect(s.answers).toHaveLength(0);
    expect(s.attemptId).toBe('');
    expect(s.total).toBe(0);
  });

  it('returns a fresh object each call (no shared mutable state)', () => {
    const a = createInitialAttempt();
    a.answers.push({ exerciseId: 'x', given: 'y' });
    const b = createInitialAttempt();
    expect(b.answers).toHaveLength(0);
  });
});

describe('attemptReducer — start', () => {
  it('transitions not-started -> in-progress with name, attemptId, and levelId', () => {
    const s = attemptReducer(createInitialAttempt(), startAction());
    expect(s.state).toBe('in-progress');
    expect(s.name).toBe('Maria');
    expect(s.attemptId).toBe('att-1');
    expect(s.levelId).toBe(2);
    expect(s.total).toBe(LEVEL_SIZE);
    expect(s.answers).toHaveLength(0);
  });

  it('defaults total to LEVEL_SIZE (10) when omitted', () => {
    const s = attemptReducer(createInitialAttempt(), {
      type: 'start',
      name: 'Maria',
      attemptId: 'att-1',
      levelId: 3,
    });
    expect(s.total).toBe(LEVEL_SIZE);
  });

  it('trims the display name on start', () => {
    const s = attemptReducer(createInitialAttempt(), startAction({ name: '  Maria  ' }));
    expect(s.name).toBe('Maria');
  });

  it('rejects an empty/whitespace name (returns state unchanged)', () => {
    const before = createInitialAttempt();
    const s = attemptReducer(before, startAction({ name: '   ' }));
    expect(s).toBe(before);
  });

  it('rejects an empty attemptId', () => {
    const before = createInitialAttempt();
    const s = attemptReducer(before, startAction({ attemptId: '' }));
    expect(s).toBe(before);
  });

  it('rejects an invalid levelId (out of range 1-10)', () => {
    const before = createInitialAttempt();
    const s = attemptReducer(before, startAction({ levelId: 0 as never }));
    expect(s).toBe(before);
    const s2 = attemptReducer(before, startAction({ levelId: 11 as never }));
    expect(s2).toBe(before);
  });
});

describe('attemptReducer — answer (accepted only in-progress)', () => {
  it('records an answer while in-progress', () => {
    const s = attemptReducer(inProgress(), {
      type: 'answer',
      exerciseId: 'e1',
      given: 'play',
    });
    expect(s.answers).toEqual([{ exerciseId: 'e1', given: 'play' }]);
    expect(s.state).toBe('in-progress');
  });

  it('replaces an existing answer for the same exercise (no duplicate count)', () => {
    const s = attemptReducer(inProgress({ answers: [{ exerciseId: 'e1', given: 'play' }] }), {
      type: 'answer',
      exerciseId: 'e1',
      given: 'plays',
    });
    expect(s.answers).toEqual([{ exerciseId: 'e1', given: 'plays' }]);
    expect(s.answers).toHaveLength(1);
  });

  it('does not mutate the input state', () => {
    const base = inProgress();
    const next = attemptReducer(base, {
      type: 'answer',
      exerciseId: 'e1',
      given: 'play',
    });
    expect(base.answers).toHaveLength(0);
    expect(next).not.toBe(base);
    expect(next.answers).not.toBe(base.answers);
  });

  it('transitions to completed when the last expected answer is recorded', () => {
    // total 4: 3 answered, the 4th completes the attempt.
    let s = inProgress({
      answers: [
        { exerciseId: 'e1', given: 'a' },
        { exerciseId: 'e2', given: 'b' },
        { exerciseId: 'e3', given: 'c' },
      ],
      total: 4,
    });
    s = attemptReducer(s, { type: 'answer', exerciseId: 'e4', given: 'd' });
    expect(s.state).toBe('completed');
    expect(s.answers).toHaveLength(4);
  });

  it('does not complete early if answers are replaced rather than added', () => {
    let s = inProgress({
      answers: [
        { exerciseId: 'e1', given: 'a' },
        { exerciseId: 'e2', given: 'b' },
        { exerciseId: 'e3', given: 'c' },
      ],
      total: 4,
    });
    // Replace e1 — still 3 distinct, not completed.
    s = attemptReducer(s, { type: 'answer', exerciseId: 'e1', given: 'x' });
    expect(s.state).toBe('in-progress');
    expect(s.answers).toHaveLength(3);
  });

  it('rejects answers when not-started', () => {
    const before = createInitialAttempt();
    const s = attemptReducer(before, { type: 'answer', exerciseId: 'e1', given: 'a' });
    expect(s).toBe(before);
  });

  it('rejects answers after completed (post-completion rejection)', () => {
    const before: AttemptData = {
      state: 'completed',
      attemptId: 'att-1',
      name: 'Maria',
      levelId: 2,
      answers: [{ exerciseId: 'e1', given: 'a' }],
      total: 1,
    };
    const s = attemptReducer(before, { type: 'answer', exerciseId: 'e2', given: 'b' });
    expect(s).toBe(before);
  });

  it('ignores answers when total is not positive (defensive)', () => {
    const before = inProgress({ total: 0 });
    const s = attemptReducer(before, { type: 'answer', exerciseId: 'e1', given: 'a' });
    expect(s).toBe(before);
  });

  it('completes the attempt after the level size (10) answers', () => {
    // Spec scenario: "Attempt completes after the level's last exercise".
    const ids = Array.from({ length: LEVEL_SIZE }, (_, i) => `e${i + 1}`);
    const answers = ids.slice(0, LEVEL_SIZE - 1).map((id) => ({ exerciseId: id, given: 'x' }));
    let s = inProgress({ total: LEVEL_SIZE, answers });
    s = attemptReducer(s, { type: 'answer', exerciseId: ids[LEVEL_SIZE - 1], given: 'x' });
    expect(s.state).toBe('completed');
    expect(s.answers).toHaveLength(LEVEL_SIZE);
  });
});

describe('attemptReducer — complete (skip/finish blanks)', () => {
  it('materializes blanks for skipped/unanswered exercises and completes', () => {
    const s = attemptReducer(
      inProgress({
        answers: [{ exerciseId: 'e2', given: 'plays' }],
        total: 4,
      }),
      { type: 'complete', exerciseIds: ['e1', 'e2', 'e3', 'e4'] },
    );
    expect(s.state).toBe('completed');
    expect(s.answers).toEqual([
      { exerciseId: 'e1', given: '' },
      { exerciseId: 'e2', given: 'plays' },
      { exerciseId: 'e3', given: '' },
      { exerciseId: 'e4', given: '' },
    ]);
    expect(s.total).toBe(4);
  });

  it('preserves all recorded answers in catalog order when finishing after skips', () => {
    const s = attemptReducer(
      inProgress({
        answers: [
          { exerciseId: 'e1', given: 'a' },
          { exerciseId: 'e4', given: 'd' },
        ],
        total: 4,
      }),
      { type: 'complete', exerciseIds: ['e1', 'e2', 'e3', 'e4'] },
    );
    expect(s.state).toBe('completed');
    expect(s.answers.map((a) => a.exerciseId)).toEqual(['e1', 'e2', 'e3', 'e4']);
    expect(s.answers.map((a) => a.given)).toEqual(['a', '', '', 'd']);
  });

  it('rejects complete when not in-progress', () => {
    const before: AttemptData = {
      state: 'completed',
      attemptId: 'att-1',
      name: 'Maria',
      levelId: 2,
      answers: [{ exerciseId: 'e1', given: 'a' }],
      total: 1,
    };
    const s = attemptReducer(before, { type: 'complete', exerciseIds: ['e1'] });
    expect(s).toBe(before);
  });

  it('rejects complete with an empty exercise id list', () => {
    const before = inProgress();
    const s = attemptReducer(before, { type: 'complete', exerciseIds: [] });
    expect(s).toBe(before);
  });

  it('preserves the levelId across complete', () => {
    const s = attemptReducer(
      inProgress({ levelId: 5 }),
      { type: 'complete', exerciseIds: ['e1'] },
    );
    expect(s.levelId).toBe(5);
  });
});

describe('attemptReducer — retake', () => {
  it('starts a fresh in-progress attempt with a new attemptId, keeping name and levelId', () => {
    const completed: AttemptData = {
      state: 'completed',
      attemptId: 'A',
      name: 'Maria',
      levelId: 2,
      answers: [{ exerciseId: 'e1', given: 'a' }],
      total: LEVEL_SIZE,
    };
    const s = attemptReducer(completed, { type: 'retake', attemptId: 'B' });
    expect(s.state).toBe('in-progress');
    expect(s.attemptId).toBe('B');
    expect(s.attemptId).not.toBe('A');
    expect(s.name).toBe('Maria');
    expect(s.levelId).toBe(2);
    expect(s.total).toBe(LEVEL_SIZE);
    expect(s.answers).toHaveLength(0);
  });

  it('preserves the levelId across retake (retake targets the same level)', () => {
    // Spec scenario: "Retake targets the same level".
    const completed: AttemptData = {
      state: 'completed',
      attemptId: 'A',
      name: 'Maria',
      levelId: 7,
      answers: [],
      total: LEVEL_SIZE,
    };
    const s = attemptReducer(completed, { type: 'retake', attemptId: 'B' });
    expect(s.levelId).toBe(7);
  });

  it('rejects an empty retake attemptId', () => {
    const completed: AttemptData = {
      state: 'completed',
      attemptId: 'A',
      name: 'Maria',
      levelId: 2,
      answers: [],
      total: LEVEL_SIZE,
    };
    const s = attemptReducer(completed, { type: 'retake', attemptId: '' });
    expect(s).toBe(completed);
  });

  it('clears previous answers on retake', () => {
    const completed: AttemptData = {
      state: 'completed',
      attemptId: 'A',
      name: 'Maria',
      levelId: 2,
      answers: [
        { exerciseId: 'e1', given: 'a' },
        { exerciseId: 'e2', given: 'b' },
      ],
      total: LEVEL_SIZE,
    };
    const s = attemptReducer(completed, { type: 'retake', attemptId: 'B' });
    expect(s.answers).toHaveLength(0);
  });

  it('allows retake from in-progress too (defensive)', () => {
    const s = attemptReducer(inProgress({ attemptId: 'A' }), {
      type: 'retake',
      attemptId: 'B',
    });
    expect(s.state).toBe('in-progress');
    expect(s.attemptId).toBe('B');
  });
});

describe('attemptReducer — reset', () => {
  it('returns to not-started with no name, level, or answers', () => {
    const completed: AttemptData = {
      state: 'completed',
      attemptId: 'A',
      name: 'Maria',
      levelId: 2,
      answers: [{ exerciseId: 'e1', given: 'a' }],
      total: LEVEL_SIZE,
    };
    const s = attemptReducer(completed, { type: 'reset' });
    expect(s.state).toBe('not-started');
    expect(s.name).toBe('');
    expect(s.attemptId).toBe('');
    expect(s.levelId).toBe(0);
    expect(s.answers).toHaveLength(0);
    expect(s.total).toBe(0);
  });
});