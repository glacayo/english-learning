# Scoring & Feedback Specification

## Purpose

Defines how a completed attempt is auto-graded, how mistakes are surfaced,
and how per-topic study recommendations are derived.

## Requirements

### Requirement: Auto-Grading

The system MUST grade each answer by comparing the student answer to each
value in the exercise's `acceptedAnswers` **after normalizing both sides** with
`trim` + case-fold (e.g. lowercase), and MUST compute a final score on a 0–100
scale (correct answers out of 100). Leading/trailing spaces or letter casing
MUST NOT cause a correct answer to fail.

#### Scenario: Exact match graded correct

- GIVEN an exercise with `acceptedAnswers: ["played"]`
- WHEN the student answers "played"
- THEN the answer is graded correct

#### Scenario: Case-folded alternate answer graded correct

- GIVEN an exercise with `acceptedAnswers: ["I am", "I'm"]`
- WHEN the student answers "i'm"
- THEN the answer is graded correct

#### Scenario: Leading/trailing spaces do not fail a correct answer

- GIVEN an exercise with `acceptedAnswers: ["played"]`
- WHEN the student answers "  Played "
- THEN the answer is graded correct

#### Scenario: Incorrect answer graded and recorded

- GIVEN an exercise with `acceptedAnswers: ["plays"]`
- WHEN the student answers "play"
- THEN the answer is graded incorrect
- AND the exercise is added to the attempt's mistakes list

### Requirement: Mistake Review

The system MUST present a list of every incorrectly answered exercise,
including exercise id, topic, the student's answer, and the accepted
answer(s).

#### Scenario: Mistakes list matches incorrect answers

- GIVEN a completed attempt with 3 incorrect answers
- WHEN the results screen is generated
- THEN the mistakes list contains exactly those 3 exercises with topic and answers shown

### Requirement: Topic Recommendation

The system MUST compute a miss rate per topic and recommend up to 3 topics
with a miss rate of 40% or higher, ordered from highest miss rate to lowest.

#### Scenario: High miss-rate topic recommended

- GIVEN the "simple past" topic has a 60% miss rate on this attempt
- WHEN recommendations are generated
- THEN "simple past" MUST appear in the recommendation list

#### Scenario: Low miss-rate topic excluded

- GIVEN the "present simple" topic has a 20% miss rate on this attempt
- WHEN recommendations are generated
- THEN "present simple" MUST NOT appear in the recommendation list

#### Scenario: Recommendations capped at three

- GIVEN 5 topics each have a miss rate of 40% or higher
- WHEN recommendations are generated
- THEN exactly the top 3 topics by miss rate are returned

### Requirement: End-of-Test Summary

The system MUST present the final score, mistakes list, and topic
recommendations together at the end of a completed attempt.

#### Scenario: Results screen shows full summary

- GIVEN an attempt just transitioned to `completed`
- WHEN the results screen renders
- THEN it MUST show the score (0–100), the mistakes list, and the recommended topics
