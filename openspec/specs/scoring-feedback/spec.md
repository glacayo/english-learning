# Scoring & Feedback Specification

## Purpose

Defines how a completed attempt is auto-graded, how mistakes are surfaced,
and how per-topic study recommendations are derived.

## Requirements

### Requirement: Auto-Grading

The system MUST grade each answer by comparing the student answer to each
value in the exercise's `acceptedAnswers` **after normalizing both sides**
with `trim` + case-fold (e.g. lowercase), and MUST compute a final score on a
0-10 scale (correct answers out of the selected level's 10 exercises).
Leading/trailing spaces or letter casing MUST NOT cause a correct answer to
fail. A skipped question counts as incorrect.
(Previously: score was on a 0-100 scale over the full 100-exercise catalog.)

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

#### Scenario: Level score reflects the 10-question scale

- GIVEN a level attempt with 9 correct answers out of 10
- WHEN grading completes
- THEN the reported score MUST be 9 on a 0-10 scale

### Requirement: Mistake Review

The system MUST present a list of every incorrectly answered exercise,
including the topic, the student's answer, and study advice for what to review
next. The results screen MUST NOT display the exercise prompt, accepted
answers, or any other content that reveals the correct answer key (including
catalog prompt hints such as base-form cues in parentheses).

#### Scenario: Mistakes list matches incorrect answers

- GIVEN a completed attempt with 3 incorrect answers
- WHEN the results screen is generated
- THEN the mistakes list contains exactly those 3 exercises with topic,
  student answer, and study advice shown
- AND it does not show the exercise prompt
- AND it does not show accepted answers or a `Correct:` answer-key label

#### Scenario: Catalog prompt answer hints are not shown on Results

- GIVEN a missed exercise whose catalog prompt embeds an answer-key hint
  (for example `I ___ to school every day. (go)`)
- WHEN the results screen is generated
- THEN the mistakes review MUST NOT include that prompt text or the
  parenthetical answer-key hint
- AND it MUST still show the student's answer, topic, and study advice

### Requirement: Topic Recommendation

The system MUST compute a miss rate per topic within the level attempt and
recommend up to 3 topics that satisfy **both**:
1. the topic has at least 2 questions in the level attempt (minimum sample), and
2. the topic miss rate is 40% or higher,
ordered from highest miss rate to lowest. A topic with only one question in the
attempt MUST NOT be recommended, even if that single question was missed.
(Previously: recommended any topic with miss rate ≥ 40% with no minimum sample
size; rates were computed over the full 100-exercise attempt.)

#### Scenario: One of two missed meets threshold and is recommended

- GIVEN the "simple past" topic has 2 questions in the level attempt and 1 is
  missed (50% miss rate)
- WHEN recommendations are generated
- THEN "simple past" MUST appear in the recommendation list

#### Scenario: Single-question miss is not recommended (insufficient sample)

- GIVEN the "present progressive" topic has only 1 question in the level
  attempt and it is missed (100% miss rate)
- WHEN recommendations are generated
- THEN "present progressive" MUST NOT appear in the recommendation list

#### Scenario: Low miss-rate topic excluded

- GIVEN the "present simple" topic has at least 2 questions and a 20% miss rate
  on this attempt
- WHEN recommendations are generated
- THEN "present simple" MUST NOT appear in the recommendation list

#### Scenario: Recommendations capped at three

- GIVEN 5 topics each have at least 2 questions and a miss rate of 40% or higher
- WHEN recommendations are generated
- THEN exactly the top 3 topics by miss rate are returned

### Requirement: End-of-Test Summary

The system MUST present the final score, mistakes list, and topic
recommendations together at the end of a completed attempt, along with the
attempt's level and its pass/fail status.
(Previously: summary showed only the 0-100 score without level context.)

#### Scenario: Results screen shows full summary

- GIVEN an attempt just transitioned to `completed`
- WHEN the results screen renders
- THEN it MUST show the score (0-10), the mistakes list, the recommended
  topics, the level number, and whether the level was passed
- AND it MUST NOT reveal exercise prompts or accepted answers for missed
  questions

### Requirement: Level Pass Threshold

A level attempt MUST be marked passed when its score is at least 9 out of 10
(90%); otherwise it is marked not-passed. Passing MUST trigger unlocking of
the next level per the level-progression capability.

#### Scenario: Score of 9 marks the level passed

- GIVEN a level attempt scores 9 out of 10
- WHEN the result is computed
- THEN the level status MUST be "passed"

#### Scenario: Score below 9 marks the level not passed

- GIVEN a level attempt scores 8 out of 10
- WHEN the result is computed
- THEN the level status MUST be "not passed"
