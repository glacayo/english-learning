import type { LevelId } from '../domain/types';
import { toLevelId } from '../content/levels';
import { normalizeName } from '../domain/leaderboard';
import type { AttemptAnswer } from './attemptReducer';

/**
 * In-progress attempt draft persistence (student-session: refresh-safe resume).
 *
 * When a child is mid-level and the page reloads, the app must restore the same
 * attempt (same attemptId, answers, and current exercise index) after they
 * re-enter the same normalized name and select the same level.
 *
 * Storage key contract:
 *   `english-learning:attempt-draft:v1:{nameClaimKey}:{levelId}`
 *
 * Scope is same-browser / same-device only (mirrors progression store). Distinct
 * names and distinct levels never share a draft. Completed / retaken attempts
 * clear the draft so the next start is fresh.
 *
 * Callers inject `Storage | null` so unit tests do not need a DOM, and so the
 * app degrades gracefully when localStorage is unavailable.
 */

/** Schema version embedded in every draft payload. */
export const ATTEMPT_DRAFT_VERSION = 1 as const;

/**
 * Storage key prefix. The version segment (`v1`) lets a future schema ignore
 * legacy keys without deleting them.
 */
export const DRAFT_STORAGE_PREFIX = 'english-learning:attempt-draft:v1:';

/**
 * Persisted shape for an in-progress attempt. Only `version === 1` drafts are
 * accepted by the loader; unknown versions are treated as missing.
 */
export interface AttemptDraft {
  version: typeof ATTEMPT_DRAFT_VERSION;
  name: string;
  nameClaimKey: string;
  attemptId: string;
  levelId: LevelId;
  answers: AttemptAnswer[];
  total: number;
  currentExerciseIndex: number;
  /**
   * Snapshot of the level's exercise ids at save time. Used to reject drafts
   * when the catalog partition for that level has changed.
   */
  exerciseIds: string[];
}

/**
 * Optional catalog compatibility constraints supplied by the caller when
 * loading. When present, drafts that disagree with the live level are ignored.
 */
export interface DraftLoadOptions {
  expectedTotal?: number;
  expectedExerciseIds?: readonly string[];
}

/**
 * Build the localStorage key for a draft scoped to identity + level.
 *
 * Pure function: no I/O.
 */
export function draftStorageKey(nameClaimKey: string, levelId: LevelId): string {
  return `${DRAFT_STORAGE_PREFIX}${nameClaimKey}:${levelId}`;
}

/**
 * Normalize an arbitrary parsed value into a valid `AttemptDraft`, or return
 * `null` when the shape/version is invalid. Pure: no I/O.
 */
export function parseAttemptDraft(value: unknown): AttemptDraft | null {
  if (value === null || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;

  if (raw.version !== ATTEMPT_DRAFT_VERSION) return null;

  if (typeof raw.name !== 'string' || raw.name.trim().length === 0) return null;
  if (typeof raw.nameClaimKey !== 'string' || raw.nameClaimKey.trim().length === 0) {
    return null;
  }
  // Display name must normalize to the same identity key stored on the draft.
  // Rejects corrupt/stale payloads such as nameClaimKey "maria" with name "Marco".
  const name = raw.name.trim();
  const nameClaimKey = raw.nameClaimKey.trim();
  if (normalizeName(name) !== nameClaimKey) return null;
  if (typeof raw.attemptId !== 'string' || raw.attemptId.length === 0) return null;

  const levelId = toLevelId(raw.levelId);
  if (levelId === null) return null;

  if (typeof raw.total !== 'number' || !Number.isInteger(raw.total) || raw.total <= 0) {
    return null;
  }

  if (
    typeof raw.currentExerciseIndex !== 'number' ||
    !Number.isInteger(raw.currentExerciseIndex) ||
    raw.currentExerciseIndex < 0 ||
    raw.currentExerciseIndex >= raw.total
  ) {
    return null;
  }

  if (!Array.isArray(raw.answers)) return null;
  // A full answer list means the attempt should already be completed — do not
  // resume a finished attempt as in-progress.
  if (raw.answers.length >= raw.total) return null;

  const answers: AttemptAnswer[] = [];
  const seen = new Set<string>();
  for (const item of raw.answers) {
    if (item === null || typeof item !== 'object') return null;
    const a = item as { exerciseId?: unknown; given?: unknown };
    if (typeof a.exerciseId !== 'string' || a.exerciseId.length === 0) return null;
    if (typeof a.given !== 'string') return null;
    if (seen.has(a.exerciseId)) return null;
    seen.add(a.exerciseId);
    answers.push({ exerciseId: a.exerciseId, given: a.given });
  }

  if (!Array.isArray(raw.exerciseIds) || raw.exerciseIds.length === 0) return null;
  const exerciseIds: string[] = [];
  for (const id of raw.exerciseIds) {
    if (typeof id !== 'string' || id.length === 0) return null;
    exerciseIds.push(id);
  }
  if (exerciseIds.length !== raw.total) return null;

  // Every recorded answer must belong to the level snapshot.
  const allowed = new Set(exerciseIds);
  for (const a of answers) {
    if (!allowed.has(a.exerciseId)) return null;
  }

  return {
    version: ATTEMPT_DRAFT_VERSION,
    name,
    nameClaimKey,
    attemptId: raw.attemptId,
    levelId,
    answers,
    total: raw.total,
    currentExerciseIndex: raw.currentExerciseIndex,
    exerciseIds,
  };
}

/**
 * True when a parsed draft is compatible with the live level catalog.
 * Pure function.
 */
export function isDraftCompatibleWithLevel(
  draft: AttemptDraft,
  options?: DraftLoadOptions,
): boolean {
  if (options?.expectedTotal !== undefined && draft.total !== options.expectedTotal) {
    return false;
  }
  if (options?.expectedExerciseIds !== undefined) {
    const expected = options.expectedExerciseIds;
    if (expected.length !== draft.exerciseIds.length) return false;
    for (let i = 0; i < expected.length; i += 1) {
      if (expected[i] !== draft.exerciseIds[i]) return false;
    }
  }
  return true;
}

/**
 * Read an in-progress draft for identity + level. Returns `null` when absent,
 * corrupt, version-mismatched, or incompatible with the live catalog options.
 */
export function loadDraft(
  storage: Storage | null,
  nameClaimKey: string,
  levelId: LevelId,
  options?: DraftLoadOptions,
): AttemptDraft | null {
  if (!storage) return null;
  if (nameClaimKey.trim().length === 0) return null;
  if (toLevelId(levelId) === null) return null;

  const key = draftStorageKey(nameClaimKey, levelId);
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;

  try {
    const parsed = parseAttemptDraft(JSON.parse(raw));
    if (!parsed) return null;
    const claimKey = nameClaimKey.trim();
    // Identity/level in the payload must match the lookup key.
    if (parsed.nameClaimKey !== claimKey) return null;
    // Display name must normalize to the same identity as the storage key.
    // Guards corrupt drafts where nameClaimKey was rewritten without name.
    if (normalizeName(parsed.name) !== claimKey) return null;
    if (parsed.levelId !== levelId) return null;
    if (!isDraftCompatibleWithLevel(parsed, options)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Persist an in-progress draft. Swallows storage errors so a full quota never
 * breaks the app. No-op when storage is null or the draft fails validation.
 */
export function saveDraft(storage: Storage | null, draft: AttemptDraft): void {
  if (!storage) return;
  const normalized = parseAttemptDraft(draft);
  if (!normalized) return;
  const key = draftStorageKey(normalized.nameClaimKey, normalized.levelId);
  try {
    storage.setItem(key, JSON.stringify(normalized));
  } catch {
    // Best-effort only.
  }
}

/**
 * Remove the draft for identity + level (after complete / retake / reset).
 * Swallows storage errors.
 */
export function clearDraft(
  storage: Storage | null,
  nameClaimKey: string,
  levelId: LevelId,
): void {
  if (!storage) return;
  if (nameClaimKey.trim().length === 0) return;
  if (toLevelId(levelId) === null) return;
  const key = draftStorageKey(nameClaimKey, levelId);
  try {
    storage.removeItem(key);
  } catch {
    // Best-effort only.
  }
}

/**
 * Resolve `localStorage` once, defensively. Returns `null` outside the browser
 * or when access throws.
 */
export function getDraftStorage(): Storage | null {
  try {
    const w = globalThis as unknown as { localStorage?: Storage };
    return w.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Build a draft payload from live attempt + navigation state. Returns `null`
 * when the attempt is not restorable as in-progress (wrong state / missing ids).
 * Pure helper used by App and tests.
 */
export function buildDraftFromAttempt(input: {
  nameClaimKey: string;
  name: string;
  attemptId: string;
  levelId: LevelId | 0;
  answers: readonly AttemptAnswer[];
  total: number;
  currentExerciseIndex: number;
  exerciseIds: readonly string[];
  state: string;
}): AttemptDraft | null {
  if (input.state !== 'in-progress') return null;
  const levelId = toLevelId(input.levelId);
  if (levelId === null) return null;
  return parseAttemptDraft({
    version: ATTEMPT_DRAFT_VERSION,
    name: input.name,
    nameClaimKey: input.nameClaimKey,
    attemptId: input.attemptId,
    levelId,
    answers: input.answers.map((a) => ({ exerciseId: a.exerciseId, given: a.given })),
    total: input.total,
    currentExerciseIndex: input.currentExerciseIndex,
    exerciseIds: [...input.exerciseIds],
  });
}
