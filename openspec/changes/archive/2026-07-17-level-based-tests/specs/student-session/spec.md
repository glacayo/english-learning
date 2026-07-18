# Delta for Student Session

## MODIFIED Requirements

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

## ADDED Requirements

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
