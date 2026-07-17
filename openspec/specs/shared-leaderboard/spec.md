# Shared Leaderboard Specification

## Purpose

Defines how completed attempt scores are submitted, ranked, and read back
as a leaderboard shared across devices.

## Requirements

### Requirement: Score Submission

When an attempt completes, the system MUST submit a leaderboard entry
containing the student name, score, submission timestamp, and a client-generated
`attemptId` used as the idempotency key for the write.

#### Scenario: Successful submission

- GIVEN an attempt just transitioned to `completed` with a stable `attemptId`
- WHEN the score is submitted
- THEN a leaderboard entry `{attemptId, name, score, timestamp}` MUST be persisted
- AND the persistence key MUST be derived from `attemptId`

#### Scenario: Retry after successful write is idempotent

- GIVEN a score submission for `attemptId` A already persisted successfully
- WHEN the client retries the same `{name, score, attemptId: A}` (e.g. after a
  lost response)
- THEN the system MUST NOT create a second leaderboard row for A
- AND the response MUST still indicate success

#### Scenario: Submission failure handled gracefully

- GIVEN the leaderboard store is temporarily unavailable
- WHEN a score submission fails
- THEN the student MUST still see their own results
- AND the system SHOULD retry with the same `attemptId` or clearly indicate the
  leaderboard update failed

### Requirement: Ranking

The system MUST rank leaderboard entries by score in descending order.

#### Scenario: Higher score ranks above lower score

- GIVEN entries with scores 90 and 70
- WHEN the leaderboard is rendered
- THEN the 90-score entry MUST appear above the 70-score entry

### Requirement: Deterministic Tie-Break

When scores are equal, the system MUST break ties deterministically in this
order: earlier `timestamp` ranks first; if timestamps are equal, lower
normalized name ranks first; if still equal, lower `attemptId` ranks first.

#### Scenario: Tie resolved by earlier submission

- GIVEN two entries both scoring 85, one submitted at 10:00 and one at 10:05
- WHEN the leaderboard is rendered
- THEN the 10:00 entry MUST rank above the 10:05 entry

#### Scenario: Equal score and timestamp resolved by name then attemptId

- GIVEN two entries both scoring 85 with the same timestamp
- WHEN the leaderboard is rendered
- THEN the entry with the lower normalized name ranks first
- AND if normalized names are also equal, the entry with the lower `attemptId`
  ranks first

### Requirement: Multiple Attempts Per Display Name

The leaderboard MUST list **every submitted attempt** as its own row. The same
display name MAY appear more than once when a student retakes. v1 does **not**
collapse to best-score-only; ranking applies to attempt rows, not to unique names.

#### Scenario: Retake adds a second row for the same name

- GIVEN "Maria" already has a leaderboard row for `attemptId` A with score 70
- WHEN "Maria" completes a retake with `attemptId` B and score 90
- THEN the leaderboard MUST include both rows (A and B)
- AND MUST NOT replace or hide the earlier attempt

### Requirement: Cross-Device Reads

The system MUST make the leaderboard readable from any device, reflecting
all previously submitted scores regardless of which device submitted them.

#### Scenario: Score visible from a different device

- GIVEN a score submitted from device A
- WHEN device B loads the leaderboard
- THEN device B's leaderboard MUST include the score submitted from device A
