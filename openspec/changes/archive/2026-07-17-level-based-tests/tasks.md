# Tasks: Level-Based Tests

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 700-1,000 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 content/contracts → PR 2 progression/UI → PR 3 leaderboard/reset/API → PR 4 verification polish |
| Delivery strategy | force-chained |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Level metadata, contracts, catalog validation | PR 1 | base main; include catalog tests |
| 2 | Progression, scoring, recommendations, UI flow | PR 2 | base main after PR 1; include domain/UI tests |
| 3 | Leaderboard API, ranking, reset script | PR 3 | base main after PR 2; include function/client tests |
| 4 | Verification and docs notes | PR 4 | base main after PR 3; preview reset checks |

## Phase 1: Level Content and Contracts

- [x] 1.1 Update `src/domain/types.ts` with `LevelId`, `Exercise.difficulty`, `LeaderboardEntry.level`, `SubmitScoreRequest.level`, and 0-10 result comments.
- [x] 1.2 Add `difficulty: 1-10` to all records in `src/content/exercises.ts`, preserving ids/prompts/answers and 10 buckets of 10.
- [x] 1.3 Create `src/content/levels.ts` with `LEVEL_SIZE`, `PASS_THRESHOLD`, `buildLevels()`, and `getLevel()` grouped by difficulty.
- [x] 1.4 Extend `src/domain/catalog.ts` validation for missing/out-of-range difficulty and exact 10-level partition while keeping flat 100/topic rules.

## Phase 2: Scoring, Progression, and UI Flow

- [x] 2.1 Modify `src/domain/grading.ts` to return raw correct count for the selected level (0-10), with skipped answers incorrect.
- [x] 2.2 Modify `src/domain/recommendations.ts` for level-scoped miss rates: topic sample >=2, miss rate >=40%, top 3.
- [x] 2.3 Create `src/domain/levelProgress.ts` and `src/state/levelProgressStore.ts` for per-name localStorage progress.
- [x] 2.4 Modify `src/state/attemptReducer.ts` so attempts start/retake with `levelId` and complete after 10 answers.
- [x] 2.5 Modify `src/App.tsx`, create `src/ui/LevelSelect.tsx`, and update `src/ui/ExerciseRunner.tsx`/`src/ui/Results.tsx` for unlocked levels, pass/fail, retake, next, Level 10 completion, and back-to-levels navigation.

## Phase 3: Leaderboard API and Reset

- [x] 3.1 Modify `src/domain/leaderboard.ts` for global rank `level desc → score desc → ties` and per-level score-first ranking.
- [x] 3.2 Modify `src/api/client.ts`, `netlify/functions/_store.ts`, `submit-score.ts`, and `get-leaderboard.ts` for required integer `score` 0-10, `level` 1-10, `?level=N`, persistence, and legacy-row rejection.
- [x] 3.3 Modify `src/ui/Leaderboard.tsx` for level column plus global/per-level filter controls.
- [x] 3.4 Create `scripts/reset-leaderboard.mjs` with dry-run/apply modes that delete only legacy/invalid leaderboard rows before level-aware writes begin.

## Phase 4: Tests and Verification

- [x] 4.1 Update/add Vitest tests for catalog levels, grading 0-10, recommendations sample threshold, progression persistence per identity, and reducer level lifecycle.
- [x] 4.2 Update/add client/function tests for level payloads, integer validation, `?level` filter, ranking, idempotent submit, and invalid legacy shapes.
- [x] 4.3 Add UI flow tests for locked level blocking, refresh persistence, second identity isolation, Results actions, leaderboard filters, and Level 10 state.
- [x] 4.4 Run test/build commands, then manually verify reset script dry-run/apply on preview and confirm new level-aware rows survive re-run.

### Task 4.4 — Manual Deploy Step (pending)

**Status**: Deterministic verification complete; destructive preview `--apply` remains a manual pre-go-live step.

- `npm run typecheck` → PASS (`tsc -b` exit 0)
- `npm test` → PASS (Vitest v4.1.10: 24 files, 348 tests)
- `npm run build` → PASS (Vite v7.3.6, 45 modules transformed)
- `node scripts/reset-leaderboard.mjs --self-test` → PASS (`self-test OK (9 classification checks + 6 guard checks)`)
- `node scripts/reset-leaderboard.mjs --dry-run` (no env) → exit 2 (guard expected, no destructive action)
- `node scripts/reset-leaderboard.mjs --dry-run` (site id only, no token) → exit 2 (guard expected)
- `node scripts/reset-leaderboard.mjs --dry-run` (token only, no site id) → exit 2 (guard expected)
- `node scripts/reset-leaderboard.mjs --apply` (site id + token, no `--confirm-site-id`) → exit 2 (confirm gate expected)
- `node scripts/reset-leaderboard.mjs --apply --confirm-site-id=wrong` (mismatch) → exit 2 (confirm gate expected)

**Pending manual step (NOT run)**: `node scripts/reset-leaderboard.mjs --apply --confirm-site-id=<site-id>` against a PREVIEW Netlify site with explicit non-production credentials (`NETLIFY_SITE_ID` + `NETLIFY_AUTH_TOKEN` or `NETLIFY_BLOBS_CONTEXT`), followed by a re-run to confirm only legacy/invalid rows are deleted and new level-aware rows survive. A timestamped JSON rollback snapshot is now written to `./rollback-snapshots/` before any deletion. This requires safe preview credentials and explicit proof of target environment. It was not executed here because no safe non-production target credentials/context were available, and destructive `--apply` against production is explicitly forbidden by the boundary.

### Post-Archive Fix (4R Review Blockers)

The following blockers identified by the fresh 4R review were addressed after archiving:

1. **Reliability — Vitest focused-test guard**: Added explicit `allowOnly: false` to `vitest.config.ts` so `.only` tests fail even locally (default is `!process.env.CI`). Added a config guard test in `scripts/vitest-config.test.mjs`.

2. **Reliability — UI flow behavior-level tests**: Added `src/ui/__tests__/uiFlow.test.tsx` with behavior-level component integration tests using `react-dom/server` plus direct React element event-prop invocation (already available via `react-dom` dependency — no new deps). Covers: locked-level blocking, selecting next unlocked level, Results next/back/retake actions, leaderboard level filter wiring, callback wiring, and Level 10 no-next behavior.

3. **Resilience — reset `--apply` rollback artifact**: `scripts/reset-leaderboard.mjs` now writes a timestamped JSON rollback/audit snapshot to `./rollback-snapshots/` BEFORE any deletion via `writeRollbackSnapshot()`. Tests added for snapshot-before-delete and failure behavior.

4. **Resilience — wrong-target/ungated reset apply**: Added `--confirm-site-id=<id>` gate via `verifyTargetConfirm()`. Destructive `--apply` in explicit mode requires the flag to match the resolved `NETLIFY_SITE_ID` exactly. Context mode is exempt (pins site already). Tests and self-test checks added. Push to main still requires manual preview/prod reset/smoke (documented, not automated).

5. **Resilience — serverless API error reporting**: Added `netlify/functions/report-error.ts` — a minimal structured error reporting hook that is safe by default (logs structured JSON to `console.error`) and optionally reports to an env-configured endpoint (`ERROR_REPORT_ENDPOINT`) without blocking responses. No paid services or new secrets. Wired into all three function handlers. Tests added.

6. **Security — progression authorization boundary**: Adjudicated against accepted design. Progression is intentionally same-browser/local only (localStorage per claimed-name identity), NOT server-authenticated. This is a known non-security boundary documented in verify/archive. API docs do not claim authorization/integrity for unlocks. No server-side auth implemented (would require a new auth system not in the current architecture).

7. **Readability — duplicated rules and dead helper cleanup**: Moved leaderboard reset validation into one shared plain-ESM classifier, centralized HTTP JSON/reporting helpers for Netlify handlers, generated level filter options from `LEVEL_COUNT`, replaced inline range checks with validators, collapsed client JSON request handling, and removed the constant-false Results navigation helper.
