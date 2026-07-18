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
outside the `in-progress` state. Each attempt is scoped to a single level's
10 exercises; `completed` is reached after the level's 10th answer.
(Previously: attempt total was the full 100-exercise catalog.)

#### Scenario: Answers accepted only while in progress

- GIVEN an attempt in the `in-progress` state
- WHEN the student submits an answer to an exercise
- THEN the answer MUST be recorded against that attempt

#### Scenario: Attempt completes after the level's last exercise

- GIVEN an attempt in the `in-progress` state with 9 of the selected level's
  10 exercises answered
- WHEN the student submits the 10th answer
- THEN the attempt state MUST transition to `completed`
- AND further answer submissions for that attempt MUST be rejected

### Requirement: Attempt Bound to a Level

Every attempt MUST be started against a specific unlocked level and graded
using only that level's 10 exercises. A retake MUST target the same level as
the attempt being retaken; the student MAY separately start a different
unlocked level.

#### Scenario: Starting an attempt requires selecting an unlocked level

- GIVEN a student on the level-select screen with Levels 1-3 unlocked
- WHEN the student selects Level 2
- THEN a new attempt MUST start bound to Level 2's 10 exercises

#### Scenario: Retake targets the same level

- GIVEN a completed attempt for Level 2
- WHEN the student chooses "try again" from the results screen
- THEN a new attempt MUST start bound to Level 2 with a new `attemptId`

### Requirement: Refresh-Safe In-Progress Drafts

The system MUST persist in-progress attempts on the same device (localStorage)
keyed by normalized name identity (`nameClaimKey`) and level so a browser
refresh does not discard mid-level answers. This is same-device recovery only;
it MUST NOT use cookies, auth, or cross-device sync.

A valid draft MUST include enough state to resume: display name, nameClaimKey,
attemptId, levelId, answers, total, and current exercise index. The loader MUST
defensively ignore stale, corrupt, version-mismatched, catalog-incompatible, or
identity-inconsistent drafts (including cases where the stored display name does
not normalize to the draft's `nameClaimKey` / storage key) instead of crashing.
Completing, retaking, or otherwise restarting an attempt for that name+level
MUST clear the draft so the next start is fresh.

#### Boundary: name-only identity (not authentication or privacy)

Same-device draft restore is a **convenience feature** for refresh recovery under
the product's explicit name-only identity model. It is **not** an authentication
boundary and **not** a privacy boundary. Drafts are scoped only by normalized
display name + level on that browser: any person on a shared device who enters
the same normalized name can restore that name's in-progress draft. v1 does not
add PIN, password, or other auth for drafts.

#### Scenario: Mid-level refresh resumes the same attempt

- GIVEN "Maria" started Level 1 and answered some exercises
- AND the browser refreshes (session memory is cleared)
- WHEN "Maria" (same normalized name) claims the name again and selects Level 1
- THEN the system MUST restore the prior in-progress attempt
- AND MUST keep the same `attemptId`, recorded answers, and current exercise index
- AND MUST show the exercise runner in progress (not question 1 with empty answers)

#### Scenario: Different names do not share drafts

- GIVEN "Maria" has an in-progress Level 1 draft on the device
- WHEN "Marco" claims a name and selects Level 1
- THEN the system MUST start a fresh attempt for Marco
- AND MUST NOT load Maria's answers or attemptId

#### Scenario: Same normalized name on a shared device can restore the draft

- GIVEN "Maria" has an in-progress Level 1 draft on a shared device
- WHEN another person types the same normalized name (e.g. "maria" / "MARIA") and selects Level 1
- THEN the system MUST restore that draft (by design for name-only identity)
- AND this MUST NOT be treated as proof of identity or a privacy guarantee

#### Scenario: Completed or retaken attempts do not restore old drafts

- GIVEN "Maria" completed (or retakes) Level 1
- WHEN "Maria" later starts Level 1 again
- THEN the system MUST start a fresh attempt with a new `attemptId`
- AND MUST NOT restore the previous answers or exercise index
