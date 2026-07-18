import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { JSX } from 'react';
import { EXERCISES } from './content/exercises';
import { buildLevels, getLevel } from './content/levels';
import { gradeAttempt } from './domain/grading';
import { normalizeName } from './domain/leaderboard';
import { attemptReducer, createInitialAttempt } from './state/attemptReducer';
import { useLevelProgress } from './state/levelProgressStore';
import {
  claimName,
  createAttemptId,
  getLeaderboard,
  submitScore,
  type ApiResult,
} from './api/client';
import type {
  ClaimNameResponse,
  Level,
  LeaderboardEntry,
  LevelId,
} from './domain/types';
import { NameEntry } from './ui/NameEntry';
import { ExerciseRunner } from './ui/ExerciseRunner';
import { Results, type SubmitStatus } from './ui/Results';
import { LevelSelect } from './ui/LevelSelect';
import { Leaderboard, type LeaderboardStatus } from './ui/Leaderboard';

/**
 * App — wires the five screens (NameEntry, LevelSelect, ExerciseRunner,
 * Results, Leaderboard) around the attempt state machine, level progression,
 * and the typed API client.
 *
 * The UI always works locally: grading runs against the selected level's
 * exercises, so even when the API is unavailable (PR 3 ships before the Netlify
 * Functions in PR 4) the student sees their score, mistakes, recommendations,
 * and level status. The leaderboard submit/read fail gracefully with a
 * friendly message.
 */
export type Screen =
  | 'name-entry'
  | 'level-select'
  | 'exercise-runner'
  | 'results'
  | 'leaderboard';

/**
 * Resolve the display name used for attempt start / results / score submit
 * after a `claim-name` call.
 *
 * - Successful claim → prefer the server's canonical `name` (so "maria" after
 *   first claim "Maria" keeps one spelling on the leaderboard).
 * - Transport / API failure → fall back to the trimmed typed name so offline
 *   play still works.
 * - Server invalid → block start (caller shows guidance).
 *
 * `nameClaimKey` is the normalized identity key (trim + case-fold) used to
 * scope per-student level progression in localStorage (design.md "Progression
 * store": `english-learning:progress:v1:{nameClaimKey}`).
 */
export function resolveAttemptName(
  typedName: string,
  claim: ApiResult<ClaimNameResponse>,
):
  | { ok: true; name: string; nameClaimKey: string; notice?: string }
  | { ok: false; reason: 'invalid' } {
  const trimmed = typedName.trim();

  if (!claim.ok) {
    return { ok: true, name: trimmed, nameClaimKey: normalizeName(trimmed), notice: claim.message };
  }

  if (!claim.value.ok) {
    return { ok: false, reason: 'invalid' };
  }

  const canonical = (claim.value.name ?? '').trim();
  const name = canonical.length > 0 ? canonical : trimmed;
  return {
    ok: true,
    name,
    nameClaimKey: normalizeName(name),
  };
}

export function App(): JSX.Element {
  const [attempt, dispatch] = useReducer(attemptReducer, undefined, createInitialAttempt);
  const [screen, setScreen] = useState<Screen>('name-entry');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimNotice, setClaimNotice] = useState('');
  const [claimedName, setClaimedName] = useState('');
  const [nameClaimKey, setNameClaimKey] = useState('');
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ kind: 'idle' });
  const [leaderboardEntries, setLeaderboardEntries] = useState<readonly LeaderboardEntry[]>([]);
  const [leaderboardStatus, setLeaderboardStatus] = useState<LeaderboardStatus>({ kind: 'idle' });
  // Leaderboard view filter: null = global, 1..10 = per-level
  // (shared-leaderboard spec "Level-Aware Leaderboard Views").
  const [leaderboardLevelFilter, setLeaderboardLevelFilter] = useState<LevelId | null>(null);
  // Drop stale getLeaderboard responses when a newer load (or post-submit
  // invalidate) has already started.
  const leaderboardRequestId = useRef(0);

  // Build the 10 levels once from the flat catalog (design.md:
  // `difficulty === levelId`; `buildLevels()` groups by it).
  const levels = useMemo(() => buildLevels(EXERCISES), []);

  // Per-student level progression, persisted to localStorage under the
  // claimed-name identity key (design.md "Progression store").
  const {
    progress,
    isUnlocked,
    markPassed,
    nextLevel: nextUnlockedLevel,
  } = useLevelProgress(nameClaimKey);

  // The selected level's 10 exercises; derived from the attempt's levelId.
  const currentLevel: Level | undefined = useMemo(
    () => (attempt.levelId ? getLevel(levels, attempt.levelId) : undefined),
    [levels, attempt.levelId],
  );

  const result = useMemo(() => {
    if (attempt.state !== 'completed') return null;
    if (!currentLevel) return null;
    const responses = attempt.answers.map((a) => ({ exerciseId: a.exerciseId, given: a.given }));
    return gradeAttempt(currentLevel.exercises, responses);
  }, [attempt, currentLevel]);

  // ---- Name claim + start -------------------------------------------------

  const handleClaimName = useCallback(async (name: string) => {
    setClaimBusy(true);
    setClaimNotice('');
    const claim = await claimName({ name });
    setClaimBusy(false);

    const resolved = resolveAttemptName(name, claim);
    if (!resolved.ok) {
      // Invalid name (should not happen — NameEntry validates — but defend).
      setClaimNotice('Please type a valid name.');
      return;
    }
    if (resolved.notice) {
      // API unavailable (PR 4 not deployed yet) — still let the child play.
      setClaimNotice(resolved.notice);
    }

    // Capture the claimed name + identity key; progression is keyed by the
    // normalized identity so shared devices do not mix levels between children.
    setClaimedName(resolved.name);
    setNameClaimKey(resolved.nameClaimKey);
    // Do NOT start an attempt yet — the student first picks a level.
    setSubmitStatus({ kind: 'idle' });
    setScreen('level-select');
  }, []);

  // ---- Level select / start attempt --------------------------------------

  const startLevel = useCallback(
    (levelId: LevelId) => {
      // LevelSelect only invokes onSelect for unlocked levels, but defend.
      if (!isUnlocked(levelId)) return;
      const level = getLevel(levels, levelId);
      if (!level) return;
      dispatch({
        type: 'start',
        name: claimedName,
        attemptId: createAttemptId(),
        levelId,
        total: level.exercises.length,
      });
      setExerciseIndex(0);
      setSubmitStatus({ kind: 'idle' });
      setScreen('exercise-runner');
    },
    [claimedName, levels, isUnlocked],
  );

  const handleSelectLevel = useCallback(
    (levelId: LevelId) => {
      startLevel(levelId);
    },
    [startLevel],
  );

  const handleBackToLevels = useCallback(() => {
    setScreen('level-select');
  }, []);

  // ---- Exercise flow ------------------------------------------------------

  const handleAnswer = useCallback((exerciseId: string, given: string) => {
    dispatch({ type: 'answer', exerciseId, given });
  }, []);

  const handleFinish = useCallback(() => {
    if (!currentLevel) return;
    // Materialize blanks for skipped/unanswered items and force-complete so
    // Results never mounts with `result === null` after Skip/Finish.
    dispatch({
      type: 'complete',
      exerciseIds: currentLevel.exercises.map((e) => e.id),
    });
    setScreen('results');
  }, [currentLevel]);

  // After the attempt transitions to completed, submit the score and mark the
  // level as passed when the score meets the threshold. Submit status is
  // attempt-aware: a late response from attempt A must not overwrite attempt B
  // after a retake.
  const handleCompleted = useCallback(() => {
    if (attempt.state !== 'completed' || !result) return;
    if (!attempt.levelId) return;
    const attemptId = attempt.attemptId;
    if (
      (submitStatus.kind === 'submitting' || submitStatus.kind === 'submitted') &&
      submitStatus.attemptId === attemptId
    ) {
      return;
    }

    // Mark the level as passed (sticky; pure `applyPass` is idempotent).
    markPassed(attempt.levelId, result.score);

    setSubmitStatus({ kind: 'submitting', attemptId });
    submitScore({
      name: attempt.name,
      score: result.score,
      // PR2: submit the selected level id so the row is level-aware. PR3 will
      // tighten server-side integer validation of `level` 1-10.
      level: attempt.levelId,
      attemptId,
    })
      .then((res) => {
        setSubmitStatus((prev) => {
          // Drop stale responses after retake/reset moved status away from this attempt.
          if (prev.kind !== 'submitting' || prev.attemptId !== attemptId) {
            return prev;
          }
          if (res.ok && res.value.ok) {
            return { kind: 'submitted', attemptId };
          }
          if (!res.ok) {
            return { kind: 'failed', attemptId, message: res.message };
          }
          return {
            kind: 'failed',
            attemptId,
            message: 'The leaderboard could not save this score.',
          };
        });
        // Successful write: drop any cached board so reopening (or an already-open
        // board when status becomes idle) fetches entries that include this score.
        // Bump the request id so an in-flight getLeaderboard cannot re-apply stale rows.
        if (res.ok && res.value.ok) {
          leaderboardRequestId.current += 1;
          setLeaderboardStatus({ kind: 'idle' });
        }
      })
      .catch(() => {
        setSubmitStatus((prev) => {
          if (prev.kind !== 'submitting' || prev.attemptId !== attemptId) {
            return prev;
          }
          return {
            kind: 'failed',
            attemptId,
            message: 'Could not send your score. You can try again.',
          };
        });
      });
  }, [attempt.state, attempt.name, attempt.attemptId, attempt.levelId, result, submitStatus, markPassed]);

  // Fire the submit once when we land on results and the attempt is completed.
  // Uses useEffect so the network call is a render-safe side effect, not a
  // side effect inside useMemo. Retrying (onRetrySubmit) re-calls handleCompleted.
  useEffect(() => {
    if (screen === 'results' && attempt.state === 'completed' && submitStatus.kind === 'idle') {
      void handleCompleted();
    }
  }, [screen, attempt.state, submitStatus.kind, handleCompleted]);

  // ---- Retake / next level / restart --------------------------------------

  const handleRetake = useCallback(() => {
    if (!attempt.levelId) return;
    // Retake targets the SAME level (student-session spec). The reducer
    // preserves the levelId; a fresh attemptId is supplied.
    // Do not block on leaderboard submit: local progression must stay usable
    // while submit is in flight (may hang). Resetting status to idle + the
    // attemptId guards in handleCompleted drop any stale response.
    dispatch({ type: 'retake', attemptId: createAttemptId() });
    setExerciseIndex(0);
    setSubmitStatus({ kind: 'idle' });
    setScreen('exercise-runner');
  }, [attempt.levelId]);

  const handleNextLevel = useCallback(() => {
    if (!attempt.levelId) return;
    const next = nextUnlockedLevel(attempt.levelId);
    if (next === null) return;
    // The next level is unlocked because the current attempt passed (which
    // markPassed recorded in handleCompleted). Defend anyway.
    // startLevel resets submitStatus to idle so a late response for this
    // attempt cannot pollute the next level's submit cycle.
    startLevel(next);
  }, [attempt.levelId, nextUnlockedLevel, startLevel]);

  // ---- Leaderboard --------------------------------------------------------

  const loadLeaderboard = useCallback(async () => {
    const requestId = ++leaderboardRequestId.current;
    // Clear before the round-trip so a slow/offline load cannot keep showing
    // rows from a previous filter (or a previous global snapshot).
    setLeaderboardEntries([]);
    setLeaderboardStatus({ kind: 'loading' });
    const res = await getLeaderboard({ level: leaderboardLevelFilter ?? undefined });
    if (requestId !== leaderboardRequestId.current) return;
    if (res.ok) {
      setLeaderboardEntries(res.value);
      setLeaderboardStatus({ kind: 'loaded' });
    } else {
      setLeaderboardEntries([]);
      setLeaderboardStatus({ kind: 'error', error: res });
    }
  }, [leaderboardLevelFilter]);

  // Switch the leaderboard view filter and reload so the API `?level=N` and
  // client-side ranking stay in sync with the selected view.
  const handleLevelFilterChange = useCallback(
    (level: LevelId | null) => {
      if (level === leaderboardLevelFilter) return;
      setLeaderboardLevelFilter(level);
      // Drop previous view rows immediately so the new filter never paints
      // global/old-level entries while the matching request is in flight.
      setLeaderboardEntries([]);
      // loadLeaderboard reads leaderboardLevelFilter from closure; bump the
      // request id to drop any in-flight response for the previous view.
      leaderboardRequestId.current += 1;
      setLeaderboardStatus({ kind: 'idle' });
    },
    [leaderboardLevelFilter],
  );

  const handleViewLeaderboard = useCallback(() => {
    setScreen('leaderboard');
    // Always refetch on open so a score submitted after a prior board view
    // appears without requiring a manual Refresh.
    void loadLeaderboard();
  }, [loadLeaderboard]);

  // Load when the board is shown with idle status (e.g. after a successful
  // submit invalidates the cache while the user is already on this screen).
  // Manual Refresh calls loadLeaderboard directly.
  useEffect(() => {
    if (screen === 'leaderboard' && leaderboardStatus.kind === 'idle') {
      void loadLeaderboard();
    }
  }, [screen, leaderboardStatus.kind, loadLeaderboard]);

  const handleBackFromLeaderboard = useCallback(() => {
    // After the leaderboard, return to results if an attempt completed,
    // otherwise to level-select (or name-entry if no name claimed yet).
    if (attempt.state === 'completed' && result) setScreen('results');
    else if (claimedName) setScreen('level-select');
    else setScreen('name-entry');
  }, [attempt.state, result, claimedName]);

  // ---- Render -------------------------------------------------------------

  return (
    <div className="app">
      <header className="app__header">
        <h1>English Practice</h1>
      </header>

      <main className="app__main">
        {screen === 'name-entry' ? (
          <NameEntry
            onClaimName={handleClaimName}
            busy={claimBusy}
            notice={claimNotice}
          />
        ) : null}

        {screen === 'level-select' ? (
          <LevelSelect
            levels={levels}
            progress={progress}
            name={claimedName}
            onSelect={handleSelectLevel}
            onViewLeaderboard={handleViewLeaderboard}
          />
        ) : null}

        {screen === 'exercise-runner' && currentLevel ? (
          <ExerciseRunner
            exercises={currentLevel.exercises}
            answers={answersToMap(attempt.answers)}
            index={exerciseIndex}
            onAnswer={handleAnswer}
            onNavigate={setExerciseIndex}
            onFinish={handleFinish}
          />
        ) : null}

        {screen === 'results' && result && currentLevel ? (
          <Results
            result={result}
            name={attempt.name}
            levelId={currentLevel.id}
            submitStatus={submitStatus}
            onRetrySubmit={handleCompleted}
            onRetake={handleRetake}
            onNextLevel={handleNextLevel}
            onBackToLevels={handleBackToLevels}
            onViewLeaderboard={handleViewLeaderboard}
          />
        ) : null}

        {screen === 'leaderboard' ? (
          <Leaderboard
            entries={leaderboardEntries}
            status={leaderboardStatus}
            levelFilter={leaderboardLevelFilter}
            onLevelFilterChange={handleLevelFilterChange}
            onRefresh={loadLeaderboard}
            onBack={handleBackFromLeaderboard}
          />
        ) : null}
      </main>
    </div>
  );
}

function answersToMap(
  answers: readonly { exerciseId: string; given: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of answers) map.set(a.exerciseId, a.given);
  return map;
}