import { describe, expect, it } from 'vitest';
import { storedAnswerForExercise } from '../ExerciseRunner';

/**
 * Regression coverage for answer-input sync across questions.
 * Full React render tests are out of scope (no Testing Library in PR 3);
 * the helper is the source of truth for the controlled input's restored value.
 */
describe('storedAnswerForExercise (input reset/sync)', () => {
  it('returns empty string when the exercise is unknown', () => {
    const answers = new Map([['e1', 'plays']]);
    expect(storedAnswerForExercise(answers, undefined)).toBe('');
  });

  it('returns empty string for an unanswered exercise (no carry-over source)', () => {
    const answers = new Map([['e1', 'plays']]);
    expect(storedAnswerForExercise(answers, 'e2')).toBe('');
  });

  it('returns the persisted answer when navigating back to a prior exercise', () => {
    const answers = new Map([
      ['e1', 'plays'],
      ['e2', 'went'],
    ]);
    expect(storedAnswerForExercise(answers, 'e1')).toBe('plays');
    expect(storedAnswerForExercise(answers, 'e2')).toBe('went');
  });

  it('does not leak a previous exercise value when the next id is unanswered', () => {
    // After answering e1 and moving to e2, the draft for e2 must start empty
    // even though answers still holds e1's value.
    const answers = new Map([['e1', 'typed-on-previous-question']]);
    expect(storedAnswerForExercise(answers, 'e2')).toBe('');
    expect(storedAnswerForExercise(answers, 'e1')).toBe('typed-on-previous-question');
  });
});
