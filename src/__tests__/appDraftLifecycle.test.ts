import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AppHeader,
  decideDraftLifecycle,
  decideLevelStartFromDraft,
  studentLevelBadgeText,
} from '../App';
import {
  ATTEMPT_DRAFT_VERSION,
  buildDraftFromAttempt,
  clearDraft,
  draftStorageKey,
  loadDraft,
  saveDraft,
  type AttemptDraft,
} from '../state/attemptDraftStore';
import { attemptReducer, createInitialAttempt } from '../state/attemptReducer';
import { LEVEL_SIZE } from '../content/levels';

/**
 * In-memory Storage stub (same pattern as attemptDraftStore tests).
 */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string): string | null {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number): string | null {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    },
  };
}

const LEVEL_EXERCISE_IDS = [
  'l1-e1',
  'l1-e2',
  'l1-e3',
  'l1-e4',
  'l1-e5',
  'l1-e6',
  'l1-e7',
  'l1-e8',
  'l1-e9',
  'l1-e10',
] as const;

function sampleDraft(overrides: Partial<AttemptDraft> = {}): AttemptDraft {
  return {
    version: ATTEMPT_DRAFT_VERSION,
    name: 'Maria',
    nameClaimKey: 'maria',
    attemptId: 'att-mid-1',
    levelId: 1,
    answers: [
      { exerciseId: 'l1-e1', given: 'goes' },
      { exerciseId: 'l1-e2', given: 'went' },
      { exerciseId: 'l1-e3', given: 'is going' },
    ],
    total: LEVEL_SIZE,
    currentExerciseIndex: 3,
    exerciseIds: [...LEVEL_EXERCISE_IDS],
    ...overrides,
  };
}

/**
 * Mirrors App persistence effect: decide lifecycle, then save or clear.
 */
function applyAppDraftLifecycle(
  storage: Storage,
  input: {
    nameClaimKey: string;
    levelId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 0;
    attemptState: string;
    draft?: AttemptDraft | null;
  },
): void {
  const decision = decideDraftLifecycle({
    nameClaimKey: input.nameClaimKey,
    levelId: input.levelId,
    attemptState: input.attemptState,
  });
  if (decision === 'noop' || !input.levelId) return;
  if (decision === 'clear') {
    clearDraft(storage, input.nameClaimKey, input.levelId);
    return;
  }
  if (input.draft) saveDraft(storage, input.draft);
}

describe('decideLevelStartFromDraft (App wiring)', () => {
  it('renders current student and pick-level badge after name claim', () => {
    const html = renderToStaticMarkup(createElement(AppHeader, { claimedName: 'Maria', levelId: 0 }));

    expect(html).toContain('aria-label="Current student and level"');
    expect(html).toContain('Student');
    expect(html).toContain('Maria');
    expect(html).toContain('Level');
    expect(html).toContain('Pick a level');
  });

  it('renders current student and selected level badge after level selection or restore', () => {
    const html = renderToStaticMarkup(createElement(AppHeader, { claimedName: 'Maria', levelId: 3 }));

    expect(html).toContain('Maria');
    expect(html).toContain('Level 3');
    expect(html).not.toContain('Pick a level');
  });

  it('does not render student badges before name claim', () => {
    const html = renderToStaticMarkup(createElement(AppHeader, { claimedName: '', levelId: 0 }));

    expect(html).toContain('English Practice');
    expect(html).not.toContain('Current student and level');
    expect(html).not.toContain('Pick a level');
  });

  it('formats the student level badge text', () => {
    expect(studentLevelBadgeText(0)).toBe('Pick a level');
    expect(studentLevelBadgeText(1)).toBe('Level 1');
    expect(studentLevelBadgeText(10)).toBe('Level 10');
  });

  it('restores attemptId, answers, and current index from a valid draft', () => {
    const draft = sampleDraft();
    const decision = decideLevelStartFromDraft(draft);
    expect(decision).toEqual({
      kind: 'restore',
      name: 'Maria',
      attemptId: 'att-mid-1',
      levelId: 1,
      answers: draft.answers,
      total: LEVEL_SIZE,
      currentExerciseIndex: 3,
    });
  });

  it('starts fresh when no draft is available', () => {
    expect(decideLevelStartFromDraft(null)).toEqual({ kind: 'start-fresh' });
  });
});

describe('decideDraftLifecycle (App wiring)', () => {
  it('saves while the attempt is in-progress with identity + level', () => {
    expect(
      decideDraftLifecycle({
        nameClaimKey: 'maria',
        levelId: 1,
        attemptState: 'in-progress',
      }),
    ).toBe('save');
  });

  it('clears when the attempt is completed (finish path)', () => {
    expect(
      decideDraftLifecycle({
        nameClaimKey: 'maria',
        levelId: 1,
        attemptState: 'completed',
      }),
    ).toBe('clear');
  });

  it('is a no-op without a claimed name', () => {
    expect(
      decideDraftLifecycle({
        nameClaimKey: '',
        levelId: 1,
        attemptState: 'in-progress',
      }),
    ).toBe('noop');
  });
});

describe('App refresh / cleanup contract (helpers + store)', () => {
  it('same normalized name + same level restores attemptId, answers, and index', () => {
    const storage = memoryStorage();

    // Mid-level progress as App would save via decideDraftLifecycle + buildDraft.
    let attempt = attemptReducer(createInitialAttempt(), {
      type: 'start',
      name: 'Maria',
      attemptId: 'att-mid-1',
      levelId: 1,
      total: LEVEL_SIZE,
    });
    attempt = attemptReducer(attempt, { type: 'answer', exerciseId: 'l1-e1', given: 'goes' });
    attempt = attemptReducer(attempt, { type: 'answer', exerciseId: 'l1-e2', given: 'went' });
    attempt = attemptReducer(attempt, {
      type: 'answer',
      exerciseId: 'l1-e3',
      given: 'is going',
    });
    const exerciseIndex = 3;

    const toSave = buildDraftFromAttempt({
      nameClaimKey: 'maria',
      name: attempt.name,
      attemptId: attempt.attemptId,
      levelId: attempt.levelId,
      answers: attempt.answers,
      total: attempt.total,
      currentExerciseIndex: exerciseIndex,
      exerciseIds: LEVEL_EXERCISE_IDS,
      state: attempt.state,
    });
    expect(toSave).not.toBeNull();
    applyAppDraftLifecycle(storage, {
      nameClaimKey: 'maria',
      levelId: 1,
      attemptState: 'in-progress',
      draft: toSave,
    });

    // Refresh simulation: load under same claim key + level, then App start decision.
    const loaded = loadDraft(storage, 'maria', 1, {
      expectedTotal: LEVEL_SIZE,
      expectedExerciseIds: LEVEL_EXERCISE_IDS,
    });
    const start = decideLevelStartFromDraft(loaded);
    expect(start.kind).toBe('restore');
    if (start.kind !== 'restore') return;

    const restored = attemptReducer(createInitialAttempt(), {
      type: 'restore',
      name: start.name,
      attemptId: start.attemptId,
      levelId: start.levelId,
      answers: start.answers,
      total: start.total,
    });

    expect(restored.attemptId).toBe('att-mid-1');
    expect(restored.answers).toEqual([
      { exerciseId: 'l1-e1', given: 'goes' },
      { exerciseId: 'l1-e2', given: 'went' },
      { exerciseId: 'l1-e3', given: 'is going' },
    ]);
    expect(start.currentExerciseIndex).toBe(3);
    expect(restored.state).toBe('in-progress');
  });

  it('completion clears the draft so a later level select does not restore', () => {
    const storage = memoryStorage();
    saveDraft(storage, sampleDraft());
    expect(loadDraft(storage, 'maria', 1)).not.toBeNull();

    // App finish path: lifecycle says clear for completed.
    applyAppDraftLifecycle(storage, {
      nameClaimKey: 'maria',
      levelId: 1,
      attemptState: 'completed',
    });

    const loaded = loadDraft(storage, 'maria', 1);
    expect(loaded).toBeNull();
    expect(decideLevelStartFromDraft(loaded)).toEqual({ kind: 'start-fresh' });
  });

  it('retake clears the draft so the next start is fresh', () => {
    const storage = memoryStorage();
    saveDraft(storage, sampleDraft({ attemptId: 'att-old' }));

    // App retake path clears before starting a new attemptId.
    applyAppDraftLifecycle(storage, {
      nameClaimKey: 'maria',
      levelId: 1,
      attemptState: 'completed',
    });

    expect(loadDraft(storage, 'maria', 1)).toBeNull();
    expect(decideLevelStartFromDraft(null).kind).toBe('start-fresh');
    // Storage key must be gone (not just load-rejected).
    expect(storage.getItem(draftStorageKey('maria', 1))).toBeNull();
  });
});
