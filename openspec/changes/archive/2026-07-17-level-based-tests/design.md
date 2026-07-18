# Design: Level-Based Tests

## Technical Approach

Keep the existing pure-domain + reducer + Netlify-Functions architecture. The 100
records stay in one catalog; each gains a `difficulty` (1–10) that IS its level id,
so the partition is a pure `groupBy(difficulty)` — no second source of truth. Grading
stays generic (receives one level's 10 exercises). Progression is a pure unlock
function persisted to `localStorage` **per claimed student identity** (same-browser
v1). The leaderboard row gains `level`; global default + `?level=N` filter. Global
rank is level-aware (harder levels above easier). Legacy 0–100 rows are cleared once
with a selective, idempotent deploy script. Maps to proposal Approach A; satisfies
all six delta specs.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Level source of truth | `difficulty` field where `difficulty === levelId`; `buildLevels()` groups by it | Separate `LEVELS` id table | Spec already mandates `difficulty:1-10`; a second table would drift. `groupBy` is self-validating (each bucket must equal 10). |
| Score scale | `gradeAttempt.score` = raw correct count (0..N); N=10 → 0–10 | Keep 0–100, rescale at callers | No `*10`/`/10` math; `passed = score>=9` reads directly. |
| Progression store | `localStorage` key `english-learning:progress:v1:{nameClaimKey}` via `useLevelProgress`; pure logic in domain | Global browser key; Netlify Blobs mirror | v1 is same-browser only; keying by claimed-name claim key prevents one child inheriting another's unlocked levels on shared devices. Cross-device mirror deferred. |
| Leaderboard scope | Global default + additive `?level=N` | Per-level-only board | "Keep leaderboard" = keep global view; filter is read-time only. |
| Global ranking | `level` desc → `score` desc → `timestamp` asc → name → `attemptId` | Score-only global rank | Prevents a perfect Level 1 from outranking harder-level attempts; per-level view still ranks by score (then ties). Spec ranking delta must match this contract. |
| Legacy reset | Selective one-shot `scripts/reset-leaderboard.mjs` (delete invalid/legacy only) | Full wipe endpoint; continuous cleanup | Spec forbids migrating legacy rows; selective delete is idempotent and safe after new level-aware rows exist. |
| Recommendations | Level-scoped: topic miss rate ≥ 40% **and** ≥ 2 questions of that topic in the attempt | Unchanged 40% on 1-question topics | Avoids noisy 1/1 topic recommendations on mixed 10-question levels. |

### Difficulty rubric → 10 buckets (explicit risk)

Proposed pedagogical order (easiest→hardest by grammatical load): present-simple →
like/routine → present-progressive → simple-past → 3rd-person present → 3rd-person
past → 3rd-person progressive. That is a **7-category** ordering sketch, not a
solved mapping to **10** equal buckets. Exact per-record `difficulty: 1–10` is
authored in PR1 as a reviewable content diff; buckets validated to exactly 10 each.
Risk: initial order may frustrate children; treat as adjustable after feedback, not
as auto-derived from the 7 categories.

## Data Flow

    LevelSelect ──select any unlocked level──▶ dispatch start{levelId, total:10}
         ▲                                          │
         │ back to levels                           ▼
    useLevelProgress ◀─markPassed(id)─── Results ◀── gradeAttempt(level.exercises)
      (localStorage        (score 0–10, passed?)       ▲   │
       per nameClaimKey)    nav: retake / next /        │   └─submitScore{name,score,level,attemptId}
         │ unlock next           levels / leaderboard  │                    │
         └────────────────── ExerciseRunner ("Q N of 10")─┘                    ▼
                           Leaderboard ◀── getLeaderboard(level?) ◀── Netlify Blobs

### Results / navigation contract

| Action | When available | Behavior |
|--------|----------------|----------|
| Return to LevelSelect | Always after complete | Show locked/unlocked/passed; student may start **any** unlocked level |
| Retake same level | Always after complete | New `attemptId`, same `levelId`; passed state never revoked |
| Continue next level | Passed and `levelId < 10` | Start `levelId + 1` |
| Level 10 completed | Passed Level 10 | No "next level"; show completion state; retake Level 10 and LevelSelect still available |
| Leaderboard | Always | Global or per-level filter |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/content/exercises.ts` | Modify | Add `difficulty:1-10` to all 100 records (ids/prompts byte-identical). |
| `src/content/levels.ts` | Create | `LEVEL_SIZE=10`, `PASS_THRESHOLD=9`, `buildLevels()`, `getLevel(id)`. |
| `src/domain/types.ts` | Modify | `Exercise.difficulty`; `LevelId`; `LeaderboardEntry.level`; `SubmitScoreRequest.level`; `AttemptResult.score` 0–10. |
| `src/domain/catalog.ts` | Modify | Missing/out-of-range `difficulty`; each difficulty bucket exactly 10. Keep 100-total + 12/13 topic rules on flat catalog. |
| `src/domain/grading.ts` | Modify | `score = correctCount` (0..N). |
| `src/domain/recommendations.ts` | Modify | Level-scoped: recommend only if topic has ≥2 questions in attempt and miss rate ≥ 40%. |
| `src/domain/leaderboard.ts` | Modify | Global: level desc then score desc then existing ties. Per-level filter: score desc then ties. |
| `src/domain/levelProgress.ts` | Create | Pure: `isUnlocked`, `nextLevel`, `applyPass`, `isPassed`. |
| `src/state/attemptReducer.ts` | Modify | `AttemptData.levelId`; `start` carries `levelId`; `retake` preserves it. |
| `src/state/levelProgressStore.ts` | Create | `useLevelProgress(nameClaimKey)`: load/save/markPassed under per-identity key. |
| `src/App.tsx` | Modify | `Screen += 'level-select'`; land on level-select after claim; grade level exercises; wire Results nav. |
| `src/ui/LevelSelect.tsx` | Create | 10 cards: locked/unlocked/passed; locked shows friendly hint. |
| `src/ui/Results.tsx` | Modify | Level + passed badge; retake; next (if passed & <10); back to levels; Level 10 complete state. |
| `src/ui/ExerciseRunner.tsx` | Modify | Label "Question N of 10" (prop-driven). |
| `src/ui/Leaderboard.tsx` | Modify | Level column + global/per-level toggle; global uses level-aware rank. |
| `src/api/client.ts` | Modify | `submitScore` adds `level`; `getLeaderboard(level?)`. |
| `netlify/functions/_store.ts` | Modify | Integer validate `score` ∈ 0–10 & `level` ∈ 1–10; persist `level`; filter; `isValidEntry` requires `level`. |
| `netlify/functions/submit-score.ts` | Modify | Propagate `level`; reject non-integers / out-of-range. |
| `netlify/functions/get-leaderboard.ts` | Modify | Parse `?level=N`; pass to store. |
| `scripts/reset-leaderboard.mjs` | Create | Selective legacy Blob cleanup (see Migration). |

## Interfaces / Contracts

```ts
export type LevelId = 1|2|3|4|5|6|7|8|9|10;
export interface Exercise { id: string; topic: Topic; prompt: string; acceptedAnswers: string[]; difficulty: number; }
export interface Level { id: LevelId; label: string; exercises: readonly Exercise[]; }
export interface LeaderboardEntry { attemptId: string; name: string; score: number; level: LevelId; timestamp: number; }
export interface LevelProgress { passed: LevelId[]; }
// localStorage key: `english-learning:progress:v1:{nameClaimKey}`
// POST /submit-score { name, score:0-10 integer, level:1-10 integer, attemptId }
//   → reject non-integer / out-of-range score or level (400)
// GET  /get-leaderboard[?level=N] -> LeaderboardEntry[]
// Global rank: level desc, score desc, timestamp asc, normalized name, attemptId
// Per-level rank: score desc, then same ties
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Partition shape/order; unlock+retake+persist per identity; grading 0–10 & pass≥9; catalog difficulty rules; recommendations (≥2 Q topics only); global rank level-aware vs per-level score-only | Vitest, pure functions |
| Unit (rewrite) | Existing `submitScore` / client tests that assume 0–100 scores → 0–10 + required `level` | Update fixtures/assertions |
| Integration | Function integer validation for `score`/`level`; `?level` filter; reject legacy-shaped payloads; client payload | Injected `StoreLike` mock |
| Automated UI/flow | Locked level blocked; progress survives refresh for same identity; second identity does not inherit first's unlocks; Results nav (retake / next / LevelSelect / Level 10 complete); leaderboard filter + global ranking order | Component/integration tests |
| E2E/manual | Reset script dry-run then apply on preview; empty of legacy rows; new rows survive re-run | Manual on preview deploy |

## Migration / Rollout

Chained PRs (<400 lines): PR1 content+difficulty+catalog; PR2 domain/state/UI;
PR3 leaderboard schema+server+ranking; PR4 optional Blob progression mirror.

### Leaderboard reset — safe deploy semantics

- **What:** `scripts/reset-leaderboard.mjs` lists `leaderboard` blobs and **deletes
  only legacy/invalid rows** (missing `level`, non-integer `level`/`score`, or
  `score` outside 0–10). Valid level-aware rows are **never** deleted.
- **Why not full wipe:** A post-deploy full wipe would destroy new 0–10 rows if
  re-run after children submit.
- **Idempotent:** Re-run is a no-op when only valid rows remain.
- **When:** Manually once **before go-live** — cleanup MUST complete before the
  level-aware app starts writing new leaderboard entries (pre-go-live / before
  level-aware schema writes begin). Not a standing cron; not a public endpoint.
- **Env / site context (required):** Netlify site + Blobs credentials for the target
  site, e.g. `NETLIFY_SITE_ID` (or site name) and `NETLIFY_AUTH_TOKEN` (or the
  Blobs store token/context the project already uses for local Blob scripts). Run
  against the **intended** site only (preview vs production explicit).
- **Ops:** Prefer dry-run mode that lists candidates; export/list blobs first for
  rollback; `names` store untouched; legacy rows NOT rescaled.

## Open Questions

- None blocking design. Difficulty 7-category sketch → 10-bucket authoring remains
  a PR1 content review (risk called out above, not claimed solved).
