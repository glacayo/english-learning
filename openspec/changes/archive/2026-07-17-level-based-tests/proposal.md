# Proposal: Level-Based Tests

## Intent

Replace the single 100-question test with 10 shorter levels of 10 questions. This reduces child fatigue while preserving the same 100-question catalog, retakes, and shared competition.

## Scope

### In Scope
- Partition the existing 100 exercises into 10 deterministic levels, ordered easiest to hardest by the AI/team's initial judgment.
- Pass a level at 9/10; passing unlocks the next level; retakes remain allowed.
- Store level progression in the same browser for v1.
- Keep leaderboard with global and per-level views.
- Reset old 0-100 leaderboard data as a clean break.

### Out of Scope
- Adding new exercises beyond reorganizing the existing 100.
- Cross-device progression sync.
- Best-score-only leaderboard or migration of legacy leaderboard rows.

## Capabilities

### New Capabilities
- `level-progression`: level unlock state, pass rules, same-browser persistence, and locked/unlocked/passed behavior.

### Modified Capabilities
- `exercise-bank`: same 100 records become 10 validated levels of 10, ordered easiest to hardest.
- `student-session`: attempts start from a selected unlocked level and retake the same level.
- `scoring-feedback`: one level is scored on a 0-10 scale; pass threshold is 9/10; results show level status.
- `shared-leaderboard`: entries include `level`; global and per-level views work; old rows are cleared/reset.
- `netlify-deployment`: function payloads, read filters, and Blob cleanup match the level-aware leaderboard schema.

## Approach

Use the recommended exploration approach: add explicit level partition metadata referencing existing exercise ids; keep catalog validation for 100 records and add level validation. Add pure progression helpers plus localStorage persistence. Grade only the selected level's 10 exercises. Extend leaderboard rows with `level` and support global/per-level reads. Deploy with documented leaderboard cleanup.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/content/*` | Modified/New | Level partition metadata and validation. |
| `src/domain/*`, `src/state/*` | Modified/New | Level progress, scoring scale, attempt level state. |
| `src/App.tsx`, `src/ui/*` | Modified/New | Level select, level-aware results, leaderboard views. |
| `netlify/functions/*` | Modified | Level-aware payload validation, filtering, cleanup plan. |
| `openspec/specs/*` | Modified/New | Delta specs plus new `level-progression` spec. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Initial difficulty order frustrates children | Medium | Keep level table reviewable and adjust after feedback. |
| Leaderboard reset surprises users | Medium | Treat as explicit clean break and document release behavior. |
| Same-browser progress is mistaken for cross-device sync | Medium | State v1 limit clearly; defer sync to follow-up. |

## Rollback Plan

Revert the change branch to the archived flat 100-question flow. Before leaderboard cleanup, export existing Blob data; if rollback follows deployment, redeploy the previous Netlify build and restore or keep the exported legacy leaderboard data.

## Dependencies

- Existing 100-question catalog and current OpenSpec source-of-truth specs.
- User-approved clean leaderboard reset.
- Netlify Blobs access for leaderboard cleanup/deploy.

## Success Criteria

- [ ] Levels 1-10 contain exactly 10 unique questions each, using all 100 once.
- [ ] Score >= 9 unlocks the next level; score < 9 does not; retake works.
- [ ] Progress persists after refresh in the same browser.
- [ ] Global and per-level leaderboards submit/read level-aware rows after reset.
- [ ] OpenSpec specs cover the new and modified capabilities.
