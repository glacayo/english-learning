# Verification Report: English Exercise App — Final Deterministic Verification

**Change**: `english-exercise-app`  
**Artifact mode**: OpenSpec  
**Mode**: Standard verification (`strict_tdd: false`)  
**Date**: 2026-07-17  
**Scope**: Full OpenSpec change before publishing to GitHub.  
**Incident constraint honored**: No `npm run preview`, `npm run dev`, `vite preview`, `netlify dev`, Playwright, Chrome, or long-running server/smoke-server step was started.

## Verdict

**PASS WITH WARNINGS** — deterministic verification passed: typecheck, Vitest, and production build all exited 0. The implementation matches the OpenSpec artifacts for local app behavior, domain rules, Netlify function contracts, idempotent writes, ranking, and configured build/test commands.

The warning is manual-environment scope only: task `5.3` still includes a Netlify deploy-preview smoke check, which is intentionally not executable in this verification run. It is recorded as manual pending, not a deterministic failure.

## Completeness Table

| Metric | Value |
|--------|-------|
| Tasks total | 18 |
| Tasks complete | 17 |
| Tasks incomplete | 1 |
| Deterministic required commands | 3/3 passed |
| Manual smoke-server/deploy-preview steps executed | 0 — intentionally skipped |

### Task Status

| Task | Status | Evidence |
|------|--------|----------|
| 1.1–1.4 Foundation / toolchain | PASS | Config files and app bootstrap exist; typecheck/build pass. |
| 2.1–2.4 Catalog / domain rules | PASS | `src/content/exercises.ts`, domain modules, and tests pass. |
| 3.1–3.4 Attempt state / UI | PASS | Reducer, API client, UI components, and app wiring present; tests/build pass. |
| 4.1–4.3 Netlify integration | PASS | `netlify.toml`, `_store.ts`, and three functions exist; function tests pass. |
| 5.1 Domain tests | PASS | `src/domain/__tests__/*.test.ts`; included in `npm test`. |
| 5.2 Function tests | PASS | `netlify/functions/__tests__/*.test.ts`; included in `npm test`. |
| 5.3 Build/test + Netlify deploy preview smoke | WARNING | `npm test` and `npm run build` passed; Netlify deploy-preview smoke remains manual pending by explicit constraint. |

## Build & Tests Execution

Commands were run from `C:\laragon\www\english-learning` and only the required deterministic commands were executed.

| Command | Exit Code | Result | Evidence |
|---------|-----------|--------|----------|
| `npm run typecheck` | 0 | PASS | `tsc -b` completed with no reported errors. |
| `npm test` | 0 | PASS | Vitest v4.1.10: `13 passed (13)` test files, `138 passed (138)` tests, duration 2.84s. |
| `npm run build` | 0 | PASS | `tsc -b && vite build`; Vite v7.3.6 transformed 41 modules and built `dist/index.html`, CSS, and JS. |

**Coverage**: Not available/configured (`openspec/config.yaml` coverage threshold: `0`, coverage command empty).

## Spec Compliance Matrix

| Requirement | Scenario | Test / Evidence | Result |
|-------------|----------|-----------------|--------|
| `exercise-bank` Catalog Size | Catalog loads with full count | `src/domain/__tests__/exercises.test.ts` — contains exactly 100 exercises; `npm test` passed | COMPLIANT |
| `exercise-bank` Catalog Size | Wrong count rejected | `src/domain/__tests__/catalog.test.ts` — rejects wrong total; `npm test` passed | COMPLIANT |
| `exercise-bank` Topic Coverage | All approved topics represented | `exercises.test.ts` + `catalog.test.ts`; `npm test` passed | COMPLIANT |
| `exercise-bank` Balanced Distribution | Each topic has 12 or 13 exercises | `exercises.test.ts`; `npm test` passed | COMPLIANT |
| `exercise-bank` Balanced Distribution | Unbalanced distribution rejected | `catalog.test.ts`; `npm test` passed | COMPLIANT |
| `exercise-bank` Record Shape | Unique ids enforced | `catalog.test.ts`, `exercises.test.ts`; `npm test` passed | COMPLIANT |
| `exercise-bank` Record Shape | Missing accepted answers rejected | `catalog.test.ts`, `exercises.test.ts`; `npm test` passed | COMPLIANT |
| `exercise-bank` Accepted Answers | Alternate answer recognized | `exercises.test.ts`, `grading.test.ts`; `npm test` passed | COMPLIANT |
| `scoring-feedback` Auto-Grading | Exact match correct | `src/domain/__tests__/grading.test.ts`; `npm test` passed | COMPLIANT |
| `scoring-feedback` Auto-Grading | Case-folded alternate correct | `grading.test.ts`; `npm test` passed | COMPLIANT |
| `scoring-feedback` Auto-Grading | Leading/trailing spaces ignored | `grading.test.ts`, `exercises.test.ts`; `npm test` passed | COMPLIANT |
| `scoring-feedback` Auto-Grading | Incorrect answer recorded | `grading.test.ts`; `npm test` passed | COMPLIANT |
| `scoring-feedback` Mistake Review | Mistakes list matches incorrect answers | `grading.test.ts` preserves mistake order and unanswered/wrong entries; `Results.tsx` renders mistakes; build passed | COMPLIANT |
| `scoring-feedback` Topic Recommendation | High miss-rate topic recommended | `recommendations.test.ts`; `npm test` passed | COMPLIANT |
| `scoring-feedback` Topic Recommendation | Low miss-rate topic excluded | `recommendations.test.ts`; `npm test` passed | COMPLIANT |
| `scoring-feedback` Topic Recommendation | Recommendations capped at three | `recommendations.test.ts`; `npm test` passed | COMPLIANT |
| `scoring-feedback` End-of-Test Summary | Results screen shows score, mistakes, recommendations | `Results.tsx` source + typecheck/build passed | COMPLIANT |
| `student-session` Name Capture | Valid name starts a session | `attemptReducer.test.ts`, `client.test.ts`, `resolveAttemptName.test.ts`; `npm test` passed | COMPLIANT |
| `student-session` Name Capture | Empty name blocked with friendly guidance | `NameEntry.tsx` source, `client.test.ts`, `attemptReducer.test.ts`; `npm test` passed | COMPLIANT |
| `student-session` Normalized Identity | Case/whitespace collapse to same identity and retake allowed | `claimName.test.ts`, `handlers.test.ts`, `leaderboard.test.ts`; `npm test` passed | COMPLIANT |
| `student-session` Normalized Identity | Distinct name accepted | `claimName.test.ts`; `npm test` passed | COMPLIANT |
| `student-session` Retakes | Returning student gets new attemptId | `attemptReducer.test.ts`, `client.test.ts`; `npm test` passed | COMPLIANT |
| `student-session` Attempt Lifecycle | Answers accepted only in progress | `attemptReducer.test.ts`; `npm test` passed | COMPLIANT |
| `student-session` Attempt Lifecycle | Completes after last exercise and rejects further answers | `attemptReducer.test.ts`; `npm test` passed | COMPLIANT |
| `shared-leaderboard` Score Submission | Successful submission persists attemptId-keyed entry | `submitScore.test.ts`, `handlers.test.ts`; `npm test` passed | COMPLIANT |
| `shared-leaderboard` Score Submission | Retry after successful write is idempotent | `submitScore.test.ts`, `handlers.test.ts`; `npm test` passed | COMPLIANT |
| `shared-leaderboard` Score Submission | Submission failure handled gracefully | `client.test.ts` network failure + `Results.tsx` retry/local-results source; build passed | COMPLIANT |
| `shared-leaderboard` Ranking | Higher score ranks above lower score | `leaderboard.test.ts`, `getLeaderboard.test.ts`; `npm test` passed | COMPLIANT |
| `shared-leaderboard` Deterministic Tie-Break | Earlier timestamp first | `leaderboard.test.ts`, `getLeaderboard.test.ts`; `npm test` passed | COMPLIANT |
| `shared-leaderboard` Deterministic Tie-Break | Name then attemptId | `leaderboard.test.ts`, `getLeaderboard.test.ts`; `npm test` passed | COMPLIANT |
| `shared-leaderboard` Multiple Attempts | Retake adds second row | `leaderboard.test.ts`, `getLeaderboard.test.ts`, `submitScore.test.ts`; `npm test` passed | COMPLIANT |
| `shared-leaderboard` Cross-Device Reads | Score visible from different device | Function/store contract tests prove persisted list/read behavior with mocked store; real deployed cross-device smoke pending | WARNING — manual pending |
| `netlify-deployment` Static Frontend | Production build served correctly | `npm run build` produced `dist/`; actual Netlify URL serving not exercised | WARNING — manual pending |
| `netlify-deployment` Serverless API | Submit endpoint reachable | Function handler tests passed; deployed endpoint reachability not exercised | WARNING — manual pending |
| `netlify-deployment` Serverless API | Read endpoint reachable | Function handler tests passed; deployed endpoint reachability not exercised | WARNING — manual pending |
| `netlify-deployment` Shared Persistence | Data persists across function cold starts | Netlify Blobs helper contract and handler tests passed; real cold-start deploy smoke not executed | WARNING — manual pending |
| `netlify-deployment` Build & Test Commands | CI build produces deployable artifact | `npm run build` passed and emitted `dist/` | COMPLIANT |
| `netlify-deployment` Build & Test Commands | Test command runs unit suite | `npm test` passed: 13 files, 138 tests | COMPLIANT |

**Compliance summary**: 33/38 scenarios are fully compliant by deterministic runtime evidence. 5/38 deployment-environment scenarios are manual pending warnings because deploy-preview smoke was explicitly out of scope for this final deterministic run.

## Correctness (Static — Structural Evidence)

| Requirement Area | Status | Notes |
|------------------|--------|-------|
| Exercise bank | Implemented | Catalog has exactly 100 typed exercises, approved topics, validation tests, and accepted-answer tests. |
| Scoring and feedback | Implemented | `gradeAnswer`, `gradeAttempt`, `recommendTopics`, and `Results.tsx` support normalized grading, mistakes, score, and recommendations. |
| Student session | Implemented | `NameEntry`, `resolveAttemptName`, API client, and `attemptReducer` cover name validation, normalized identity, retakes, lifecycle, and completion. |
| Shared leaderboard | Implemented | `rankEntries`, client wrappers, Netlify store helpers, and function handlers cover submission, idempotency, ranking, retake rows, and reads. |
| Netlify deployment | Implemented with manual deployment verification pending | `netlify.toml` configures build/publish/functions; deployed URL and cold-start behavior require Netlify environment smoke. |

## Coherence (Design)

| Design Decision | Followed? | Notes |
|-----------------|-----------|-------|
| Vite + React + TypeScript SPA | Yes | Toolchain and app source exist; typecheck/build pass. |
| Pure domain modules in `src/domain/` | Yes | Grading, recommendations, ranking, catalog validation are framework-free and tested. |
| Client-side grading against bundled catalog | Yes | `App.tsx` computes `gradeAttempt(EXERCISES, responses)` on completion. |
| Netlify Functions + Netlify Blobs behind API boundary | Yes | `_store.ts` wraps Blobs and functions expose `claim-name`, `submit-score`, `get-leaderboard`. |
| Name identity + retakes | Yes | Normalized key claim allows retake and returns canonical display name. |
| One blob per submission entry / attemptId idempotency | Yes | `submitScore` writes by `attemptId` with `onlyIfNew`; tests pass. |
| Single attempt reducer | Yes | `src/state/attemptReducer.ts` models lifecycle; `App.tsx` uses it directly. |
| Typed TS catalog validated by tests | Yes | `validateCatalog` and catalog/exercise tests pass. |
| Manual Netlify deploy-preview smoke | Pending | Not run by explicit deterministic-only constraint. |

## Issues Found

### CRITICAL

None.

### WARNING

- Task `5.3` remains partially manual: deterministic pieces (`npm test`, `npm run build`) passed, but Netlify deploy-preview smoke for start/completion/results/submit/cross-device leaderboard read was intentionally not executed.
- Deployment-environment scenarios that require a real Netlify URL, function reachability after deploy, Blob persistence across cold starts, and cross-device browser reads remain manual pending.

### SUGGESTION

- Before publishing the final release, run the Netlify deploy-preview smoke in a controlled terminal/session and record the URL plus manual observations separately.

## Final Verdict

**PASS WITH WARNINGS** — deterministic verification is clean and GitHub publication is not blocked by local typecheck/test/build. The only remaining warning is the explicitly skipped Netlify deploy-preview manual smoke.
