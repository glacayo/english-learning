# Proposal: English Exercise App

## Intent

Build a child-friendly English practice app with 100 balanced exercises, automatic grading, targeted feedback, and a shared cross-device leaderboard. This also selects the greenfield Netlify stack.

## Scope

### In Scope
- Vite + React + TypeScript app foundation with Vitest.
- Fixed 100-exercise bank across the approved topics.
- Student name entry with case-insensitive uniqueness.
- End-of-test score from 0–100 with mistakes and study recommendations.
- Shared leaderboard via Netlify Functions + Netlify Blobs.

### Out of Scope
- Teacher/admin accounts, auth, PINs, or classroom management.
- Dynamic exercise authoring UI.
- Relational database migration unless persistence limits are hit.

## Capabilities

### New Capabilities
- `exercise-bank`: Fixed catalog, topic metadata, balanced distribution, accepted answers.
- `student-session`: Name capture, normalized uniqueness, attempt lifecycle.
- `scoring-feedback`: Auto-grading, mistake review, per-topic recommendations.
- `shared-leaderboard`: Score submission, ranking, tie-breaks, cross-device reads.
- `netlify-deployment`: Static frontend, serverless API, shared persistence, build/test commands.

### Modified Capabilities
None.

## Approach

Use Vite + React + TypeScript for a small child-friendly SPA. Keep exercises, grading, recommendations, and ranking in pure modules tested by Vitest. Deploy on Netlify. Use Netlify Functions for submit/read endpoints and Netlify Blobs for shared student-name and leaderboard persistence, avoiding localStorage-only v1 while keeping one Netlify-centered deployment. If stronger uniqueness, audit history, or high concurrency is needed, move persistence behind the same API contract to Postgres.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json`, lockfile | New | App, test, build, Netlify scripts. |
| `src/content/` | New | 100 exercise records. |
| `src/scoring/` | New | Grading and recommendations. |
| `src/ui/` | New | Name, exercise, results, leaderboard screens. |
| `netlify/functions/` | New | Leaderboard and unique-name API. |
| `tests/` | New | Unit tests for core rules. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Blob writes are not ideal for high-concurrency ranking | Med | Keep API boundary; migrate persistence if conflicts appear. |
| Exercise content errors break grading trust | Med | Validate IDs, topics, answers, and total count in tests. |
| Children mistype names | Med | Normalize names and show friendly duplicate-name guidance. |

## Rollback Plan

Remove app files, Netlify functions, and Blob stores. Since no app exists yet, rollback returns to OpenSpec-only state.

## Dependencies

- Netlify site with Functions and Blobs.
- Node.js toolchain, Vite, React, TypeScript, Vitest, `@netlify/functions`, `@netlify/blobs`.

## Success Criteria

- [ ] 100 exercises are balanced across the 8 approved topics.
- [ ] Students can complete the test and receive score, mistakes, and study topics.
- [ ] Names are unique enough to avoid classroom confusion.
- [ ] Leaderboard is visible across devices after Netlify deployment.
- [ ] Core scoring/recommendation/ranking rules have unit tests.
