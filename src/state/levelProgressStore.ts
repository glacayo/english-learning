import { useCallback, useEffect, useState } from 'react';
import type { LevelId } from '../domain/types';
import {
  applyPass,
  createInitialProgress,
  isPassed,
  isUnlocked,
  nextLevel,
  parseProgress,
  type LevelProgress,
} from '../domain/levelProgress';

/**
 * Per-student level progression persistence (level-progression spec +
 * design.md "Progression store").
 *
 * Progress is keyed by the student's claimed-name identity key
 * (`nameClaimKey`) so two children on a shared device do NOT inherit each
 * other's unlocked levels. The storage key follows the contract in
 * design.md:
 *
 *   `english-learning:progress:v1:{nameClaimKey}`
 *
 * v1 is same-browser only; cross-device sync is deferred (design.md). The
 * hook loads once per `nameClaimKey`, persists on every pass, and exposes
 * pure-derived helpers (`isUnlocked`, `isPassed`, `nextLevel`) bound to the
 * loaded progress.
 *
 * The hook degrades gracefully when `localStorage` is unavailable (private
 * mode, SSR, test env without a DOM): it keeps an in-memory `LevelProgress`
 * that is never persisted, so the app still works for the session.
 */

/**
 * Storage key prefix (design.md "Progression store"). The version segment
 * (`v1`) allows a future schema migration to ignore legacy keys without
 * deleting them.
 */
export const PROGRESS_STORAGE_PREFIX = 'english-learning:progress:v1:';

/**
 * Build the localStorage key for a given claimed-name identity key.
 *
 * `nameClaimKey` SHOULD be the normalized claim identity (trim + case-fold),
 * NOT the raw typed display name, so "Maria" and "maria" share one progress
 * store. The store does not validate the claim itself — the caller supplies
 * the resolved key from the claim-name flow.
 *
 * Pure function: no I/O.
 */
export function progressStorageKey(nameClaimKey: string): string {
  return `${PROGRESS_STORAGE_PREFIX}${nameClaimKey}`;
}

/**
 * Read persisted progress for a student identity from a `Storage`-like object.
 * Returns `null` when the key is absent or the stored JSON is invalid, so the
 * caller falls back to fresh progress (level-progression spec: a fresh student
 * sees only Level 1 unlocked).
 *
 * Accepts the storage as an argument so tests can inject a mock without the
 * DOM. Pure-ish: reads but does not write.
 */
export function loadProgress(
  storage: Storage | null,
  nameClaimKey: string,
): LevelProgress {
  if (!storage) return createInitialProgress();
  const key = progressStorageKey(nameClaimKey);
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    // Quota/security errors → treat as fresh progress, never crash the app.
    return createInitialProgress();
  }
  if (raw === null) return createInitialProgress();
  try {
    const parsed = parseProgress(JSON.parse(raw));
    return parsed ?? createInitialProgress();
  } catch {
    // Corrupt JSON → fresh progress rather than throwing.
    return createInitialProgress();
  }
}

/**
 * Write progress for a student identity to a `Storage`-like object. Swallows
 * storage errors so a full quota or disabled storage never breaks the app.
 */
export function saveProgress(
  storage: Storage | null,
  nameClaimKey: string,
  progress: LevelProgress,
): void {
  if (!storage) return;
  const key = progressStorageKey(nameClaimKey);
  try {
    storage.setItem(key, JSON.stringify(progress));
  } catch {
    // Best-effort persistence; in-memory state still works for the session.
  }
}

/**
 * Resolve `localStorage` once, defensively. Returns `null` in non-browser
 * environments or when access throws (e.g. disabled cookies / private mode).
 */
function getLocalStorage(): Storage | null {
  try {
    const w = globalThis as unknown as { localStorage?: Storage };
    return w.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Hook return shape: the loaded progress plus the pure-derived helpers bound
 * to it and an imperative `markPassed` that persists a pass and re-renders.
 */
export interface UseLevelProgress {
  progress: LevelProgress;
  isUnlocked: (id: LevelId) => boolean;
  isPassed: (id: LevelId) => boolean;
  nextLevel: (id: LevelId) => LevelId | null;
  /** Record a pass for `id` if `score` meets the threshold; persists and re-renders. */
  markPassed: (id: LevelId, score: number) => void;
}

/**
 * React hook: load and persist per-student level progression.
 *
 * Loads once on mount / when `nameClaimKey` changes. `markPassed` applies the
 * pass through the pure `applyPass` helper and persists the result. When
 * `nameClaimKey` is empty (no student claimed yet) the hook returns fresh
 * progress so the UI can render Level 1 unlocked without a crash.
 */
export function useLevelProgress(nameClaimKey: string): UseLevelProgress {
  const [progress, setProgress] = useState<LevelProgress>(() =>
    loadProgress(getLocalStorage(), nameClaimKey),
  );

  // Reload when the claimed identity changes (e.g. switching students).
  useEffect(() => {
    setProgress(loadProgress(getLocalStorage(), nameClaimKey));
  }, [nameClaimKey]);

  const markPassed = useCallback(
    (id: LevelId, score: number) => {
      setProgress((prev) => {
        const next = applyPass(prev, id, score);
        if (next === prev) return prev;
        saveProgress(getLocalStorage(), nameClaimKey, next);
        return next;
      });
    },
    [nameClaimKey],
  );

  return {
    progress,
    isUnlocked: (id) => isUnlocked(progress, id),
    isPassed: (id) => isPassed(progress, id),
    nextLevel: (id) => nextLevel(id),
    markPassed,
  };
}