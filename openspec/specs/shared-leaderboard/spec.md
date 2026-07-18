# Shared Leaderboard Specification

## Purpose

Defines how completed attempt scores are submitted, ranked, and read back
as a leaderboard shared across devices.

## Requirements

### Requirement: Score Submission

When an attempt completes, the system MUST submit a leaderboard entry
containing the student name, score (0-10), level, submission timestamp, and
a client-generated `attemptId` used as the idempotency key for the write.
(Previously: entry had no `level` field and score was on a 0-100 scale.)

#### Scenario: Successful submission

- GIVEN an attempt just transitioned to `completed` with a stable `attemptId`
- WHEN the score is submitted
- THEN a leaderboard entry `{attemptId, name, score, level, timestamp}` MUST
  be persisted
- AND the persistence key MUST be derived from `attemptId`

#### Scenario: Retry after successful write is idempotent

- GIVEN a score submission for `attemptId` A already persisted successfully
- WHEN the client retries the same `{name, score, level, attemptId: A}` (e.g.
  after a lost response)
- THEN the system MUST NOT create a second leaderboard row for A
- AND the response MUST still indicate success

#### Scenario: Submission failure handled gracefully

- GIVEN the leaderboard store is temporarily unavailable
- WHEN a score submission fails
- THEN the student MUST still see their own results
- AND the system SHOULD retry with the same `attemptId` or clearly indicate
  the leaderboard update failed

### Requirement: Ranking

The system MUST rank leaderboard entries on the 0-10 score scale with
view-specific primary keys:
- **Global view:** `level` desc → `score` desc → `timestamp` asc →
  normalized name asc → `attemptId` asc
- **Per-level view:** `score` desc → `timestamp` asc → normalized name asc →
  `attemptId` asc
(Previously: score-only ranking on a 0-100 scale, no level-aware global order.)

#### Scenario: Higher level ranks above lower level in global view

- GIVEN a Level 10 entry with score 7 and a Level 1 entry with score 10
- WHEN the global leaderboard is rendered
- THEN the Level 10 entry MUST rank above the Level 1 entry

#### Scenario: Higher score ranks above lower score within a level

- GIVEN two entries for the same level with scores 10 and 9
- WHEN the leaderboard is rendered (global or per-level for that level)
- THEN the 10-score entry MUST appear above the 9-score entry

### Requirement: Deterministic Tie-Break

When entries share the same primary ranking keys for the active view (global:
same `level` and `score`; per-level: same `score`), the system MUST break ties
deterministically in this order: earlier `timestamp` ranks first; if timestamps
are equal, lower normalized name ranks first; if still equal, lower `attemptId`
ranks first.
(Previously: example used a 0-100 scale; no level-aware primary keys.)

#### Scenario: Tie resolved by earlier submission

- GIVEN two entries both scoring 8 at the same level, one submitted at 10:00
  and one at 10:05
- WHEN the leaderboard is rendered
- THEN the 10:00 entry MUST rank above the 10:05 entry

#### Scenario: Equal score and timestamp resolved by name then attemptId

- GIVEN two entries both scoring 8 at the same level with the same timestamp
- WHEN the leaderboard is rendered
- THEN the entry with the lower normalized name ranks first
- AND if normalized names are also equal, the entry with the lower
  `attemptId` ranks first

### Requirement: One Best Row Per Normalized Student Name

The leaderboard active view MUST display **one row per normalized student
name**, keeping the attempt that ranks best under the active ranking keys.
Retakes still persist as separate attempt rows (write path is unchanged and
idempotent by `attemptId`), but duplicate names MUST collapse in the read/view
path so only the best-ranked row remains visible.

- **Global view:** one row per normalized name overall; keep the row that ranks
  best by global ranking (`level` desc → `score` desc → `timestamp` asc →
  normalized name → `attemptId`).
- **Per-level view:** one row per normalized name within that level; keep the
  row that ranks best by per-level ranking (`score` desc → `timestamp` asc →
  normalized name → `attemptId`).

#### Scenario: Retake keeps only the best row for the same name

- GIVEN "Ximena" already has a leaderboard row for `attemptId` A with score 5
- WHEN "Ximena" completes a retake with `attemptId` B and score 9
- THEN both rows MAY remain persisted under their own `attemptId` keys
- AND the leaderboard active view MUST show only the best-ranked row (B, score 9)
- AND MUST NOT show both A and B as separate visible leaderboard rows

#### Scenario: Case and whitespace variants collapse to one visible name

- GIVEN persisted rows for `"Ximena"` (score 5) and `"ximena "` (score 9)
- WHEN the leaderboard is rendered
- THEN only one visible row remains for normalized name `"ximena"`
- AND that row MUST be the better-ranked attempt (score 9)

### Requirement: Cross-Device Reads

The system MUST make the leaderboard readable from any device, reflecting
all previously submitted scores regardless of which device submitted them.

#### Scenario: Score visible from a different device

- GIVEN a score submitted from device A
- WHEN device B loads the leaderboard
- THEN device B's leaderboard MUST include the score submitted from device A

### Requirement: Level-Aware Leaderboard Views

The system MUST support a global leaderboard view (all levels, all rows) and
a per-level leaderboard view (rows filtered to one `level`). The global view
is the default.

#### Scenario: Global view shows entries across all levels

- GIVEN entries exist for Levels 2, 5, and 9
- WHEN the leaderboard loads with no level filter
- THEN entries from all three levels MUST appear, ranked together

#### Scenario: Per-level view shows only the selected level

- GIVEN entries exist for Levels 2 and 5
- WHEN the leaderboard is filtered to Level 5
- THEN only Level 5 entries MUST appear

### Requirement: Leaderboard Reset On Deploy

As part of deploying this change, the system MUST clear pre-existing
leaderboard entries recorded under the old 0-100 scale (no `level` field).
This is a one-time, irreversible clean break; legacy rows MUST NOT be
migrated, rescaled, or displayed after the reset.

#### Scenario: Legacy rows absent after deploy

- GIVEN leaderboard entries existed under the old 0-100 scale before deploy
- WHEN this change is deployed
- THEN the leaderboard store MUST contain no pre-reset legacy entries
- AND only new level-aware entries (0-10 scale with `level`) appear going
  forward
