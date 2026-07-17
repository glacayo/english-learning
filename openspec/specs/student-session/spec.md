# Student Session Specification

## Purpose

Defines how a child's name is captured and validated, and how a test attempt
moves through its lifecycle from start to completion.

## Requirements

### Requirement: Name Capture

The system MUST require a non-empty student name before a test attempt can
start.

#### Scenario: Valid name starts a session

- GIVEN a child on the name entry screen
- WHEN they type a non-empty name and confirm
- THEN a new attempt session starts for that name

#### Scenario: Empty name blocked with friendly guidance

- GIVEN a child on the name entry screen
- WHEN they submit an empty or whitespace-only name
- THEN the system MUST block the start
- AND show a friendly, non-hostile message asking them to type a name

### Requirement: Normalized Name Identity

The system MUST normalize display names with trim + case-fold to form a stable
identity key. One normalized key identifies one classroom student identity
(so "Maria", "maria ", and "MARIA" are the same identity). Distinct kids SHOULD
use distinct display names (e.g. a last initial) to avoid sharing an identity.

#### Scenario: Case and whitespace collapse to the same identity

- GIVEN a student named "Maria" has already claimed their name
- WHEN another start uses "maria " (trailing space, different case)
- THEN the system MUST treat it as the same student identity
- AND MUST allow a new attempt to start (retake)

#### Scenario: Distinct name accepted as a different identity

- GIVEN existing student "Maria"
- WHEN a new attempt starts with the name "Marco"
- THEN the system MUST accept it as a distinct student identity

### Requirement: Retakes With Same Display Name

The system MUST allow a returning student to start another attempt using the
same display name. Each attempt MUST receive a new client-generated
`attemptId`. Claimed-name reservation MUST NOT block retakes in v1.

#### Scenario: Returning student starts a second attempt

- GIVEN "Maria" completed an attempt with `attemptId` A
- WHEN "Maria" (same normalized name) starts again
- THEN a new attempt MUST start with a new `attemptId` B (B ≠ A)
- AND both attempts remain independent for scoring and leaderboard submission

### Requirement: Attempt Lifecycle

The system MUST track each attempt through the states `not-started` →
`in-progress` → `completed`, and MUST NOT allow a student to submit answers
outside the `in-progress` state.

#### Scenario: Answers accepted only while in progress

- GIVEN an attempt in the `in-progress` state
- WHEN the student submits an answer to an exercise
- THEN the answer MUST be recorded against that attempt

#### Scenario: Attempt completes after last exercise

- GIVEN an attempt in the `in-progress` state with 99 of 100 exercises answered
- WHEN the student submits the 100th answer
- THEN the attempt state MUST transition to `completed`
- AND further answer submissions for that attempt MUST be rejected
