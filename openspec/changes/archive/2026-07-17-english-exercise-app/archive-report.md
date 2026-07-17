# Archive Report: English Exercise App

**Change**: `english-exercise-app`
**Archived at**: `openspec/changes/archive/2026-07-17-english-exercise-app/`
**Date**: 2026-07-17
**Artifact mode**: OpenSpec
**Archive type**: Full — all artifacts present, all tasks complete, verification PASS

## Task Completion Gate

- [x] All 18 implementation tasks checked (`[x]`) in `tasks.md`
- [x] No stale unchecked implementation tasks
- [x] No CRITICAL or WARNING issues in `verify-report.md`
- [x] Verification verdict: **PASS** — deployed smoke passed for all 7 required behaviors

## Specs Synced to Source of Truth

| Domain | Action | Details |
|--------|--------|---------|
| student-session | Created (new main spec) | 4 requirements, 7 scenarios — name capture, normalized identity, retakes, attempt lifecycle |
| exercise-bank | Created (new main spec) | 5 requirements, 7 scenarios — catalog size, topic coverage, distribution, record shape, accepted answers |
| scoring-feedback | Created (new main spec) | 4 requirements, 8 scenarios — auto-grading, mistake review, topic recommendations, end-of-test summary |
| shared-leaderboard | Created (new main spec) | 5 requirements, 7 scenarios — score submission, ranking, tie-break, multiple attempts, cross-device reads |
| netlify-deployment | Created (new main spec) | 4 requirements, 5 scenarios — static hosting, serverless API, shared persistence, build & test commands |

All 5 delta specs were copied as full specs (no existing main specs to merge into).

## Archive Contents

| Artifact | Status |
|----------|--------|
| `proposal.md` | ✅ |
| `exploration.md` | ✅ |
| `specs/` (5 domains) | ✅ |
| `design.md` | ✅ |
| `tasks.md` | ✅ (18/18 tasks complete) |
| `verify-report.md` | ✅ (PASS, no CRITICAL/WARNING) |
| `apply-progress.md` | ✅ |
| `archive-report.md` | ✅ (this file) |

## Verification Summary

- **Verdict**: PASS
- **Deployed URL**: https://en-learn.netlify.app/
- **Tests**: 148/148 passed (Vitest)
- **Build**: `tsc -b && vite build` — 41 modules, clean output
- **Deployed smoke**: 7/7 behaviors passed (page load, name entry, exercise flow, results, submit, leaderboard, retake/canonical casing)
- **Canonical casing fix**: Confirmed — normalized variant preserves first-claimed display casing

## Source of Truth Updated

The following main specs now reflect the implemented behavior:
- `openspec/specs/student-session/spec.md`
- `openspec/specs/exercise-bank/spec.md`
- `openspec/specs/scoring-feedback/spec.md`
- `openspec/specs/shared-leaderboard/spec.md`
- `openspec/specs/netlify-deployment/spec.md`

## SDD Cycle Complete

The change has been fully planned, explored, specified, designed, implemented, verified, and archived. Ready for the next change.
