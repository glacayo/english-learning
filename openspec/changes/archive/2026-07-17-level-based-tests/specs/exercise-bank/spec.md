# Delta for Exercise Bank

## MODIFIED Requirements

### Requirement: Exercise Record Shape

Each exercise record MUST have a unique `id`, a `topic` from the approved
set, a non-empty `prompt`, a non-empty `acceptedAnswers` list, and a
`difficulty` value in the range 1-10 used to build the level partition.
(Previously: record shape had no `difficulty` field.)

#### Scenario: Unique ids enforced

- GIVEN the exercise catalog
- WHEN ids are compared across all 100 records
- THEN no two records share the same `id`

#### Scenario: Missing accepted answers rejected

- GIVEN an exercise record
- WHEN `acceptedAnswers` is empty or missing
- THEN catalog validation MUST fail

#### Scenario: Missing or out-of-range difficulty rejected

- GIVEN an exercise record
- WHEN `difficulty` is missing or outside 1-10
- THEN catalog validation MUST fail with a clear difficulty error

## ADDED Requirements

### Requirement: Level Partition

The system MUST partition the 100-record catalog into exactly 10 levels of
10 records each, using each exercise's `difficulty` to order levels from
easiest (Level 1) to hardest (Level 10). The flat catalog's topic-count rule
(12 or 13 per topic) applies to the full 100-record catalog only, not to
per-level topic distribution.

#### Scenario: Levels validated at build time

- GIVEN the exercise catalog and its `difficulty` values
- WHEN the level partition is built
- THEN each level MUST contain exactly 10 unique exercise ids
- AND all 100 ids MUST be used exactly once across the 10 levels

#### Scenario: Level partition does not change catalog size

- GIVEN the level partition is built from the 100-record catalog
- WHEN the flat catalog's size and topic-distribution rules are checked
- THEN they MUST still pass independently of the level partition
