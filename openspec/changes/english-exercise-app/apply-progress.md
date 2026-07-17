# Apply Progress: English Exercise App

**Change**: english-exercise-app
**Artifact mode**: OpenSpec
**Mode**: Standard (strict_tdd: false)
**Chain strategy**: stacked-to-main
**Work unit**: PR 4 — Netlify API + shared leaderboard

## Slice Boundary (PR 4)

- Base: after PR 1 + PR 2 + PR 3 merge to main (foundation + 100-exercise
  catalog + pure domain modules + attempt state + React UI).
- Finish: `netlify.toml`, Netlify Blobs store helpers, three Netlify Functions
  (`claim-name`, `submit-score`, `get-leaderboard`) matching the OpenSpec API
  contracts, and integration tests with a mocked store. `npm run typecheck`,
  `npm test`, and `npm run build` all pass.
- Do NOT implement auth/admin (out of scope). Persistence stays behind the HTTP
  contract so it can migrate to Postgres later.

## Slice Boundary (PR 3)

- Base: after PR 1 + PR 2 merge to main (foundation + 100-exercise catalog +
  pure domain modules: grading, recommendations, leaderboard).
- Finish: attempt state machine, typed API client (graceful failure), and the
  four React UI screens (NameEntry, ExerciseRunner, Results, Leaderboard) wired
  in `App.tsx`. Local results flow works without the Netlify API.
- Do NOT implement PR 4 Netlify functions/Blobs.

## Completed Tasks (cumulative)

### PR 1 — Foundation / Toolchain (done in prior slice)

- [x] 1.1 Create `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, and `index.html` with React, TypeScript, Vite, Vitest, and scripts.
- [x] 1.2 Create `src/main.tsx` and `src/App.tsx` with minimal app bootstrap and placeholder screen routing.
- [x] 1.3 Create `src/domain/types.ts` and `src/content/topics.ts` for `Topic`, `Exercise`, attempt, result, answer, and leaderboard contracts.
- [x] 1.4 Create `src/domain/catalog.ts` with `validateCatalog()` enforcing count, approved topics, unique ids, prompts, answers, and 12/13 topic distribution.

### PR 2 — Catalog / Domain Rules (done in prior slice)

- [x] 2.1 Create `src/content/exercises.ts` with exactly 100 balanced exercise records across the 8 approved topics.
- [x] 2.2 Add `src/domain/grading.ts` for `gradeAnswer()` and `gradeAttempt()` using trim + case-fold accepted-answer matching.
- [x] 2.3 Add `src/domain/recommendations.ts` for top-3 topics with miss rate >= 40%.
- [x] 2.4 Add `src/domain/leaderboard.ts` ranking by score desc, timestamp asc, normalized name asc, then `attemptId` asc.

### PR 3 — Attempt State / UI (prior slice)

- [x] 3.1 Create `src/state/attemptReducer.ts` for `not-started → in-progress → completed`, answer recording, retakes, and post-completion rejection.
- [x] 3.2 Create `src/api/client.ts` with typed wrappers for `claim-name`, `submit-score`, and `get-leaderboard`.
- [x] 3.3 Create `src/ui/NameEntry.tsx` with non-empty name validation, friendly empty-name guidance, and retake-safe claim flow.
- [x] 3.4 Create `src/ui/ExerciseRunner.tsx`, `Results.tsx`, and `Leaderboard.tsx` for question flow, score, mistakes, recommendations, submit status, and rankings.

### PR 4 — Netlify API + shared leaderboard (this slice)

- [x] 4.1 Create `netlify.toml` with build command, `dist/` publish directory, and `netlify/functions` directory.
- [x] 4.2 Create `netlify/functions/_store.ts` with Netlify Blobs helpers for normalized name claims, attemptId-keyed idempotent writes, and entry listing.
- [x] 4.3 Create `netlify/functions/claim-name.ts`, `submit-score.ts`, and `get-leaderboard.ts` matching the OpenSpec API contracts.

## Files Changed (PR 3 slice)

| File | Action | What Was Done |
|------|--------|---------------|
| `src/state/attemptReducer.ts` | Created | Pure reducer: `not-started → in-progress → completed`. `start` (validates non-empty trimmed name + attemptId, trims name), `answer` (in-progress-only, replaces existing answer for same exercise id, auto-completes at `total`), `retake` (fresh attemptId, keeps name + total, clears answers), `reset`. Post-completion answers are rejected. Never mutates input. |
| `src/state/__tests__/attemptReducer.test.ts` | Created | 22 Vitest tests: initial state + fresh-object guarantee, start transitions + trim + empty/empty-id rejection, answer recording + replace + no-mutation + completion + no-early-complete + rejection (not-started/completed/zero-total), retake (new id, name kept, answers cleared, empty-id rejected, defensive from in-progress), reset. |
| `src/api/client.ts` | Created | Typed wrappers `claimName`, `submitScore`, `getLeaderboard` + `createAttemptId`. Discriminated `ApiResult<T>` (never throws on transport/HTTP failure). `claimName` short-circuits invalid names (no network) and trims. `getLeaderboard` ranks client-side via pure `rankEntries`. Defaults to `/.netlify/functions`, custom `baseURL` for tests. `createAttemptId` uses `crypto.randomUUID` with fallback. |
| `src/api/__tests__/client.test.ts` | Created | 16 Vitest tests (fetch mocked): claim short-circuit/trim/first-claim/retake/unavailable/bad-status/bad-response; submit payload + unavailable (retry-safe); getLeaderboard client-side rank + missing-entries + unavailable + custom baseURL; createAttemptId distinct + crypto path. |
| `src/ui/NameEntry.tsx` | Created | Presentational name capture. Non-empty validation with friendly, non-hostile empty-name guidance (shown after blur/submit). Trims name and reports up via `onClaimName` so the parent owns the retake-safe claim flow. Supports `busy` + `notice` (API-unavailable message). |
| `src/ui/ExerciseRunner.tsx` | Created | One-question-at-a-time flow against the catalog. Shows topic + progress (N of total), records answers via `onAnswer`, Back/Skip/Next navigation, Finish on last. Re-syncs the input on navigation via a memoized key. Pure presentational — grading is the parent's job. |
| `src/ui/Results.tsx` | Created | End-of-test summary: score (0–100), submit-status banner (idle/submitting/submitted/failed + retry with same attemptId), study-tips recommendations, mistakes list with topic + given + accepted answers. On failure, local results still shown with a retry button. |
| `src/ui/Leaderboard.tsx` | Created | Ranked list of every attempt row (retakes = multiple rows per name). Refresh + back buttons. Friendly error/loading/empty states via `LeaderboardStatus`. Ranking is done client-side before reaching this component. |
| `src/App.tsx` | Modified | Replaced placeholder router with real screen flow around `useReducer(attemptReducer)`: name claim → exercise runner → results (auto-submit on completion via `useEffect`) → leaderboard. Graceful API handling: local grading always works; submit/leaderboard failures show friendly messages. Retake generates a new attemptId. |
| `src/styles.css` | Modified | Child-friendly styles for cards, buttons, NameEntry, ExerciseRunner, Results, Leaderboard (score, mistakes, ranking rows, status banners). Removed placeholder-only styles. |
| `openspec/changes/english-exercise-app/tasks.md` | Updated | Marked tasks 3.1–3.4 as `[x]`. |

## Verification (run in this slice)

| Command | Result |
|---------|--------|
| `npm run typecheck` (`tsc -b`) | OK — no type errors. |
| `npm test` (vitest run) | OK — 7 files, 98 tests passed (catalog 10 + grading 17 + recommendations 10 + leaderboard 11 + exercises 9 + attemptReducer 22 + api/client 16 + grading catalog-order subset). |
| `npm run build` (`tsc -b && vite build`) | OK — `dist/` produced (index.html + 4.95 kB CSS + 220.86 kB JS). |

## Deviations from Design

- **`ApiResult` discriminated union instead of throwing**: design.md describes
  the API contracts but not the client's failure shape. The shared-leaderboard
  spec requires the student to still see local results on submission failure,
  so the client returns `ApiResult<T>` (success | `ApiError`) and never throws
  on transport/HTTP failures. This is a robustness choice consistent with the
  spec, not a contract change. The server-side contract is unchanged.
- **`claimName` short-circuits invalid names without a network call**: the
  student-session spec blocks empty/whitespace names; the client enforces this
  client-side (returns `{ ok:false, reason:'invalid' }`) before calling the
  server, which matches the "defensively server-side too" guidance and avoids
  a needless round-trip. The server (PR 4) will still validate.
- **`getLeaderboard` ranks client-side**: the design says `get-leaderboard`
  lists entries and the pure `rankEntries` ranks them. To keep a single
  ranking source of truth, the client ranks after fetching. PR 4 may also
  rank server-side; client-side ranking is idempotent with the pure module.
- **App-level submit auto-fire via `useEffect`**: the design's data flow shows
  Results → POST submit-score on completion. To make this robust under React
  StrictMode double-invocation, the submit is gated by `submitStatus.kind ===
  'idle'` so it fires once; the same `attemptId` retry is idempotent per spec.
- **UI is presentational, state in `App.tsx`**: the design's architecture
  decision places app state in a single `attempt` reducer + React Context. The
  reducer lives in `src/state/attemptReducer.ts` (pure, tested). For PR 3's
  scope (local UI flow) a `useReducer` in `App.tsx` is sufficient and avoids
  overbuilding a Context; if later screens need shared state, a Context can
  wrap the same reducer without changing its contract.

## Issues Found

- First leaderboard-rank test had the normalized-name comparison reversed
  ("maria" vs "marco" — `c` < `i`, so "marco" sorts first). The implementation
  uses the spec-tested `rankEntries` and was correct; fixed the test
  expectation.
- `LeaderboardStatusLine` returned `null` in a branch but was typed
  `JSX.Element`; fixed the return type to `JSX.Element | null` (typecheck
  caught it before tests ran).
- Initial `App.tsx` used `useMemo` and `Promise.resolve().then(...)` to fire
  side effects (submit + leaderboard load) — an anti-pattern. Refactored both
  to `useEffect` so network calls are render-safe.

## Files Changed (PR 4 slice)

| File | Action | What Was Done |
|------|--------|---------------|
| `netlify.toml` | Created | Build command (`npm run build`), publish `dist/`, functions dir `netlify/functions`, `node_bundler = "esbuild"`, SPA fallback redirect. |
| `netlify/functions/_store.ts` | Created | Netlify Blobs helpers: `StoreLike` interface + `BlobsStore` adapter (wraps `@netlify/blobs` `Store`: `get(key,{type:'json'})`, `setJSON(key,val,{onlyIfNew})`, `list({paginate:true})`); `getNamesStore`/`getLeaderboardStore` resolve from env; `claimName` (normalized identity, idempotent `onlyIfNew`, retake returns reserved canonical display name); `submitScore` (defensive validation, server-stamped `timestamp`, `attemptId`-keyed idempotent write); `getRankedLeaderboard` (lists all keys, skips malformed blobs, ranks via pure `rankEntries`). |
| `netlify/functions/claim-name.ts` | Created | Netlify v2 `export default (request: Request) => Response`. Injectable `handler(store, request)` for tests. POST-only; parses JSON; rejects empty/whitespace with `{ok:false,reason:'invalid'}` (400); first claim + retake both return `{ok:true,name}` (200). |
| `netlify/functions/submit-score.ts` | Created | Netlify v2 handler. POST-only; defensive payload validation; idempotent write keyed by `attemptId`; returns `{ok:true}` on new write and on retry; `{ok:false,reason:'invalid'}` (400) on bad payload. |
| `netlify/functions/get-leaderboard.ts` | Created | Netlify v2 handler. GET-only; returns bare ranked `LeaderboardEntry[]` JSON array (200); 405 on non-GET. |
| `netlify/functions/__tests__/claimName.test.ts` | Created | 5 unit tests: empty rejection (no write), first claim trims + reserves, retake same identity, distinct names distinct, returns canonical display name on retake. |
| `netlify/functions/__tests__/submitScore.test.ts` | Created | 4 unit tests: invalid payloads rejected, writes entry keyed by attemptId, idempotent retry no-op, new attemptId new row. |
| `netlify/functions/__tests__/getLeaderboard.test.ts` | Created | 6 unit tests: empty store, retakes = multiple rows, score desc, tie by timestamp, tie by name then attemptId, skips malformed blobs. |
| `netlify/functions/__tests__/handlers.test.ts` | Created | 9 integration tests across all three handlers using real `Request`/`Response`: claim (empty/first/retake/bad-json/non-POST), submit (valid/idempotent/invalid/non-POST), leaderboard (ranked array/empty/non-GET). |
| `tsconfig.netlify.json` | Created | Separate TS project for `netlify/**/*.ts` source (DOM lib for `Request`/`Response`, node types). Excludes tests (covered by test project). |
| `tsconfig.json` | Modified | Added reference to `tsconfig.netlify.json` so `tsc -b` typechecks functions. |
| `tsconfig.test.json` | Modified | Expanded `include` to add `src/**/*.ts`, `src/**/*.tsx`, and `netlify/**/*.ts` so cross-project imports (`../../../src/domain/types`) resolve in the test project. |
| `package.json` | Modified | Added runtime deps `@netlify/blobs@^10.7.9` and `@netlify/functions@^5.3.0`. |
| `openspec/changes/english-exercise-app/tasks.md` | Updated | Marked tasks 4.1–4.3 as `[x]`. |

## Verification (run in this slice)

| Command | Result |
|---------|--------|
| `npm run typecheck` (`tsc -b`) | OK — no type errors across app + node + netlify + test projects. |
| `npm test` (vitest run) | OK — 12 files, 134 tests passed (98 prior + 36 new across 4 new netlify test files). |
| `npm run build` (`tsc -b && vite build`) | OK — `dist/` produced (index.html + 4.95 kB CSS + 221.50 kB JS). |

## Deviations from Design

- **Separate `tsconfig.netlify.json`**: design.md lists `netlify/functions/*.ts`
  as created files but did not specify a TS project for them. The root
  `tsconfig.app.json` only includes `src/`, and `tsconfig.test.json` only
  included test files. To make `tsc -b` typecheck the serverless source
  (which uses Web Fetch `Request`/`Response`), a dedicated project with DOM lib
  was added and referenced from `tsconfig.json`. No contract change.
- **Injectable `handler(store, request)` + thin `export default`**: design.md
  shows the three functions but not their test seam. To satisfy the
  "integration tests with mocked `_store`" requirement, each function exports a
  pure `handler(store, request)` used by tests, and a default export that
  resolves the store from Netlify env. This is a testability pattern, not a
  contract change — the deployed endpoint behavior matches the OpenSpec API
  contracts exactly.
- **Defensive payload validation in `submitScore`**: the design says submit
  accepts `{name, score, attemptId}`; the function additionally rejects empty
  names, non-finite scores, scores outside 0–100, and empty attemptIds with
  `{ok:false,reason:'invalid'}`. This is consistent with the client-side guard
  and the student-session spec's "defensively server-side too" guidance. The
  happy-path contract is unchanged.
- **`get-leaderboard` skips malformed blobs**: design says list + read + sort.
  The implementation defensively skips blobs that don't satisfy the
  `LeaderboardEntry` shape so one corrupt entry never blanks the whole board.
  This is a robustness addition, not a contract change.

## Issues Found

- Initial function files were written with the arrow `=>` missing from the
  default-export arrow-function return type annotation (`Promise<Response> {`
  instead of `Promise<Response> => {`), which produced `TS1005: '=>' expected`.
  Rewrote the three files cleanly; typecheck then passed.
- The first `getLeaderboard.test.ts` used the wrong relative import path
  (`../../src/domain/types`); corrected to `../../../src/domain/types` to match
  the `netlify/functions/__tests__/` location. Added `src/**/*.ts` and
  `netlify/**/*.ts` to `tsconfig.test.json` so cross-project imports resolve.

## Remaining Tasks (later PR slices — NOT in this slice)

- [ ] 5.1 `src/domain/__tests__/*.test.ts` — full domain test suite (final)
- [ ] 5.3 Manual smoke test on a Netlify deploy preview (final)
- [ ] 5.2 is effectively done here (integration tests for functions added); the
  Phase 5 checkbox in tasks.md still tracks the full suite run + manual smoke.

## Workload / PR Boundary

- Mode: stacked PR slice (PR 4 of 4), stacked-to-main
- Current work unit: PR 4 — Netlify API + shared leaderboard
- Boundary: starts from PR 1 + PR 2 + PR 3 (foundation + catalog + pure domain +
  attempt state + React UI); ends with Netlify config, Blobs-backed store
  helpers, the three serverless functions, and their integration tests. No
  auth/admin (out of scope).
- Estimated review budget impact: focused serverless implementation — store
  helpers + three thin handlers + four test files. Logic stays in pure domain
  modules (already in main); functions are thin I/O + validation.

## Status

15/17 tasks complete (Phase 1 + Phase 2 + Phase 3 + Phase 4 fully done). Ready
for verify (Phase 5: full test suite + manual smoke) after this PR merges to
main.