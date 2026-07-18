import { describe, expect, it } from 'vitest';
import {
  ATTEMPT_DRAFT_VERSION,
  DRAFT_STORAGE_PREFIX,
  buildDraftFromAttempt,
  clearDraft,
  draftStorageKey,
  loadDraft,
  parseAttemptDraft,
  saveDraft,
  type AttemptDraft,
} from '../attemptDraftStore';
import { attemptReducer, createInitialAttempt } from '../attemptReducer';
import { LEVEL_SIZE } from '../../content/levels';

/**
 * Minimal in-memory `Storage`-like stub (same pattern as levelProgressStore tests).
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

describe('draftStorageKey', () => {
  it('builds the v1 key for name claim key + level', () => {
    expect(draftStorageKey('maria', 1)).toBe(`${DRAFT_STORAGE_PREFIX}maria:1`);
  });
});

describe('parseAttemptDraft', () => {
  it('accepts a valid draft payload', () => {
    expect(parseAttemptDraft(sampleDraft())).toEqual(sampleDraft());
  });

  it('rejects wrong version', () => {
    expect(parseAttemptDraft({ ...sampleDraft(), version: 99 })).toBeNull();
  });

  it('rejects full answer lists (completed attempts)', () => {
    const answers = LEVEL_EXERCISE_IDS.map((id) => ({ exerciseId: id, given: 'x' }));
    expect(parseAttemptDraft(sampleDraft({ answers }))).toBeNull();
  });

  it('rejects out-of-range exercise index', () => {
    expect(parseAttemptDraft(sampleDraft({ currentExerciseIndex: 10 }))).toBeNull();
    expect(parseAttemptDraft(sampleDraft({ currentExerciseIndex: -1 }))).toBeNull();
  });

  it('rejects answers that are not in the level snapshot', () => {
    expect(
      parseAttemptDraft(
        sampleDraft({
          answers: [{ exerciseId: 'unknown', given: 'x' }],
        }),
      ),
    ).toBeNull();
  });
});

describe('saveDraft / loadDraft', () => {
  it('round-trips a draft by name + level', () => {
    const storage = memoryStorage();
    const draft = sampleDraft();
    saveDraft(storage, draft);
    const loaded = loadDraft(storage, 'maria', 1, {
      expectedTotal: LEVEL_SIZE,
      expectedExerciseIds: LEVEL_EXERCISE_IDS,
    });
    expect(loaded).toEqual(draft);
  });

  it('does not share drafts across different names', () => {
    const storage = memoryStorage();
    saveDraft(storage, sampleDraft({ name: 'Maria', nameClaimKey: 'maria' }));
    expect(loadDraft(storage, 'ana', 1)).toBeNull();
    expect(loadDraft(storage, 'maria', 1)?.nameClaimKey).toBe('maria');
  });

  it('does not share drafts across different levels for the same name', () => {
    const storage = memoryStorage();
    saveDraft(storage, sampleDraft({ levelId: 1 }));
    expect(loadDraft(storage, 'maria', 2)).toBeNull();
  });

  it('returns null when storage is null', () => {
    expect(loadDraft(null, 'maria', 1)).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    const storage = memoryStorage();
    storage.setItem(draftStorageKey('maria', 1), '{not-json');
    expect(loadDraft(storage, 'maria', 1)).toBeNull();
  });

  it('returns null when catalog exercise ids no longer match', () => {
    const storage = memoryStorage();
    saveDraft(storage, sampleDraft());
    const otherIds = LEVEL_EXERCISE_IDS.map((id) => `${id}-new`);
    expect(
      loadDraft(storage, 'maria', 1, {
        expectedTotal: LEVEL_SIZE,
        expectedExerciseIds: otherIds,
      }),
    ).toBeNull();
  });

  it('returns null when expected total mismatches', () => {
    const storage = memoryStorage();
    saveDraft(storage, sampleDraft());
    expect(loadDraft(storage, 'maria', 1, { expectedTotal: 9 })).toBeNull();
  });

  it('rejects corrupt draft where display name does not normalize to nameClaimKey', () => {
    const storage = memoryStorage();
    // Manually write a payload that claims Maria's key but carries Marco's name.
    // saveDraft would refuse this shape; real/corrupt storage might still hold it.
    const corrupt = {
      ...sampleDraft(),
      nameClaimKey: 'maria',
      name: 'Marco',
    };
    storage.setItem(draftStorageKey('maria', 1), JSON.stringify(corrupt));
    expect(loadDraft(storage, 'maria', 1)).toBeNull();
  });
});

describe('clearDraft', () => {
  it('removes a saved draft so it is not restored', () => {
    const storage = memoryStorage();
    saveDraft(storage, sampleDraft());
    clearDraft(storage, 'maria', 1);
    expect(loadDraft(storage, 'maria', 1)).toBeNull();
  });

  it('is a no-op when storage is null', () => {
    expect(() => clearDraft(null, 'maria', 1)).not.toThrow();
  });
});

describe('refresh-like restore flow (store + reducer)', () => {
  it('restores answers, attemptId, total, and current index after a refresh simulation', () => {
    const storage = memoryStorage();

    // Mid-level attempt: 3 answers, currently on question 4 (index 3).
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

    const draft = buildDraftFromAttempt({
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
    expect(draft).not.toBeNull();
    saveDraft(storage, draft!);

    // Simulate refresh: new reducer state + reload draft + restore.
    const loaded = loadDraft(storage, 'maria', 1, {
      expectedTotal: LEVEL_SIZE,
      expectedExerciseIds: LEVEL_EXERCISE_IDS,
    });
    expect(loaded).not.toBeNull();

    const restored = attemptReducer(createInitialAttempt(), {
      type: 'restore',
      name: loaded!.name,
      attemptId: loaded!.attemptId,
      levelId: loaded!.levelId,
      answers: loaded!.answers,
      total: loaded!.total,
    });

    expect(restored.state).toBe('in-progress');
    expect(restored.attemptId).toBe('att-mid-1');
    expect(restored.levelId).toBe(1);
    expect(restored.answers).toEqual([
      { exerciseId: 'l1-e1', given: 'goes' },
      { exerciseId: 'l1-e2', given: 'went' },
      { exerciseId: 'l1-e3', given: 'is going' },
    ]);
    expect(restored.total).toBe(LEVEL_SIZE);
    // App restores exerciseIndex from the draft independently of the reducer.
    expect(loaded!.currentExerciseIndex).toBe(3);
  });

  it('does not restore after the draft is cleared on complete', () => {
    const storage = memoryStorage();
    saveDraft(storage, sampleDraft());

    // Completing clears the draft (App + store contract).
    clearDraft(storage, 'maria', 1);
    expect(loadDraft(storage, 'maria', 1)).toBeNull();

    // Selecting the level again must start fresh (no restore action payload).
    const fresh = attemptReducer(createInitialAttempt(), {
      type: 'start',
      name: 'Maria',
      attemptId: 'att-new',
      levelId: 1,
      total: LEVEL_SIZE,
    });
    expect(fresh.attemptId).toBe('att-new');
    expect(fresh.answers).toHaveLength(0);
  });

  it('retake path uses a new attemptId and empty answers (draft cleared)', () => {
    const storage = memoryStorage();
    saveDraft(storage, sampleDraft({ attemptId: 'att-old' }));
    clearDraft(storage, 'maria', 1);

    const retaken = attemptReducer(
      {
        state: 'completed',
        attemptId: 'att-old',
        name: 'Maria',
        levelId: 1,
        answers: sampleDraft().answers,
        total: LEVEL_SIZE,
      },
      { type: 'retake', attemptId: 'att-new' },
    );

    expect(retaken.attemptId).toBe('att-new');
    expect(retaken.answers).toHaveLength(0);
    expect(loadDraft(storage, 'maria', 1)).toBeNull();
  });
});
