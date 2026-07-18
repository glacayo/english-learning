# Archive Report: level-based-tests

**Archived**: 2026-07-17
**Artifact mode**: OpenSpec
**Verdict**: PASS WITH WARNINGS — intentional-with-warnings

## Task Completion Gate

- Total tasks: 17
- Completed: 17 (all `[x]`)
- Stale unchecked tasks: none
- Gate: ✅ PASS

## Verify Report Gate

- CRITICAL issues: none
- WARNING issues: 2 (external/manual pre-go-live only)
  - Preview reset `--apply` not executed (requires safe non-production credentials)
  - Deployed Netlify endpoint smoke not exercised (no local server or deploy preview started)
- Verdict: PASS WITH WARNINGS
- Gate: ✅ PASS (no CRITICAL issues)

## Post-Archive 4R Review Fix

A fresh 4R review identified six actionable blockers after archiving. All were addressed:

| Blocker | Resolution |
|---|---|
| 1. Vitest `allowOnly` guard | `vitest.config.ts` — `allowOnly: false` + guard test |
| 2. UI flow behavior tests | `src/ui/__tests__/uiFlow.test.tsx` — 25 tests via `react-dom/server` |
| 3. Reset rollback artifact | `writeRollbackSnapshot()` — timestamped JSON before deletion |
| 4. Wrong-target reset gate | `--confirm-site-id=<id>` via `verifyTargetConfirm()` |
| 5. Serverless error reporting | `netlify/functions/report-error.ts` — structured, safe, optional endpoint |
| 6. Progression authorization | Adjudicated: same-browser/local only by design; documented as known non-security boundary |

**Post-fix verification**: typecheck PASS, test PASS (24 files, 348 tests), build PASS, self-test PASS (9+6 checks), apply guard blocks correctly.

Follow-up readability/reliability blockers were also resolved after the interrupted fixer run: UI callback wiring is now interaction-tested without new dependencies, reset classification is shared between the function store and reset script, Netlify handlers share JSON/error-reporting boilerplate, client JSON requests share one helper, level filter options derive from `LEVEL_COUNT`, and the constant-false Results navigation helper was removed.

### Known Non-Security Boundary

Level progression (unlock/pass state) is intentionally client-side/localStorage only and NOT server-authenticated. The API does not claim to authorize or verify progression integrity. Adding server-side auth would require a new auth system not in the current architecture. This is a deliberate v1 design tradeoff documented in `design.md` "Progression store".

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| exercise-bank | Updated | MODIFIED: Exercise Record Shape (added `difficulty` field, missing/out-of-range validation scenarios); ADDED: Level Partition requirement with build-time validation scenarios |
| student-session | Updated | MODIFIED: Attempt Lifecycle (scoped to 10 exercises per level, 10th answer completes); ADDED: Attempt Bound to a Level requirement with level-select and retake scenarios |
| scoring-feedback | Updated | MODIFIED: Auto-Grading (0-10 scale, skipped=incorrect), Topic Recommendation (min sample 2, 40% threshold), End-of-Test Summary (level + pass/fail); ADDED: Level Pass Threshold requirement |
| level-progression | Created | New main spec — full level partition, unlock state, passing threshold, retake, persistence, continue-later requirements |
| shared-leaderboard | Updated | MODIFIED: Score Submission (added `level` field, 0-10 scale), Ranking (level desc → score desc global, score-first per-level), Tie-Break (level-aware primary keys); ADDED: Level-Aware Leaderboard Views, Leaderboard Reset On Deploy |
| netlify-deployment | Updated | MODIFIED: Serverless API (integer score 0-10, level 1-10, `?level=N` filter, non-integer rejection); ADDED: Leaderboard Blob Cleanup On Deploy |

## Archive Contents

- proposal.md ✅
- exploration.md ✅
- specs/ (6 domain specs) ✅
- design.md ✅
- tasks.md ✅ (17/17 tasks complete)
- verify-report.md ✅
- archive-report.md ✅

## Intentional Warnings

This archive is marked **intentional-with-warnings**. The two WARNING-level items from verification are external manual pre-go-live steps that were intentionally not executed during verification:

1. **Preview reset `--apply`**: Requires safe non-production Netlify credentials. Not executed because no safe preview target was available and destructive `--apply` against production is forbidden.
2. **Deployed endpoint smoke**: Requires a live deployed environment. Not executed because no local server or deploy preview was started.

These are documented, non-blocking, and do not affect the internal correctness of the implementation. All 42/47 spec scenarios are fully automated-compliant; the remaining 5 are deployment/reset checks that must be run manually before go-live.

## Source of Truth Updated

The following main specs now reflect the new behavior:
- `openspec/specs/exercise-bank/spec.md`
- `openspec/specs/student-session/spec.md`
- `openspec/specs/scoring-feedback/spec.md`
- `openspec/specs/level-progression/spec.md`
- `openspec/specs/shared-leaderboard/spec.md`
- `openspec/specs/netlify-deployment/spec.md`

## SDD Cycle Complete

The change has been fully planned, explored, specified, designed, implemented, verified, and archived. Ready for the next change.
