import { useState } from 'react';
import type { JSX, ChangeEvent, FormEvent } from 'react';

/**
 * NameEntry — child-friendly name capture (student-session spec).
 *
 * Responsibilities:
 *   - Block start on empty/whitespace-only names with a friendly, non-hostile
 *     message asking the child to type a name.
 *   - On a valid name, call `onClaimName(trimmed)`; the parent owns the API
 *     claim + attempt-start flow so this component stays presentational and
 *     retake-safe (a returning student typing the same name simply starts a
 *     new attempt with a new attemptId).
 *
 * This component intentionally does NOT call the network directly — it reports
 * the trimmed name up and lets the parent coordinate claim + start, so the
 * retake path (same display name, new attemptId) is handled in one place.
 */
export interface NameEntryProps {
  /** Called with the trimmed name when the child confirms a non-empty name. */
  onClaimName: (name: string) => void;
  /** Disable the form while a claim is in flight. */
  busy?: boolean;
  /** Optional server-side message (e.g. unavailable) to surface to the child. */
  notice?: string;
}

export function NameEntry({ onClaimName, busy = false, notice }: NameEntryProps): JSX.Element {
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmed = name.trim();
  const isEmpty = trimmed.length === 0;
  const showError = touched && isEmpty;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setTouched(true);
    if (isEmpty || busy) return;
    onClaimName(trimmed);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    setName(event.target.value);
  }

  return (
    <section className="card name-entry" aria-labelledby="name-entry-title">
      <h2 id="name-entry-title" className="name-entry__title">
        What is your name?
      </h2>
      <p className="name-entry__hint">
        Type your name to start the practice. Use your own name so your score
        is easy to find on the leaderboard!
      </p>

      <form className="name-entry__form" onSubmit={handleSubmit} noValidate>
        <label className="name-entry__label" htmlFor="student-name">
          Your name
        </label>
        <input
          id="student-name"
          className="name-entry__input"
          type="text"
          value={name}
          onChange={handleChange}
          onBlur={() => setTouched(true)}
          placeholder="For example: Maria"
          autoComplete="off"
          autoFocus
          disabled={busy}
          aria-invalid={showError}
          aria-describedby={showError ? 'name-entry-error' : undefined}
        />

        {showError ? (
          <p id="name-entry-error" className="name-entry__error" role="alert">
            Please type your name so we can start. It can&rsquo;t be empty.
          </p>
        ) : null}

        {notice ? (
          <p className="name-entry__notice" role="status">
            {notice}
          </p>
        ) : null}

        <button
          type="submit"
          className="name-entry__submit"
          disabled={busy || isEmpty}
        >
          {busy ? 'Starting…' : 'Start'}
        </button>
      </form>
    </section>
  );
}