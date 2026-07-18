import { useEffect, useState } from 'react';
import type { JSX, ChangeEvent, FormEvent } from 'react';
import type { Exercise } from '../domain/types';
import { TOPIC_LABELS } from '../content/topics';

/**
 * ExerciseRunner — drives the in-progress attempt question flow
 * (student-session + scoring-feedback specs).
 *
 * Responsibilities:
 *   - Show one exercise prompt at a time with a text input for the answer.
 *   - Record each answer via `onAnswer(exerciseId, given)`; the parent reducer
 *     enforces in-progress-only acceptance and auto-completion on the last
 *     answer (the level's 10th).
 *   - Show progress ("Question N of 10" when `exercises` is a level's 10
 *     exercises) and allow going back to fix a previous answer without leaving
 *     the in-progress state.
 *   - Sync the local draft input when the visible exercise (or its stored
 *     answer) changes so typed text does not leak across questions, while
 *     still restoring persisted answers on back-navigation.
 *
 * This component is presentational: it does not grade or persist. Grading is
 * pure (`gradeAttempt`) and runs in the parent after completion. The parent
 * passes the selected level's 10 exercises so the progress label reads
 * "Question N of 10" (prop-driven).
 */
export interface ExerciseRunnerProps {
  exercises: readonly Exercise[];
  /** Current answer map (exerciseId -> given) so back-navigation shows prior answers. */
  answers: ReadonlyMap<string, string>;
  /** Zero-based index to display. */
  index: number;
  onAnswer: (exerciseId: string, given: string) => void;
  onNavigate: (index: number) => void;
  onFinish: () => void;
}

/**
 * Resolve the controlled input value for the visible exercise from the
 * persisted answer map. Empty when the exercise is unknown or unanswered.
 * Exported for focused regression tests (no React Testing Library in PR 3).
 */
export function storedAnswerForExercise(
  answers: ReadonlyMap<string, string>,
  exerciseId: string | undefined,
): string {
  if (!exerciseId) return '';
  return answers.get(exerciseId) ?? '';
}

export function ExerciseRunner({
  exercises,
  answers,
  index,
  onAnswer,
  onNavigate,
  onFinish,
}: ExerciseRunnerProps): JSX.Element {
  const exercise = exercises[index];
  const stored = storedAnswerForExercise(answers, exercise?.id);
  const [value, setValue] = useState(stored);

  // Re-sync the local draft when navigation changes the visible exercise or
  // when a persisted answer for that exercise is restored (e.g. Back).
  // A form `key` alone cannot reset this controlled input — useState lives
  // on the component, not on the form element.
  useEffect(() => {
    setValue(stored);
  }, [exercise?.id, stored]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!exercise) return;
    onAnswer(exercise.id, value);
    if (index + 1 < exercises.length) {
      onNavigate(index + 1);
    } else {
      onFinish();
    }
  }

  function handleBack(): void {
    if (index > 0) onNavigate(index - 1);
  }

  function handleSkip(): void {
    if (!exercise) return;
    // Record a blank for skipped questions so Finish can complete the attempt
    // even when some items were never explicitly answered.
    if (!answers.has(exercise.id)) {
      onAnswer(exercise.id, '');
    }
    if (index + 1 < exercises.length) onNavigate(index + 1);
  }

  if (!exercise) {
    return (
      <section className="card exercise-runner">
        <p>No exercises available.</p>
      </section>
    );
  }

  const topicLabel = TOPIC_LABELS[exercise.topic] ?? exercise.topic;
  const total = exercises.length;
  const position = index + 1;

  return (
    <section className="card exercise-runner" aria-labelledby="exercise-prompt">
      <div className="exercise-runner__meta">
        <span className="exercise-runner__topic">{topicLabel}</span>
        <span className="exercise-runner__progress">
          Question {position} of {total}
        </span>
      </div>

      <form className="exercise-runner__form" onSubmit={handleSubmit}>
        <label className="exercise-runner__prompt" id="exercise-prompt" htmlFor="answer-input">
          {exercise.prompt}
        </label>
        <input
          id="answer-input"
          className="exercise-runner__input"
          type="text"
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value)}
          placeholder="Type your answer"
          autoComplete="off"
          autoFocus
        />

        <div className="exercise-runner__buttons">
          <button
            type="button"
            className="button button--secondary"
            onClick={handleBack}
            disabled={index === 0}
          >
            Back
          </button>
          {index + 1 < total ? (
            <>
              <button
                type="button"
                className="button button--secondary"
                onClick={handleSkip}
              >
                Skip
              </button>
              <button type="submit" className="button button--primary">
                Next
              </button>
            </>
          ) : (
            <button type="submit" className="button button--primary">
              Finish
            </button>
          )}
        </div>
      </form>
    </section>
  );
}