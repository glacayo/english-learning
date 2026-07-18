# Exercise Bank Specification

## Purpose

Defines the fixed catalog of 100 English exercises used by the app: topic
coverage, balanced per-topic distribution, record shape, and the
accepted-answer contract that grading and recommendations rely on.

## Requirements

### Requirement: Catalog Size

The system MUST ship a fixed catalog of exactly 100 exercise records.

#### Scenario: Catalog loads with full count

- GIVEN the app starts
- WHEN the exercise catalog is loaded
- THEN the catalog contains exactly 100 exercise records

#### Scenario: Catalog fails validation on wrong count

- GIVEN the exercise catalog source file
- WHEN the catalog does not total exactly 100 records
- THEN the build/test validation MUST fail with a clear count mismatch error

### Requirement: Topic Coverage

The system MUST cover exactly the 8 approved topics (present simple, simple
past, present progressive, simple past 3rd person, present simple 3rd person,
present progressive 3rd person, daily routine, like/don't like).

#### Scenario: All approved topics represented

- GIVEN the exercise catalog
- WHEN topics are enumerated
- THEN all 8 approved topics are present and no unapproved topic exists

### Requirement: Balanced Topic Distribution

The catalog of 100 exercises MUST be balanced across the 8 approved topics:
each topic MUST have either 12 or 13 exercises, and the counts MUST sum to
exactly 100 (four topics with 13 and four with 12, in any assignment).

#### Scenario: Each topic has 12 or 13 exercises

- GIVEN the exercise catalog of 100 records
- WHEN exercises are counted per approved topic
- THEN every approved topic has either 12 or 13 exercises
- AND the eight per-topic counts sum to 100

#### Scenario: Unbalanced topic distribution rejected

- GIVEN the exercise catalog source file
- WHEN any approved topic has fewer than 12 or more than 13 exercises
- THEN catalog validation MUST fail with a clear distribution error

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

### Requirement: Accepted Answers

The system SHOULD support multiple accepted answers per exercise (e.g.
contractions or synonyms) to keep grading fair.

#### Scenario: Alternate accepted answer recognized as valid content

- GIVEN an exercise with `acceptedAnswers: ["I am", "I'm"]`
- WHEN either value is stored on the record
- THEN both are treated as valid entries for that exercise

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
