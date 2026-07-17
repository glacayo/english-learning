import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { JSX } from 'react';
import { EXERCISES } from './content/exercises';
import { gradeAttempt } from './domain/grading';
import { attemptReducer, createInitialAttempt } from './state/attemptReducer';
import {
  claimName,
  createAttemptId,
  getLeaderboard,
  submitScore,
  type ApiResult,
} from './api/client';
import type { ClaimNameResponse, LeaderboardEntry } from './domain/types';
import { NameEntry } from './ui/NameEntry';
import { ExerciseRunner } from './ui/ExerciseRunner';
import { Results, type SubmitStatus } from './ui/Results';
import { Leaderboard, type LeaderboardStatus } from './ui/Leaderboard';

/**
 * App — wires the four screens (NameEntry, ExerciseRunner, Results,
 * Leaderboard) around the attempt state machine and the typed API client.
 *
 * The UI always works locally: grading runs against the bundled catalog, so
 * even when the API is unavailable (PR 3 ships before the Netlify Functions in
 * PR 4) the student sees their score, mistakes, and recommendations. The
 * leaderboard submit/read fail gracefully with a friendly message.
 */
export type Screen = 'name-entry' | 'exercise-runner' | 'results' | 'leaderboard';

/**
 * Resolve the display name used for attempt start / results / score submit
 * after a `claim-name` call.
 *
 * - Successful claim → prefer the server's canonical `name` (so "maria" after
 *   first claim "Maria" keeps one spelling on the leaderboard).
 * - Transport / API failure → fall back to the trimmed typed name so offline
 *   play still works.
 * - Server invalid → block start (caller shows guidance).
 */
export function resolveAttemptName(
  typedName: string,
  claim: ApiResult<ClaimNameResponse>,
): { ok: true; name: string; notice?: string } | { ok: false; reason: 'invalid' } {
  const trimmed = typedName.trim();

  if (!claim.ok) {
    return { ok: true, name: trimmed, notice: claim.message };
  }

  if (!claim.value.ok) {
    return { ok: false, reason: 'invalid' };
  }

  const canonical = (claim.value.name ?? '').trim();
  return {
    ok: true,
    name: canonical.length > 0 ? canonical : trimmed,
  };
}

export function App(): JSX.Element {
  const [attempt, dispatch] = useReducer(attemptReducer, undefined, createInitialAttempt);
  const [screen, setScreen] = useState<Screen>('name-entry');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimNotice, setClaimNotice] = useState('');
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ kind: 'idle' });
  const [leaderboardEntries, setLeaderboardEntries] = useState<readonly LeaderboardEntry[]>([]);
  const [leaderboardStatus, setLeaderboardStatus] = useState<LeaderboardStatus>({ kind: 'idle' });
  // Drop stale getLeaderboard responses when a newer load (or post-submit
  // invalidate) has already started.
  const leaderboardRequestId = useRef(0);

  const result = useMemo(() => {
    if (attempt.state !== 'completed') return null;
    const responses = attempt.answers.map((a) => ({ exerciseId: a.exerciseId, given: a.given }));
    return gradeAttempt(EXERCISES, responses);
  }, [attempt]);

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

    dispatch({
      type: 'start',
      // Prefer canonical claim name so retakes share one leaderboard spelling.
      name: resolved.name,
      attemptId: createAttemptId(),
      total: EXERCISES.length,
    });
    setExerciseIndex(0);
    setSubmitStatus({ kind: 'idle' });
    setScreen('exercise-runner');
  }, []);

  // ---- Exercise flow ------------------------------------------------------

  const handleAnswer = useCallback((exerciseId: string, given: string) => {
    dispatch({ type: 'answer', exerciseId, given });
  }, []);

  const handleFinish = useCallback(() => {
    // Materialize blanks for skipped/unanswered items and force-complete so
    // Results never mounts with `result === null` after Skip/Finish.
    dispatch({
      type: 'complete',
      exerciseIds: EXERCISES.map((e) => e.id),
    });
    setScreen('results');
  }, []);

  // After the attempt transitions to completed, submit the score once.
  // Submit status is attempt-aware: a late response from attempt A must not
  // overwrite attempt B after a retake.
  const handleCompleted = useCallback(() => {
    if (attempt.state !== 'completed' || !result) return;
    const attemptId = attempt.attemptId;
    if (
      (submitStatus.kind === 'submitting' || submitStatus.kind === 'submitted') &&
      submitStatus.attemptId === attemptId
    ) {
      return;
    }

    setSubmitStatus({ kind: 'submitting', attemptId });
    submitScore({
      name: attempt.name,
      score: result.score,
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
  }, [attempt.state, attempt.name, attempt.attemptId, result, submitStatus]);

  // Fire the submit once when we land on results and the attempt is completed.
  // Uses useEffect so the network call is a render-safe side effect, not a
  // side effect inside useMemo. Retrying (onRetrySubmit) re-calls handleCompleted.
  useEffect(() => {
    if (screen === 'results' && attempt.state === 'completed' && submitStatus.kind === 'idle') {
      void handleCompleted();
    }
  }, [screen, attempt.state, submitStatus.kind, handleCompleted]);

  // ---- Retake / restart ---------------------------------------------------

  const handleRetake = useCallback(() => {
    // Guard: do not start attempt B while attempt A's submit is still in flight.
    if (submitStatus.kind === 'submitting') return;

    dispatch({ type: 'retake', attemptId: createAttemptId() });
    setExerciseIndex(0);
    setSubmitStatus({ kind: 'idle' });
    setScreen('exercise-runner');
  }, [submitStatus.kind]);

  // ---- Leaderboard --------------------------------------------------------

  const loadLeaderboard = useCallback(async () => {
    const requestId = ++leaderboardRequestId.current;
    setLeaderboardStatus({ kind: 'loading' });
    const res = await getLeaderboard();
    if (requestId !== leaderboardRequestId.current) return;
    if (res.ok) {
      setLeaderboardEntries(res.value);
      setLeaderboardStatus({ kind: 'loaded' });
    } else {
      setLeaderboardEntries([]);
      setLeaderboardStatus({ kind: 'error', error: res });
    }
  }, []);

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
    setScreen(attempt.state === 'completed' ? 'results' : 'name-entry');
  }, [attempt.state]);

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

        {screen === 'exercise-runner' ? (
          <ExerciseRunner
            exercises={EXERCISES}
            answers={answersToMap(attempt.answers)}
            index={exerciseIndex}
            onAnswer={handleAnswer}
            onNavigate={setExerciseIndex}
            onFinish={handleFinish}
          />
        ) : null}

        {screen === 'results' && result ? (
          <Results
            result={result}
            exercises={EXERCISES}
            name={attempt.name}
            submitStatus={submitStatus}
            onRetrySubmit={handleCompleted}
            onRetake={handleRetake}
            onViewLeaderboard={handleViewLeaderboard}
          />
        ) : null}

        {screen === 'leaderboard' ? (
          <Leaderboard
            entries={leaderboardEntries}
            status={leaderboardStatus}
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