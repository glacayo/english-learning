# Tasks: English Exercise App

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1,200–1,800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | force-chained / interactive |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Toolchain + domain contracts | PR 1 | Base: main; Vitest + validators. |
| 2 | Exercise catalog + grading rules | PR 2 | Base: after PR 1 merges to main; isolates 100-record content. |
| 3 | Attempt state + React UI | PR 3 | Base: after PR 2 merges to main; local results flow. |
| 4 | Netlify API + shared leaderboard | PR 4 | Base: after PR 3 merges to main; Blobs + tests. |

## Phase 1: Foundation / Toolchain

- [x] 1.1 Create `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, and `index.html` with React, TypeScript, Vite, Vitest, and scripts.
- [x] 1.2 Create `src/main.tsx` and `src/App.tsx` with minimal app bootstrap and placeholder screen routing.
- [x] 1.3 Create `src/domain/types.ts` and `src/content/topics.ts` for `Topic`, `Exercise`, attempt, result, answer, and leaderboard contracts.
- [x] 1.4 Create `src/domain/catalog.ts` with `validateCatalog()` enforcing count, approved topics, unique ids, prompts, answers, and 12/13 topic distribution.

## Phase 2: Catalog / Domain Rules

- [x] 2.1 Create `src/content/exercises.ts` with exactly 100 balanced exercise records across the 8 approved topics.
- [x] 2.2 Add `src/domain/grading.ts` for `gradeAnswer()` and `gradeAttempt()` using trim + case-fold accepted-answer matching.
- [x] 2.3 Add `src/domain/recommendations.ts` for top-3 topics with miss rate >= 40%.
- [x] 2.4 Add `src/domain/leaderboard.ts` ranking by score desc, timestamp asc, normalized name asc, then `attemptId` asc.

## Phase 3: Attempt State / UI

- [x] 3.1 Create `src/state/attemptReducer.ts` for `not-started → in-progress → completed`, answer recording, retakes, and post-completion rejection.
- [x] 3.2 Create `src/api/client.ts` with typed wrappers for `claim-name`, `submit-score`, and `get-leaderboard`.
- [x] 3.3 Create `src/ui/NameEntry.tsx` with non-empty name validation, friendly empty-name guidance, and retake-safe claim flow.
- [x] 3.4 Create `src/ui/ExerciseRunner.tsx`, `Results.tsx`, and `Leaderboard.tsx` for question flow, score, mistakes, recommendations, submit status, and rankings.

## Phase 4: Netlify Integration

- [x] 4.1 Create `netlify.toml` with build command, `dist/` publish directory, and `netlify/functions` directory.
- [x] 4.2 Create `netlify/functions/_store.ts` with Netlify Blobs helpers for normalized name claims, attemptId-keyed idempotent writes, and entry listing.
- [x] 4.3 Create `netlify/functions/claim-name.ts`, `submit-score.ts`, and `get-leaderboard.ts` matching the OpenSpec API contracts.

## Phase 5: Testing / Verification

- [x] 5.1 Add `src/domain/__tests__/*.test.ts` for catalog, grading, recommendations, ranking, and attempt reducer scenarios from the specs.
- [x] 5.2 Add `netlify/functions/__tests__/*.test.ts` with mocked `_store` for first claim, retake, idempotent submit, new-attempt row, and sorted reads.
- [x] 5.3 Run `npm test` and `npm run build`; manually smoke test a Netlify deploy preview for start, completion, results, submit, and cross-device leaderboard read.
