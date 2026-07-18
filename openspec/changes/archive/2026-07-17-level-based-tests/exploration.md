# Exploration: level-based-tests

## Topic

Replace the single 100-question test with a progression of 10 levels (10 questions each), built from the same 100 questions reordered from easiest to hardest. A child passes a level with a minimum grade of 9/10, and only passing a level unlocks the next one. Retake of a level is allowed; the shared cross-device leaderboard is preserved.

## Project State (verified)

- Working dir: `C:\laragon\www\english-learning`
- Source of truth specs live in `openspec/specs/` (5 domains: `exercise-bank`, `student-session`, `scoring-feedback`, `shared-leaderboard`, `netlify-deployment`).
- Archived prior change at `openspec/changes/archive/2026-07-17-english-exercise-app/` (proposal, design, tasks, verify, and a matching `specs/` set — used as the precedent for chain order, not as the current state of truth; the live source is `openspec/specs/`).
- Live app: `https://en-learn.netlify.app/` (Vite + React 19 + TypeScript 5.9, Vitest 4, Netlify Functions v2 + Blobs).
- `openspec/config.yaml`: `execution_mode: interactive`, `pr_strategy: force-chained`, `review_budget_lines: 400`, `strict_tdd: false`.

## Current State (what the system does today)

### Content (`src/content/exercises.ts`, `src/content/topics.ts`)

- `EXERCISES` is a `readonly Exercise[]` of exactly 100 records, validated at module load by `assertValidCatalog`.
- The catalog is **grouped by topic** (4 topics × 13 + 4 topics × 12), not ordered by difficulty. Topic groups appear in a fixed order: `present-simple` → `simple-past` → `present-progressive` → `simple-past-3rd` → `present-simple-3rd` → `present-progressive-3rd` → `daily-routine` → `like-dislike`.
- There is no `difficulty` field on `Exercise`. There is no `level` field. There is no concept of "level 1..10" anywhere in the data model.

### Domain (`src/domain/`)

- `catalog.ts`: `EXPECTED_CATALOG_SIZE = 100` is a hard constant; `validateCatalog` rejects catalogs of any other size (`'count' issue`) and rejects any per-topic count outside [12, 13]. The 100-count rule is part of the spec contract.
- `grading.ts`: `gradeAttempt(exercises, responses)` returns `{ score, mistakes, recommendations }`. `score` is on a 0–100 scale (`Math.round((correct / total) * 100)`), where `total === exercises.length`. The function is pure and reads only its inputs — it does not know about "levels".
- `recommendations.ts`: topic-level miss-rate analysis (≥ 40 % → recommended, top 3). Operates on the full answers list; the threshold is per-attempt, not per-level.
- `leaderboard.ts`: `rankEntries` ranks by score desc → timestamp asc → normalized name asc → attemptId asc. Treats the input list as a flat set of attempt rows.

### State (`src/state/attemptReducer.ts`)

- One global `AttemptData` object per app instance. Lifecycle: `not-started → in-progress → completed`.
- `total` is set once at `start` (currently `EXERCISES.length === 100`). Auto-completes when `answers.length === total`.
- `retake` action resets answers and bumps `attemptId` but **preserves** the catalog size in `total`. There is no concept of "which level this attempt is for".

### App shell (`src/App.tsx`)

- Screen state machine (5 values): `name-entry`, `exercise-runner`, `results`, `leaderboard`, plus a "back from leaderboard" path that returns to whichever screen the child came from.
- The default landing screen on a fresh load is `name-entry`. After claim, the child is sent straight into the 100-question test.
- `handleRetake` (line 197): re-uses the same display name and starts a new attempt with a new `attemptId`. No notion of "which level".

### UI (`src/ui/`)

- `ExerciseRunner.tsx`: renders one question at a time from a `readonly Exercise[]` prop; progress label "Question N of total"; Back / Skip / Next / Finish. The component is fully driven by the prop array — it does not care how the array was produced.
- `Results.tsx`: shows the 0–100 score, mistakes list, recommendations, and a "Try again" / "See leaderboard" pair. **"Try again" is wired to a flat retake** — no notion of "next level".
- `Leaderboard.tsx`: renders every attempt row as its own entry, ranked by `rankEntries`. No level column.
- `NameEntry.tsx`: presentational; calls `onClaimName(trimmed)` and waits.

### Persistence (`netlify/functions/_store.ts`, `netlify/functions/submit-score.ts`)

- Two Netlify Blobs stores: `names` (one blob per normalized name → `{ displayName, claimedAt }`) and `leaderboard` (one blob per `attemptId` → `LeaderboardEntry`).
- `LeaderboardEntry = { attemptId, name, score, timestamp }`. Server stamps `timestamp` on write. Idempotency comes from `setJSON(key, entry, { onlyIfNew: true })`.
- `score` is validated server-side as `0 ≤ score ≤ 100`. The store does not know about levels.

### Specs (`openspec/specs/`)

- `exercise-bank/spec.md` — hard "exactly 100" + "12 or 13 per topic" rules. The 100-count rule MUST change to a "100 records partitioned into 10 levels of 10" rule (the *count* of records stays 100; the *partition* is new).
- `scoring-feedback/spec.md` — "score on a 0–100 scale (correct answers out of 100)". The scale MUST change to 0–10 for per-level scoring, OR the per-level score MUST be rescaled to 0–100 on submit (e.g. `score * 10`). Cleanest: change the scale to 0–10 to match the new domain.
- `student-session/spec.md` — `not-started → in-progress → completed` is unchanged. New: a *level progression* state lives alongside the per-attempt state.
- `shared-leaderboard/spec.md` — "list every submitted attempt as its own row" stays. New: each row needs a `level` field (or equivalent) so the UI can filter/group, and `score` semantics change to 0–10.

## Requirements (extracted from the user request)

Functional MUST-haves (from the brief):

1. Replace the single 100-question test with **10 levels × 10 questions = 100 questions total** — same 100 records, just partitioned.
2. Reorder the 100 questions from **easiest to hardest** across levels 1..10.
3. A level is **passed** when the child scores **≥ 9 / 10** on it.
4. **Only a passed level unlocks the next one.** Locked levels cannot be started.
5. The child may **retake a level** any number of times.
6. The **leaderboard is kept** (cross-device, shared).
7. After passing, the child can **continue to the next level immediately, later, or whenever they want** — no forced transition.

Non-functional:

- Audience is still children; UX must remain child-friendly.
- The shared cross-device leaderboard is a hard product constraint that must survive the refactor.

## Affected Areas

Files/modules that the change touches or has to coordinate with:

- `src/content/exercises.ts` — add a `difficulty` (or equivalent) marker per record so the level partition is deterministic. Keep all 100 ids and prompts byte-identical so existing retake / partial attempt data stays coherent.
- `src/content/levels.ts` *(new)* — declare the 10 levels (id, label, ordered exercise ids) and a partition function. Lives next to `exercises.ts`.
- `src/domain/types.ts` — add `Level`, `LevelId`, and a `level?: LevelId` field on `LeaderboardEntry`. `score` semantics change to 0–10.
- `src/domain/grading.ts` — `gradeAttempt` already takes any `exercises` array; call it with the level's 10 questions. No code change required if the scale is reported as a fraction and the caller multiplies by 10 — but cleanest: introduce `gradeLevel(level, responses): { score, mistakes, recommendations }` that returns 0–10, keep `gradeAttempt` for the spec's old contract (or rename it).
- `src/domain/recommendations.ts` — unchanged. The miss-rate threshold still applies per level.
- `src/domain/leaderboard.ts` — `rankEntries` unchanged. `LeaderboardEntry` gains `level`; the server writes it.
- `src/domain/levelProgress.ts` *(new)* — pure functions: `passedLevels(attempts) → Set<LevelId>`, `isUnlocked(levelId, progress)`, `nextUnlocked(...)`, etc. Used by the new level-select screen and the attempt flow.
- `src/state/attemptReducer.ts` — add a `levelId` to `AttemptData` (set on `start`) so the level lives in the same state machine. No lifecycle change.
- `src/state/levelProgressReducer.ts` *(new)* — owns the local `progress` map (unlocked/passed per level). Reducer + persistence hook.
- `src/api/client.ts` — `submitScore` and `getLeaderboard` already accept `LeaderboardEntry`; add `level` to the request payload. `getLeaderboard` may need a query param to filter by level (see Approaches).
- `netlify/functions/_store.ts` — store writes/reads the new `level` field. Validation adds `level ∈ 1..10`. Score range changes to 0 ≤ score ≤ 10.
- `netlify/functions/submit-score.ts` / `get-leaderboard.ts` — propagate the new field; possibly add a `?level=N` filter to the read endpoint.
- `src/App.tsx` — add `'level-select'` to the `Screen` union. Default landing is now `level-select` (with `name-entry` only when no name has been claimed). `handleRetake` becomes "retry this level" instead of "restart the 100".
- `src/ui/ExerciseRunner.tsx` — almost no change; the prop array shrinks from 100 to 10. The "Finish" button's behavior is unchanged. Progress label "Question N of 10" is the only visible change.
- `src/ui/Results.tsx` — show level context ("Level 3 — passed!"); add a "Next level" button when passed (calls `onAdvance`), keep "Try again" (retake this level), keep "See leaderboard".
- `src/ui/LevelSelect.tsx` *(new)* — the level map: 10 cards, each showing locked / unlocked / passed state. Tapping an unlocked level starts it; tapping a locked level is disabled with a friendly hint.
- `src/ui/Leaderboard.tsx` — add a level column (or level filter). Top 3 styling stays.
- `openspec/specs/exercise-bank/spec.md` — replace the "exactly 100 in one flat catalog" requirement with "exactly 100 records, partitioned into 10 levels of 10, ordered easiest to hardest".
- `openspec/specs/scoring-feedback/spec.md` — score scale becomes 0–10 (one level = 10 questions); pass threshold = 9.
- `openspec/specs/student-session/spec.md` — new requirement: "Level Progression" + "Unlocking the Next Level".
- `openspec/specs/shared-leaderboard/spec.md` — leaderboard rows include `level`; per-level and global views both work.
- `openspec/specs/netlify-deployment/spec.md` — payload shape update + new `?level` query on the read endpoint.
- Tests across the touched domain/state/UI/function modules.

## Approaches

I considered three real forks. The dimensions the user actually cares about are: (a) how difficulty is assigned, (b) how the leaderboard is sliced, (c) where progression is persisted.

### A. Static `difficulty` per exercise + partition table, global leaderboard, localStorage progression

- **Difficulty**: each `Exercise` gains a `difficulty: 1..10` field set by the content author in `exercises.ts`. A separate `LEVELS` table in `src/content/levels.ts` partitions the 100 ids into 10 ordered groups of 10. `Level N = exercises where difficulty === N` (or the explicit table; either is fine — explicit table is easier to author and test).
- **Leaderboard**: every attempt is still a single row. The `LeaderboardEntry` gains a `level: LevelId` field. The server endpoint `GET /get-leaderboard` accepts an optional `?level=N` to filter; the default (no param) returns the **global** board (every row, ranked the same way as today). Score scale is 0–10.
- **Progression**: stored in `localStorage` under `english-learning:progress` as `{ [levelId]: { bestScore, passed, lastAttemptAt } }`. Mirrored to a new `progress` Netlify Blobs store keyed by `nameClaimKey` so a child can resume on a different device (optional v1.5; can be skipped for v1).
- **Pros**
  - Content authoring is the most explicit model: the order is human-judged, stable, and reviewable in code review.
  - `gradeAttempt` already takes any `exercises` array; the level-select UI just hands it 10. Minimal pure-function churn.
  - Global leaderboard preserved (one row per attemptId, idempotency intact), so the existing spec's "every attempt is a row" rule survives as a base case.
  - Per-level filter is a thin read-time concern, not a schema migration.
  - Progression in `localStorage` keeps the read path fast and the data private; the optional blob mirror is a small additive feature.
  - Retake is just "start this level again" — the reducer already supports it.
- **Cons**
  - The content author has to assign difficulty to all 100 records. One-time effort but unavoidable because "easiest to hardest" requires human judgment; a computed ordering would not be defensible for children.
  - Score semantics change from 0–100 to 0–10. Any external consumer of the leaderboard sees a different number. The leaderboard is internal (no public API consumers documented) so this is acceptable, but it MUST be called out in the change.
  - One new screen (`LevelSelect`) and one new reducer (`levelProgressReducer`) — chain budget needs two PRs.
- **Effort**: Medium.

### B. Topic-order difficulty (no per-exercise field), global leaderboard, localStorage progression

- **Difficulty**: order is **derived** from the existing topic order. `Level 1 = first 10 of present-simple`, `Level 2 = next 10 of present-simple`, ... up to `Level 10 = last 10 of like-dislike`. No new fields anywhere.
- **Leaderboard**: same as A.
- **Progression**: same as A.
- **Pros**: zero changes to `exercises.ts`; the level partition is a pure function of the existing topic order.
- **Cons**: "Easiest to hardest" by topic order is a guess, not a content decision. Present-simple is arguably easier than present-progressive-3rd, but the per-topic ordering inside each topic is by `id` (1..13) which is not a calibrated difficulty scale. The user's "easiest to hardest" intent is probably **not** "by topic, in catalog order" — children will hit every-day-routine (Level 8) before the most basic 3rd-person (Level 5), which is pedagogically backwards. This is a real product regression masked as "no content work."
- **Effort**: Low. But the wrong call.

### C. Static `difficulty` per exercise + partition table, **per-level** leaderboard only, localStorage progression

- Same as A, but the leaderboard is scoped per level — there is no global board. The UI shows a leaderboard filtered to the current level. The Netlify Blobs schema gains a composite key (`level:attemptId`).
- **Pros**: the leaderboard is more meaningful at the per-level granularity ("who passed Level 5 the fastest" instead of "who got the highest score overall on a 0–10 scale").
- **Cons**: the user said "Keep leaderboard" — implying the current global view should stay. Removing the global board is a visible product regression for the kids who already have a global score. Also, the existing spec's "list every submitted attempt as its own row" rule was written for the global board; replacing it with per-level-only requires a `RENAMED`/`MODIFIED` block in the spec and may break the "every attempt is a row" invariant if "every" is interpreted globally. Migration is also messier: a child's old global row from before this change has no `level` field, so it has to be backfilled or hidden.
- **Effort**: Medium-High, with worse risk profile than A.

### D (quickly considered, dismissed). Static `difficulty` + a single "highest level passed" board

- The leaderboard becomes a single global metric: the highest level the child has passed (and optionally a best score per level). No per-attempt history on the server.
- **Pros**: simpler server; great for a classroom.
- **Cons**: throws away retake rows, breaks the "every attempt is a row" spec rule, and is a hard product regression for the kids who already competed on the current global board. The user said "Keep leaderboard" — they did not say "rewrite the leaderboard around level."

## Recommendation

**Go with Approach A: static `difficulty` per exercise (or an explicit `LEVELS` partition table), a per-level `level` field on `LeaderboardEntry`, the global leaderboard preserved with an optional `?level=N` filter, and progression persisted in `localStorage` (with an optional Netlify Blobs mirror in a follow-up).**

Why this fits the brief:

- "Reorganize the existing same 100 questions from easiest to hardest" requires **content-driven difficulty**, not an algorithm. The author marks difficulty once in `exercises.ts` (or in a `LEVELS` lookup table); the level partition is then a pure read of that metadata. This is the only approach that respects the "easiest to hardest" intent for a children's product.
- "Keep leaderboard" reads as "do not delete the global board." Approach A preserves every existing row plus the same ranking, just with a 0–10 score column and a new `level` column. The optional `?level` filter is purely additive and lets us ship the per-level view in a later PR if the kids want it.
- "Retake of a level" maps to today's `retake` action: clear answers, new `attemptId`, same level, same display name. The existing reducer already does this; the only change is that `total` becomes 10 instead of 100.
- Progression in `localStorage` is the simplest place to keep "which level am I on" — it is a per-device UX state, not a competitive record, so a shared server write would be overkill. The optional Blobs mirror is a small follow-up if a teacher reports "I switched laptops and my child lost progress."
- The 400-line review budget maps cleanly: PR1 = content (difficulty + `LEVELS` table + catalog validation update), PR2 = domain/state/UI (level-select screen, level-aware Results, retake-this-level), PR3 = leaderboard schema migration (add `level`, update server, update tests), PR4 = optional cross-device progression mirror.

If the user later asks for cross-device progression (e.g. "my child switched tablets"), Approach A can grow a `progress` blob in a 5th PR without touching the leaderboard schema.

## Risks

- **R1 — Content authoring effort (highest).** All 100 records need a difficulty mark. Mitigation: do it as a single focused PR with a content-only diff so it can be reviewed by a teacher/editor, not the code reviewer. The `LEVELS` partition table is its own reviewable artifact: 10 buckets of 10 ids, each easy to spot-check.
- **R2 — Score scale change is a visible product change.** Kids (and their parents) who already submitted a score on the 0–100 scale will see new rows at 0–10. The global leaderboard will mix the two scales if the old rows stay. **Decision needed**: do we (a) clear the existing `leaderboard` blob on deploy (loses history, but the row count is small for a young app), (b) rescale old rows (`score = Math.round(old / 10)`) on a one-time backfill, or (c) leave old rows as-is and accept the mixed scale (UI shows "?" or "— (legacy)"). Default to (b) with a documented migration in `netlify-deployment` spec.
- **R3 — Spec invariant migration.** The "exactly 100" rule survives (we still have 100 records), but the "12 or 13 per topic" rule is **at risk**: reordering by difficulty will almost certainly move records across topic buckets in the partition (e.g. an `easy` `simple-past-3rd` exercise could land in Level 1 alongside 9 `present-simple` records). The topic-distribution rule was authored for the flat-catalog model and does not constrain the level partition, so the spec change is clean: keep the "100 records, 12 or 13 per topic" rule on the **flat catalog**, add a new "100 records, partitioned into 10 levels of 10 ordered by difficulty" rule on the **levels view**. No record count or topic count changes.
- **R4 — "What is difficulty, exactly?" is a product question, not a code one.** The author must agree on a single rubric (e.g. "auxiliary complexity" — bare present-simple < present-progressive < 3rd-person agreement < past tense < past + 3rd-person) before the PR. The exploration cannot decide this; the proposal or a follow-up `sdd-design` step must. If the rubric is wrong, kids will get frustrated and the whole change is wasted.
- **R5 — Progression is per-device by default.** `localStorage` does not survive a tablet swap. If "the child can come back later" is interpreted as "from any device," we MUST ship the cross-device progression mirror in the same change. The brief is ambiguous ("immediately, later, or whenever they want"). Recommend: ship `localStorage` for v1, mark the cross-device mirror as a follow-up, and surface the question in the proposal.
- **R6 — Locked-level UX edge case.** A child who is in the middle of Level 4 and switches to a different device (no cross-device progression) lands on `level-select` with Levels 1–4 unlocked on the *new* device. They could re-start Level 4 and pass it. The leaderboard will show two Level 4 rows for the same name. This is the same situation the v1 leaderboard already handles (it does not collapse to best-score-only), so it is consistent. Call it out in the spec.
- **R7 — Leaderboard backfill is irreversible.** If we rescale old 0–100 rows to 0–10 (R2 option b), the original integer is gone. The user should approve the migration explicitly in the proposal, not as a default in code.
- **R8 — `EXPECTED_CATALOG_SIZE = 100` is asserted at module load.** Any change to the catalog that loses a record will hard-fail startup. The new validation MUST keep `100` as the total. The level-partition validation is additive and does not modify the per-record count.
- **R9 — `ExerciseRunner` progress label.** Today it shows "Question 1 of 100." After the change, "Question 1 of 10" — a noticeable UX shift. Documented in the design.
- **R10 — Test surface area.** `exercises.test.ts` asserts `EXERCISES.length === 100` and the per-topic 12/13 distribution. Those tests stay green. New tests: `levels.test.ts` (partition shape, ordering), `levelProgress.test.ts` (unlock logic, retake-allowed, locked-untouchable), `grading.test.ts` (level scoring is 0–10, pass = ≥ 9), leaderboard tests (level field round-trip, `?level` filter).
- **R11 — "Pass = 9" vs. "Pass = 9/10 = 90 %".** 9/10 is the same as 90 %, but `Math.round((9/10) * 10) === 9` and `Math.round((8/10) * 10) === 8` — so a child who gets 8/10 right and one "skip" (counted wrong) scores 8 and does not pass. The `Skip` button in `ExerciseRunner` is the existing behavior and is preserved; it just becomes more consequential at the per-level scale. Worth a 1-line product callout in the proposal (e.g. "skipping a question counts as wrong, same as v1").
- **R12 — Chain budget.** With four real sub-efforts (content, domain+UI, leaderboard migration, optional cross-device progression), this is a 3–4 PR change. `force-chained` is the right strategy; the design MUST keep each PR under 400 lines.

## Open Questions for the User (resolve before sdd-propose)

I need exactly one of these answered per turn. The exploration is otherwise complete; I'll let the orchestrator pick the order.

1. **Migration of existing leaderboard rows.** Old rows have `score: 0..100` and no `level`. After this change the new scale is 0..10 and `level` is required. Pick one: (a) clear the `leaderboard` blob on deploy (clean break, loses ~weeks of history for the kids who played v1), (b) backfill: rescale old scores (`newScore = round(old / 10)`) and stamp `level: 0` (or a new "legacy" bucket), (c) leave the old rows as-is and let the UI label them "legacy (0–100 scale)".
2. **Cross-device progression in v1 or v1.5?** "Continue later, or whenever they want" — does "later" mean "from any device" or "on the same device"? If any device, we need the Netlify Blobs `progress` mirror in the same change. If same device, `localStorage` is enough.
3. **Passing grade.** 9 out of 10, or 9 / 10 expressed as 90 %? The implementation is the same (`score >= 9`), but the UI copy differs ("you need 9 correct answers" vs. "you need 90 %").
4. **Per-level leaderboard view in v1?** A `?level=N` filter is cheap to ship and the UI's `Leaderboard.tsx` already renders a list. Confirm the global board stays as the default and the per-level view is an opt-in tab — or both are tabs from day one.
5. **Difficulty rubric.** Who assigns `difficulty: 1..10` to the 100 records, and is the rubric documented? (Required before sdd-design can finalize the `LEVELS` table — this is the one question the change cannot move forward without.)

## Ready for Proposal

**Yes — once the five open questions are answered.** The recommendation (Approach A) and its rationale are stable; the questions above only affect migration code, the progression persistence shape, and the content-rubric review. The orchestrator should resolve question #1 (leaderboard migration) and #2 (cross-device progression) first, then launch `sdd-propose` with the answers; question #5 (difficulty rubric) is the one that gates `sdd-design` from producing the `LEVELS` partition, so the orchestrator may want it resolved before sdd-design rather than before sdd-propose.

## Artifacts

- `openspec/changes/level-based-tests/exploration.md` (this file)
