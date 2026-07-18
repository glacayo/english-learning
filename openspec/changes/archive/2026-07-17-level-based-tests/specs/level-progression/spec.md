# Level Progression Specification

## Purpose

Defines how the 100-exercise catalog splits into 10 ordered levels, how a
student unlocks and passes levels, and how progression persists per browser.

## Requirements

### Requirement: Level Catalog Partition

The system MUST partition the 100-exercise catalog into exactly 10 levels of
10 exercises each, using all 100 exercises exactly once, ordered from Level 1
(easiest) to Level 10 (hardest) by each exercise's `difficulty` value.

#### Scenario: Ten levels of ten questions built from the full catalog

- GIVEN the 100-exercise catalog
- WHEN the level partition is built
- THEN there are exactly 10 levels, each with exactly 10 unique exercises
- AND every catalog exercise belongs to exactly one level

#### Scenario: Levels ordered easiest to hardest

- GIVEN the level partition
- WHEN levels are compared by their exercises' `difficulty` values
- THEN Level 1 MUST contain the lowest-difficulty exercises and Level 10 the
  highest, ascending across levels 1 through 10

### Requirement: Level Unlock State

The system MUST start every student with only Level 1 unlocked. A level
unlocks when the immediately preceding level has been passed at least once.

#### Scenario: Fresh student sees only Level 1 unlocked

- GIVEN a student with no prior attempts in this browser
- WHEN the level-select screen loads
- THEN Level 1 is unlocked and Levels 2-10 are locked

#### Scenario: Locked level cannot be started

- GIVEN Level 3 is locked for a student
- WHEN the student attempts to start Level 3
- THEN the system MUST block the start with a friendly hint to pass the
  previous level first

### Requirement: Passing Threshold

The system MUST require a score of at least 9 out of 10 (90%) on a level's
10 exercises for that level to be marked passed.

#### Scenario: Nine or more correct answers passes the level

- GIVEN a student completes Level 4 with 9 correct answers out of 10
- WHEN the attempt is graded
- THEN Level 4 MUST be marked passed and Level 5 MUST become unlocked

#### Scenario: Fewer than nine correct answers does not pass

- GIVEN a student completes Level 4 with 8 correct answers out of 10
- WHEN the attempt is graded
- THEN Level 4 MUST remain not-passed and Level 5 MUST remain locked

### Requirement: Retake Allowed

The system MUST allow a student to retake any unlocked level, passed or not,
any number of times.

#### Scenario: Retaking a passed level

- GIVEN Level 2 is already passed
- WHEN the student starts Level 2 again
- THEN a new attempt MUST start scoped to Level 2's 10 exercises
- AND the existing passed/unlocked state MUST NOT be revoked regardless of
  the retake's outcome

### Requirement: Same-Browser Progression Persistence

The system MUST persist each level's unlocked/passed state in the student's
browser (local storage) so progress survives a page refresh. Progression is
scoped to one browser and is NOT synced across devices in v1.

#### Scenario: Progress survives a refresh

- GIVEN a student has passed Levels 1-3 in this browser
- WHEN the page is reloaded
- THEN Levels 1-4 MUST still show as unlocked, with 1-3 passed

#### Scenario: Progress does not follow to a new device

- GIVEN a student passed Levels 1-3 on Device A
- WHEN the student opens the app on Device B
- THEN Device B MUST show only Level 1 unlocked

### Requirement: Continue Progression Later

The system MUST NOT force a student to advance immediately after passing a
level. The student MAY continue to the next level, retake the same level, or
leave and return later, in any order.

#### Scenario: Passing does not force navigation

- GIVEN a student just passed Level 5
- WHEN the results screen renders
- THEN the student MUST be able to choose "next level," "retake," or leave
  without being auto-navigated
