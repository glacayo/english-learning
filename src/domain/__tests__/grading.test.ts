import { describe, expect, it } from 'vitest';
import type { Exercise } from '../types';
import { gradeAnswer, gradeAttempt, normalizeAnswer } from '../grading';

const exercise: Exercise = {
  id: 'ex-001',
  topic: 'present-simple',
  prompt: 'I ___ soccer every day.',
  acceptedAnswers: ['play', 'plays'],
};

const multiAnswerExercise: Exercise = {
  id: 'ex-002',
  topic: 'present-simple',
  prompt: 'I am happy. (full or contracted)',
  acceptedAnswers: ['I am', "I'm"],
};

describe('normalizeAnswer', () => {
  it('trims leading and trailing spaces', () => {
    expect(normalizeAnswer('  played  ')).toBe('played');
  });

  it('case-folds to lowercase', () => {
    expect(normalizeAnswer('PLAYED')).toBe('played');
  });

  it('trims and case-folds together', () => {
    expect(normalizeAnswer('  Played ')).toBe('played');
  });
});

describe('gradeAnswer', () => {
  it('grades an exact match as correct', () => {
    expect(gradeAnswer(exercise, 'play')).toBe(true);
  });

  it('grades a case-folded alternate accepted answer as correct', () => {
    expect(gradeAnswer(multiAnswerExercise, "i'm")).toBe(true);
  });

  it('does not fail a correct answer with leading/trailing spaces', () => {
    // Spec scenario: acceptedAnswers ["played"], student answers "  Played "
    expect(gradeAnswer({ ...exercise, acceptedAnswers: ['played'] }, '  Played ')).toBe(true);
  });

  it('grades a wrong answer as incorrect', () => {
    expect(gradeAnswer({ ...exercise, acceptedAnswers: ['plays'] }, 'play')).toBe(false);
  });

  it('grades an empty/whitespace-only answer as incorrect', () => {
    expect(gradeAnswer(exercise, '   ')).toBe(false);
  });

  it('grades an empty string as incorrect', () => {
    expect(gradeAnswer(exercise, '')).toBe(false);
  });
});

describe('gradeAttempt', () => {
  function buildExercises(): Exercise[] {
    return [
      { id: 'e1', topic: 'present-simple', prompt: 'q1', acceptedAnswers: ['play'] },
      { id: 'e2', topic: 'simple-past', prompt: 'q2', acceptedAnswers: ['played'] },
      { id: 'e3', topic: 'present-simple', prompt: 'q3', acceptedAnswers: ['goes'] },
      { id: 'e4', topic: 'simple-past', prompt: 'q4', acceptedAnswers: ['went'] },
    ];
  }

  it('scores 100 when all answers are correct', () => {
    const result = gradeAttempt(buildExercises(), [
      { exerciseId: 'e1', given: 'play' },
      { exerciseId: 'e2', given: 'played' },
      { exerciseId: 'e3', given: 'goes' },
      { exerciseId: 'e4', given: 'went' },
    ]);
    expect(result.score).toBe(100);
    expect(result.mistakes).toHaveLength(0);
  });

  it('scores 0 when all answers are wrong', () => {
    const result = gradeAttempt(buildExercises(), [
      { exerciseId: 'e1', given: 'plays' },
      { exerciseId: 'e2', given: 'play' },
      { exerciseId: 'e3', given: 'go' },
      { exerciseId: 'e4', given: 'goes' },
    ]);
    expect(result.score).toBe(0);
    expect(result.mistakes).toHaveLength(4);
  });

  it('computes score as correct out of 100 across the full 100-exercise scale', () => {
    const exercises: Exercise[] = Array.from({ length: 100 }, (_, i) => ({
      id: `e${i}`,
      topic: 'present-simple' as const,
      prompt: `q${i}`,
      acceptedAnswers: [`a${i}`],
    }));
    const responses = exercises.slice(0, 75).map((e) => ({
      exerciseId: e.id,
      given: e.acceptedAnswers[0],
    }));
    const result = gradeAttempt(exercises, responses);
    expect(result.score).toBe(75);
    expect(result.mistakes).toHaveLength(25);
  });

  it('treats unanswered exercises as incorrect (empty given)', () => {
    const result = gradeAttempt(buildExercises(), [
      { exerciseId: 'e1', given: 'play' },
    ]);
    expect(result.score).toBe(25);
    expect(result.mistakes).toHaveLength(3);
    expect(result.mistakes.every((m) => m.correct === false)).toBe(true);
  });

  it('ignores responses whose exerciseId is not in the catalog', () => {
    const result = gradeAttempt(buildExercises(), [
      { exerciseId: 'e1', given: 'play' },
      { exerciseId: 'e2', given: 'played' },
      { exerciseId: 'e3', given: 'goes' },
      { exerciseId: 'e4', given: 'went' },
      { exerciseId: 'unknown', given: 'whatever' },
    ]);
    expect(result.score).toBe(100);
  });

  it('accepts a Map of responses', () => {
    const map = new Map<string, string>([
      ['e1', 'play'],
      ['e2', 'played'],
      ['e3', 'goes'],
      ['e4', 'went'],
    ]);
    const result = gradeAttempt(buildExercises(), map);
    expect(result.score).toBe(100);
  });

  it('preserves catalog order in mistakes', () => {
    const result = gradeAttempt(buildExercises(), [
      { exerciseId: 'e1', given: 'wrong' },
      { exerciseId: 'e2', given: 'played' },
      { exerciseId: 'e3', given: 'wrong' },
      { exerciseId: 'e4', given: 'went' },
    ]);
    expect(result.mistakes.map((m) => m.exerciseId)).toEqual(['e1', 'e3']);
  });

  it('returns recommendations derived from the mistakes', () => {
    // e1 and e3 are present-simple (2/2 missed -> 100%); e2 and e4 correct.
    const result = gradeAttempt(buildExercises(), [
      { exerciseId: 'e1', given: 'wrong' },
      { exerciseId: 'e2', given: 'played' },
      { exerciseId: 'e3', given: 'wrong' },
      { exerciseId: 'e4', given: 'went' },
    ]);
    expect(result.recommendations).toEqual(['present-simple']);
  });
});