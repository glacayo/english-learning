# Verification Report

**Change**: `level-based-tests`
**Artifact mode**: OpenSpec
**Verification mode**: Standard (`openspec/config.yaml` has `testing.strict_tdd: false`)
**Scope**: all tasks 1.1–4.4 and complete feature behavior
**Safety boundary**: no local preview/dev/Netlify server was started; destructive `--apply` was not run.

---

## Artifacts Reviewed

| Artifact | Status |
|---|---|
| `openspec/changes/level-based-tests/proposal.md` | Reviewed |
| `openspec/changes/level-based-tests/design.md` | Reviewed |
| `openspec/changes/level-based-tests/tasks.md` | Reviewed |
| `openspec/changes/level-based-tests/specs/**/spec.md` | Reviewed: 6 spec files |
| Implementation source | Reviewed via CodeGraph/source inspection |
| Tests | Reviewed: 21 Vitest test files |
| Reset script | Reviewed: `scripts/reset-leaderboard.mjs` |

---

## Completeness

| Metric | Value |
|---|---:|
| Tasks total | 17 |
| Tasks complete | 17 |
| Tasks incomplete | 0 |

| Task range | Evidence | Status |
|---|---|---|
| 1.1–1.4 Content/contracts/catalog | `src/domain/types.ts`, `src/content/exercises.ts`, `src/content/levels.ts`, `src/domain/catalog.ts`; catalog/levels tests passed | ✅ Complete |
| 2.1–2.5 Scoring/progression/UI | `grading.ts`, `recommendations.ts`, `levelProgress.ts`, `levelProgressStore.ts`, `attemptReducer.ts`, `App.tsx`, UI components; domain/state/UI helper tests passed | ✅ Complete |
| 3.1–3.4 Leaderboard/API/reset | `leaderboard.ts`, API client, Netlify functions, `Leaderboard.tsx`, reset script; client/function/script tests passed | ✅ Complete |
| 4.1–4.3 Automated test coverage | 24 test files, 348 tests passed | ✅ Complete |
| 4.4 Deterministic verification | Required commands executed and passed; destructive preview `--apply` remains manual pre-go-live | ✅ Complete with manual warning |

---

## Build & Tests Execution

| Command | Exit | Evidence |
|---|---:|---|
| `npm run typecheck` | 0 | `tsc -b` completed |
| `npm test` | 0 | Vitest `v4.1.10`: **24 files passed, 348 tests passed** |
| `npm run build` | 0 | `tsc -b && vite build`; Vite `v7.3.6`, 45 modules transformed |
| `node scripts/reset-leaderboard.mjs --self-test` | 0 | `self-test OK (9 classification checks + 6 guard checks)` |
| `node scripts/reset-leaderboard.mjs --dry-run` with no env | 2 expected | Guard failed closed: credentials required; no destructive action |
| `node scripts/reset-leaderboard.mjs --dry-run` with site id only | 2 expected | Guard failed closed: missing token; no destructive action |
| `node scripts/reset-leaderboard.mjs --dry-run` with token only | 2 expected | Guard failed closed: missing site id; no destructive action |
| `node scripts/reset-leaderboard.mjs --apply` with creds, no `--confirm-site-id` | 2 expected | Confirm gate failed closed: explicit confirmation required |
| `node scripts/reset-leaderboard.mjs --apply --confirm-site-id=wrong` (mismatch) | 2 expected | Confirm gate failed closed: site id mismatch |

**Coverage**: not run; OpenSpec has `coverage_threshold: 0` and no coverage command configured.

---

## Spec Compliance Matrix

| Spec | Requirement / Scenario | Runtime evidence | Result |
|---|---|---|---|
| exercise-bank | Unique ids enforced | `src/domain/__tests__/exercises.test.ts` / `catalog.test.ts` | ✅ COMPLIANT |
| exercise-bank | Missing accepted answers rejected | `src/domain/__tests__/catalog.test.ts` | ✅ COMPLIANT |
| exercise-bank | Missing/out-of-range difficulty rejected | `src/domain/__tests__/catalog.test.ts` | ✅ COMPLIANT |
| exercise-bank | Levels validated at build time | `src/content/__tests__/levels.test.ts`, `src/domain/__tests__/exercises.test.ts` | ✅ COMPLIANT |
| exercise-bank | Level partition does not change catalog size/topic rules | `src/domain/__tests__/catalog.test.ts`, `exercises.test.ts` | ✅ COMPLIANT |
| level-progression | Ten levels of ten questions from full catalog | `levels.test.ts`, `exercises.test.ts` | ✅ COMPLIANT |
| level-progression | Levels ordered easiest to hardest | `levels.test.ts`, `exercises.test.ts` | ✅ COMPLIANT |
| level-progression | Fresh student sees only Level 1 unlocked | `levelProgress.test.ts`, `LevelSelect.test.ts`, `levelProgressStore.test.ts` | ✅ COMPLIANT |
| level-progression | Locked level cannot be started | `LevelSelect.test.ts` + `App.tsx` defensive `isUnlocked` source inspection | ✅ COMPLIANT |
| level-progression | Score 9+ passes and unlocks next | `levelProgress.test.ts`, `Results.test.ts` | ✅ COMPLIANT |
| level-progression | Score below 9 does not pass/unlock | `levelProgress.test.ts`, `Results.test.ts` | ✅ COMPLIANT |
| level-progression | Retaking a passed level does not revoke state | `levelProgress.test.ts`, `attemptReducer.test.ts` | ✅ COMPLIANT |
| level-progression | Progress survives refresh | `levelProgressStore.test.ts` | ✅ COMPLIANT |
| level-progression | Progress does not follow to new device | `levelProgressStore.test.ts` | ✅ COMPLIANT |
| level-progression | Passing does not force navigation | `Results.test.ts`; source exposes next/retake/back actions | ✅ COMPLIANT |
| student-session | Answers accepted only in progress | `attemptReducer.test.ts` | ✅ COMPLIANT |
| student-session | Attempt completes after 10th level answer and rejects further answers | `attemptReducer.test.ts` | ✅ COMPLIANT |
| student-session | Starting attempt requires unlocked selected level | `LevelSelect.test.ts`, `attemptReducer.test.ts`, `App.tsx` source guard | ✅ COMPLIANT |
| student-session | Retake targets same level with new attemptId | `attemptReducer.test.ts`, `client.test.ts` | ✅ COMPLIANT |
| scoring-feedback | Exact match graded correct | `grading.test.ts` | ✅ COMPLIANT |
| scoring-feedback | Case-folded alternate answer graded correct | `grading.test.ts` | ✅ COMPLIANT |
| scoring-feedback | Leading/trailing spaces accepted | `grading.test.ts`, `exercises.test.ts` | ✅ COMPLIANT |
| scoring-feedback | Incorrect answer recorded in mistakes | `grading.test.ts` | ✅ COMPLIANT |
| scoring-feedback | 9/10 reports score 9 on 0–10 scale | `grading.test.ts` | ✅ COMPLIANT |
| scoring-feedback | Results show score, mistakes, recommendations, level, pass/fail | `Results.test.ts` helpers + source inspection of `Results.tsx` render contract | ✅ COMPLIANT |
| scoring-feedback | 1 of 2 missed recommends topic | `recommendations.test.ts` | ✅ COMPLIANT |
| scoring-feedback | Single-question miss excluded | `recommendations.test.ts` | ✅ COMPLIANT |
| scoring-feedback | Low miss-rate topic excluded | `recommendations.test.ts` | ✅ COMPLIANT |
| scoring-feedback | Recommendations capped at 3 | `recommendations.test.ts` | ✅ COMPLIANT |
| scoring-feedback | Score 9 marks passed | `Results.test.ts`, `levelProgress.test.ts` | ✅ COMPLIANT |
| scoring-feedback | Score 8 marks not passed | `Results.test.ts`, `levelProgress.test.ts` | ✅ COMPLIANT |
| shared-leaderboard | Successful submission persists `{attemptId,name,score,level,timestamp}` | `client.test.ts`, `submitScore.test.ts`, `handlers.test.ts` | ✅ COMPLIANT |
| shared-leaderboard | Retry same attemptId is idempotent | `submitScore.test.ts`, `handlers.test.ts`, `blobsStore.test.ts` | ✅ COMPLIANT |
| shared-leaderboard | Submission failure still leaves local results usable | `client.test.ts`, `Results.test.ts` | ✅ COMPLIANT |
| shared-leaderboard | Higher level outranks lower level globally | `leaderboard.test.ts`, `getLeaderboard.test.ts`, `client.test.ts` | ✅ COMPLIANT |
| shared-leaderboard | Higher score ranks within level | `leaderboard.test.ts`, `getLeaderboard.test.ts` | ✅ COMPLIANT |
| shared-leaderboard | Earlier timestamp tie-break | `leaderboard.test.ts`, `getLeaderboard.test.ts` | ✅ COMPLIANT |
| shared-leaderboard | Equal score/timestamp tie-break by name then attemptId | `leaderboard.test.ts`, `getLeaderboard.test.ts` | ✅ COMPLIANT |
| shared-leaderboard | Global view shows entries across levels | `Leaderboard.test.ts`, `getLeaderboard.test.ts`, `client.test.ts` | ✅ COMPLIANT |
| shared-leaderboard | Per-level view filters one level | `Leaderboard.test.ts`, `getLeaderboard.test.ts`, `client.test.ts`, `handlers.test.ts` | ✅ COMPLIANT |
| shared-leaderboard | Legacy rows absent after deploy | `getLeaderboard.test.ts`, `reset-leaderboard.test.mjs`, reset self-test; live preview `--apply` not executed | ⚠️ MANUAL PENDING |
| netlify-deployment | Submit function accepts valid level-aware payload | `handlers.test.ts`, `submitScore.test.ts`; deployed smoke not run | ⚠️ GO-LIVE SMOKE PENDING |
| netlify-deployment | Read function returns global leaderboard | `handlers.test.ts`, `getLeaderboard.test.ts`; deployed smoke not run | ⚠️ GO-LIVE SMOKE PENDING |
| netlify-deployment | Read function filters `?level=5` | `handlers.test.ts`, `getLeaderboard.test.ts`, `client.test.ts`; deployed smoke not run | ⚠️ GO-LIVE SMOKE PENDING |
| netlify-deployment | Out-of-range score/level rejected | `handlers.test.ts`, `submitScore.test.ts` | ✅ COMPLIANT |
| netlify-deployment | Non-integer score/level rejected | `handlers.test.ts`, `submitScore.test.ts` | ✅ COMPLIANT |
| netlify-deployment | Cleanup runs before level-aware writes begin | `reset-leaderboard.test.mjs`, `--self-test`, guard checks; destructive preview `--apply` not executed | ⚠️ MANUAL PENDING |

**Compliance summary**: 42/47 scenarios fully automated-compliant; 5/47 are external deployment/reset checks pending manual pre-go-live execution. No internal scenario was found missing implementation evidence.

---

## Post-Archive Fix — 4R Review Blockers (2026-07-17)

A fresh 4R review identified six actionable blockers that were addressed after archiving:

| Blocker | Category | Resolution |
|---|---|---|
| 1. Vitest focused-test guard missing | Reliability | Added `allowOnly: false` to `vitest.config.ts`; added config guard test |
| 2. UI flow only helper-tested | Reliability | Added 25 behavior-level component integration tests via `react-dom/server` (no new deps) |
| 3. reset `--apply` irreversible without rollback artifact | Resilience | Added `writeRollbackSnapshot()` — timestamped JSON snapshot before deletion |
| 4. wrong-target/ungated reset apply | Resilience | Added `--confirm-site-id=<id>` gate via `verifyTargetConfirm()` |
| 5. serverless API only console.error visibility | Resilience | Added `_report-error.ts` structured error hook (safe by default, optional endpoint) |
| 6. Security review claimed backend should authorize progression | Security | Adjudicated: progression is intentionally same-browser/local only; documented as known non-security boundary; no server-side auth added |

### Verification After Post-Archive Fix

| Command | Exit | Evidence |
|---|---:|---|
| `npm run typecheck` | 0 | `tsc -b` completed |
| `npm test` | 0 | Vitest: **24 files, 348 tests passed** |
| `npm run build` | 0 | Vite v7.3.6, 45 modules transformed |
| `node scripts/reset-leaderboard.mjs --self-test` | 0 | `self-test OK (9 classification checks + 6 guard checks)` |
| `--apply` without `--confirm-site-id` | 2 expected | Confirm gate blocks |
| `--apply` with mismatching `--confirm-site-id` | 2 expected | Confirm gate blocks |

### Security Boundary Adjudication

The security review suggested the backend should authorize progression/unlocks. The accepted design (design.md "Progression store") intentionally keeps progression as a same-browser/local-only feature persisted to `localStorage` per claimed-name identity. There is no server-side authentication system in the current architecture, and adding one would require a new auth system not present in the project. This is a **known non-security boundary**:

- Level progression (unlock/pass state) is client-side only and NOT server-authenticated.
- The leaderboard API does NOT claim to authorize or verify progression integrity for unlocks.
- The API validates `score` and `level` ranges (integers 0-10 and 1-10) but does NOT enforce that a student earned their score through the intended progression path.
- API docs and specs do not claim authorization or integrity for unlocks.

This is documented as a deliberate v1 design tradeoff, not a vulnerability to fix.

---

## Correctness (Static — Structural Evidence)

| Requirement area | Status | Notes |
|---|---|---|
| Exercise catalog + level partition | ✅ Implemented | `difficulty === levelId`; `buildLevels()` groups 10 buckets; catalog validates difficulty and exact 10-per-level partition. |
| Level progression | ✅ Implemented | Pure progression helpers, per-identity localStorage store, sticky pass state, Level 1 fresh unlock. |
| Attempt lifecycle | ✅ Implemented | Reducer binds attempts to `levelId`, total defaults to 10, retake preserves level and uses new attempt id. |
| Scoring/recommendations/results | ✅ Implemented | Raw correct count, skipped answers incorrect, topic recommendations require sample ≥2 and miss rate ≥40%, Results shows level/pass state. |
| Leaderboard ranking/API | ✅ Implemented | Rows require `level`; global rank is level-first; per-level rank is score-first; legacy rows rejected/hidden. |
| Reset script | ✅ Implemented | Selective classifier deletes only legacy/invalid rows, validates env, supports self-test/dry-run/apply. |

---

## Coherence (Design)

| Design decision | Followed? | Notes |
|---|---|---|
| `difficulty` is the level source of truth | ✅ Yes | `src/content/levels.ts` groups by `difficulty`; no separate level table. |
| Raw 0–10 score scale | ✅ Yes | `gradeAttempt.score = correctCount`; server validates `score` integer 0–10. |
| Per-claimed-name localStorage progression | ✅ Yes | `english-learning:progress:v1:{nameClaimKey}`. |
| Global + per-level leaderboard views | ✅ Yes | Client and server support global default and `?level=N`. |
| Global ranking level desc → score desc → ties | ✅ Yes | `rankEntries()` and server/client tests enforce it. |
| Selective one-shot legacy reset | ✅ Yes | Reset script classifies invalid/legacy rows; valid level-aware rows survive. |
| Level-scoped recommendations | ✅ Yes | Minimum sample 2 and miss rate ≥40% on attempt answers. |

No design deviations were found.

---

## Issues Found

### CRITICAL

- None.

### WARNING

- Manual pre-go-live reset apply remains pending: `node scripts/reset-leaderboard.mjs --apply` must be run only against an explicit preview/non-production target with safe credentials, then re-run to prove valid level-aware rows survive. This was intentionally not executed here.
- Deployed Netlify endpoint smoke remains pending: submit/read/filter behavior is covered by handler/client tests, but live deployed reachability was not exercised because no local server or deploy preview target was started in this verification.

### SUGGESTION

- ~~Add React component rendering tests later if the project adopts a DOM test utility; current UI coverage relies on pure helper tests plus source inspection for rendered markup.~~ **RESOLVED (post-archive fix)**: Added behavior-level component integration tests via `react-dom/server` plus direct React element event-prop invocation (already available — no new dependencies). Covers locked-level blocking, next-unlocked selection, Results actions, leaderboard filter wiring, callback wiring, and Level 10 no-next behavior.

---

## Verdict

**PASS WITH WARNINGS**

All 17 tasks are complete, all required deterministic commands passed, and no CRITICAL issues were found. Remaining warnings are external/manual pre-go-live checks only: preview reset `--apply` and deployed endpoint smoke.
