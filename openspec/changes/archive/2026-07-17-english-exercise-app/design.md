# Design: English Exercise App

## Technical Approach

A Vite + React + TypeScript SPA where all interesting logic (grading,
recommendations, ranking, catalog validation) lives in **pure domain modules**
tested by Vitest. The client grades attempts locally against the bundled
100-exercise catalog; the server owns only *shared* state — student-name
uniqueness and the leaderboard — behind three Netlify Functions backed by
Netlify Blobs. This keeps the trustworthy logic unit-tested and framework-free,
and isolates persistence behind an HTTP contract so it can move to Postgres
later without touching the UI (proposal approach; specs: all five capabilities).

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|----------|--------|-----------------------|-----------|
| Where grading runs | Client-side, catalog bundled | Server-side grading | Practice app, not an exam; hiding answers adds no value and forces shipping answers to the server. Keeps functions thin. |
| Domain isolation | Pure modules in `src/domain/`, no React/DOM imports | Logic inside components | Enables fast Vitest coverage of scoring/recommend/rank per `netlify-deployment` test rule. |
| Persistence | Netlify Blobs behind function API | localStorage; direct Postgres now | Blobs satisfy cross-device reads with zero infra; API boundary preserves the migration path (proposal R1). |
| Name identity + retakes | Atomic claim via `claim-name` on normalized key; claimed name may start unlimited retakes, each with a new `attemptId` | Block retakes on claimed names; auth/PIN | Uniqueness = one classroom identity per normalized display name (no two *different* kids should share a key); v1 permits same-name retakes without auth (`student-session` spec). |
| Leaderboard storage | One blob per submission entry; list + read + sort server-side | Append/mutate a single shared blob | Netlify Blobs has no atomic multi-writer append; per-entry blobs avoid lost updates under classroom concurrency. |
| App state | Single `attempt` reducer + React Context | Redux/Zustand | Scope is one linear attempt; a reducer models `not-started → in-progress → completed` cleanly. |
| Catalog format | Typed `.ts` array validated by a pure `validateCatalog` | JSON + ad-hoc checks | Compile-time typing + a test that enforces count, 8 topics, unique ids, and 12-or-13 per topic (`exercise-bank` spec). |
| Score write key | Blob key = client `attemptId` (create-if-absent) | Timestamp-uuid only | Retries after a successful write must not create duplicate leaderboard rows. |

## Data Flow

```
NameEntry ──POST /claim-name──▶ [names store]  (ensure identity key → start attempt)
    │
ExerciseRunner ──gradeAttempt() (local, pure)──▶ Results
    │                                                │
    └─ score/mistakes/recommendTopics() (local) ─────┤
                                                      │
Results ──POST /submit-score──▶ [entry blob per attempt]
Leaderboard ◀─GET /get-leaderboard── list/read/sort ─┘  (any device; all attempts)
```

**Name claim + retakes (v1):** client POSTs `{name}` → server normalizes to a stable identity key (trim + case-fold) → `set(key, {displayName, claimedAt}, { onlyIfNew: true })` (or equivalent). **First claim** creates the reservation; **already claimed** still returns success so the same display name can start another attempt (retake). Invalid/empty names are rejected client-side (and defensively server-side). No auth/PIN: one normalized key = one classroom identity; distinct kids should use distinct display names (e.g. last initial). Each successful start generates a **new** `attemptId` (UUID).

**Submit sequence:** client generates one `attemptId` when the attempt starts → on `completed`, `submit-score` POSTs `{name, score, attemptId}` → server stamps `timestamp`, writes entry blob `{attemptId, name, score, timestamp}` with **blob key = `attemptId`** using create-if-absent. Same `attemptId` retry → `{ok:true}` without a second row. **A retake uses a different `attemptId`**, so it creates a **new** leaderboard row; the board lists **every attempt** (multiple rows may share a display name — not best-only). `get-leaderboard` lists entries, ranks via pure `rankEntries` (desc score → asc timestamp → asc normalized name → asc `attemptId`). On transport failure the student still sees local results; retry with the same `attemptId` is safe.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json`, `package-lock.json` | Create | Deps + `dev`/`build`/`test` scripts |
| `netlify.toml` | Create | Build cmd, publish `dist/`, functions dir |
| `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `index.html` | Create | Toolchain + entry |
| `src/main.tsx`, `src/App.tsx` | Create | Bootstrap + screen routing |
| `src/domain/types.ts` | Create | Shared types (below) |
| `src/content/topics.ts` | Create | 8-topic enum + labels |
| `src/content/exercises.ts` | Create | 100 exercise records (source of truth) |
| `src/domain/catalog.ts` | Create | `validateCatalog()` |
| `src/domain/grading.ts` | Create | `gradeAnswer`, `gradeAttempt` |
| `src/domain/recommendations.ts` | Create | `recommendTopics` |
| `src/domain/leaderboard.ts` | Create | `rankEntries` (pure sort/tie-break) |
| `src/state/attemptReducer.ts` | Create | Lifecycle state machine |
| `src/api/client.ts` | Create | Typed fetch wrappers |
| `src/ui/{NameEntry,ExerciseRunner,Results,Leaderboard}.tsx` | Create | Screens |
| `netlify/functions/_store.ts` | Create | Blobs helpers: name claim (`onlyIfNew`), attemptId-keyed entry write (`onlyIfNew`), list/read entries |
| `netlify/functions/{claim-name,submit-score,get-leaderboard}.ts` | Create | Serverless API |
| `src/domain/__tests__/*.test.ts` | Create | Unit tests |

## Interfaces / Contracts

```ts
type Topic = 'present-simple' | 'simple-past' | 'present-progressive'
  | 'simple-past-3rd' | 'present-simple-3rd' | 'present-progressive-3rd'
  | 'daily-routine' | 'like-dislike';

interface Exercise { id: string; topic: Topic; prompt: string; acceptedAnswers: string[]; }
type AttemptState = 'not-started' | 'in-progress' | 'completed';
interface Answer { exerciseId: string; topic: Topic; given: string; correct: boolean; }
interface AttemptResult { score: number; mistakes: Answer[]; recommendations: Topic[]; }
interface LeaderboardEntry {
  attemptId: string;
  name: string;
  score: number;
  timestamp: number;
}
```

API contracts:

- `POST /claim-name {name} → {ok:true, name}` for a valid non-empty name whether the normalized key is new or already claimed (retake allowed). Display name returned trimmed; identity key is normalized (trim + case-fold). Empty/whitespace-only → `{ok:false, reason:'invalid'}`.
- `POST /submit-score {name, score, attemptId} → {ok:boolean}` — server stamps `timestamp`, writes entry blob keyed by `attemptId` with create-if-absent. Same `attemptId` retry returns success without a second row; a **new** `attemptId` (retake) creates a new row.
- `GET /get-leaderboard → LeaderboardEntry[]` — list **all** attempt entries (multiple rows per display name allowed), rank (desc score → asc timestamp → asc normalized name → asc `attemptId`).

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `validateCatalog` (count=100, 8 topics, unique ids, each topic 12 or 13, sum 100, non-empty answers), `gradeAnswer` (trim + case-fold), `recommendTopics` (≥40%, top 3), `rankEntries` (score → timestamp → name → attemptId; multi-attempt same name), `attemptReducer` | Vitest, pure functions |
| Integration | Function handlers with mocked `_store` (first claim + returning retake, per-entry write, idempotent submit on same `attemptId`, new `attemptId` adds row, list/rank) | Vitest |
| E2E | Manual smoke on Netlify deploy preview | No runner (child UI stays visual) |

## Migration / Rollout

No data migration (greenfield). Deliver as chained PRs under the 400-line budget: (1) toolchain + types + catalog + domain tests, (2) UI screens, (3) Netlify functions + Blobs + deploy config. Netlify Blobs auto-provision per site; only `NETLIFY_*` context needed. Rollback = remove app files/functions (returns to OpenSpec-only state).

## Open Questions

None.
