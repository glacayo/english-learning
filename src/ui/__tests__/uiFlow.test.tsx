/**
 * Behavior-level component integration tests for the level UI flow.
 *
 * Why renderToStaticMarkup / element traversal (not React Testing Library):
 *   The project does NOT have @testing-library/react installed, and the
 *   review contract says "without adding new dependencies unless already
 *   present". `react-dom/server` IS already present (it ships with the
 *   `react-dom` dependency). `renderToStaticMarkup` renders a component tree
 *   to an HTML string synchronously for markup assertions. For callback wiring,
 *   these tests inspect the React element tree and invoke event props directly.
 *
 * What these tests cover (blocker #2 requirements):
 *   1. Locked-level blocking: locked level buttons are `disabled`.
 *   2. Selecting next unlocked level: unlocked level buttons are NOT disabled
 *      and invoke `onSelect` with the correct id.
 *   3. Results next/back/retake actions: all three buttons render and invoke
 *      callbacks; "next level" is hidden when the attempt did not pass or
 *      levelId is 10.
 *   4. Leaderboard level filter wiring: the `<select>` renders Global + Levels
 *      1–10 options and fires `onLevelFilterChange`.
 *   5. Level 10 no-next behavior: passing Level 10 shows no "next level" button
 *      and shows the completion message.
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createElement,
  isValidElement,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from 'react';
import { LevelSelect, levelCardStatus } from '../LevelSelect';
import { Results, didPass, canAdvance } from '../Results';
import { Leaderboard } from '../Leaderboard';
import { buildLevels } from '../../content/levels';
import { EXERCISES } from '../../content/exercises';
import { applyPass, createInitialProgress, type LevelProgress } from '../../domain/levelProgress';
import type { LevelId, AttemptResult, Exercise } from '../../domain/types';
import type { SubmitStatus } from '../Results';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal level attempt result for Results rendering. */
function makeResult(score: number): AttemptResult {
  return {
    score,
    mistakes: [],
    recommendations: [],
  };
}

/** A minimal submit status for Results rendering. */
const idleStatus: SubmitStatus = { kind: 'idle' };

/**
 * Render a component to an HTML string for assertions.
 *
 * Uses `any` internally because `renderToStaticMarkup` + `createElement` with
 * concrete component prop types creates a variance issue in TypeScript that
 * doesn't affect runtime behavior. Each call site passes the correct props.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function render(Comp: ComponentType<any>, props: Record<string, unknown>): string {
  return renderToStaticMarkup(createElement(Comp, props as any));
}

type TestElementProps = {
  children?: ReactNode;
  onClick?: () => void;
  onChange?: (event: { target: { value: string } }) => void;
  disabled?: boolean;
  [key: string]: unknown;
};

function childrenToArray(children: ReactNode): ReactNode[] {
  if (children === null || children === undefined || typeof children === 'boolean') return [];
  return Array.isArray(children) ? children : [children];
}

function walkElements(
  node: ReactNode,
  predicate: (el: ReactElement<TestElementProps>) => boolean,
  found: ReactElement<TestElementProps>[] = [],
): ReactElement<TestElementProps>[] {
  if (Array.isArray(node)) {
    for (const child of node) walkElements(child, predicate, found);
    return found;
  }
  if (!isValidElement<TestElementProps>(node)) return found;
  if (typeof node.type === 'function') {
    const rendered = (node.type as (props: TestElementProps) => ReactNode)(node.props);
    walkElements(rendered, predicate, found);
    return found;
  }
  if (predicate(node)) found.push(node);
  for (const child of childrenToArray(node.props.children)) {
    walkElements(child, predicate, found);
  }
  return found;
}

function textContent(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (isValidElement<TestElementProps>(node)) {
    if (typeof node.type === 'function') {
      const rendered = (node.type as (props: TestElementProps) => ReactNode)(node.props);
      return textContent(rendered);
    }
    return textContent(node.props.children);
  }
  return '';
}

function buttonByText(tree: ReactNode, text: string): ReactElement<TestElementProps> {
  const button = walkElements(
    tree,
    (el) => el.type === 'button' && textContent(el.props.children).trim() === text,
  )[0];
  expect(button, `button "${text}"`).toBeDefined();
  return button;
}

function buttonByAriaLabel(tree: ReactNode, label: string): ReactElement<TestElementProps> {
  const button = walkElements(
    tree,
    (el) => el.type === 'button' && el.props['aria-label'] === label,
  )[0];
  expect(button, `button aria-label "${label}"`).toBeDefined();
  return button;
}

function selectElement(tree: ReactNode): ReactElement<TestElementProps> {
  const select = walkElements(tree, (el) => el.type === 'select')[0];
  expect(select, 'leaderboard filter select').toBeDefined();
  return select;
}

function click(el: ReactElement<TestElementProps>): void {
  expect(typeof el.props.onClick).toBe('function');
  el.props.onClick?.();
}

function change(el: ReactElement<TestElementProps>, value: string): void {
  expect(typeof el.props.onChange).toBe('function');
  el.props.onChange?.({ target: { value } });
}

// ---------------------------------------------------------------------------
// 1. Locked-level blocking
// ---------------------------------------------------------------------------

describe('UI flow — locked-level blocking (LevelSelect)', () => {
  it('renders locked level buttons as disabled for a fresh student (Levels 2-10)', () => {
    const levels = buildLevels(EXERCISES);
    const fresh = createInitialProgress();
    const html = render(LevelSelect, {
      levels,
      progress: fresh,
      name: 'Test',
      onSelect: () => {},
    });
    // Level 1 button is NOT disabled (unlocked/Start).
    expect(html).toMatch(/Level 1.*Start/);
    // Levels 2-10 cards are in the "locked" class with a disabled button.
    for (let id = 2; id <= 10; id += 1) {
      // Each locked level has a `level-card--locked` class and a `disabled`
      // button. The button's `disabled` attribute appears before the
      // `aria-label="Level N"` text, so we assert on the locked class + the
      // label appearing in the same card.
      const cardMatch = new RegExp(`level-card--locked.*?Level ${id}.*?Locked`, 's');
      expect(html).toMatch(cardMatch);
    }
  });

  it('shows a "Pass Level N first" hint for locked levels', () => {
    const levels = buildLevels(EXERCISES);
    const fresh = createInitialProgress();
    const html = render(LevelSelect, {
      levels,
      progress: fresh,
      name: 'Test',
      onSelect: () => {},
    });
    // Level 2 is locked; hint says "Pass Level 1 first".
    expect(html).toMatch(/Pass Level 1 first to unlock/);
  });

  it('does NOT show a hint for unlocked levels', () => {
    const levels = buildLevels(EXERCISES);
    const fresh = createInitialProgress();
    const html = render(LevelSelect, {
      levels,
      progress: fresh,
      name: 'Test',
      onSelect: () => {},
    });
    // Level 1 is unlocked; no hint about passing a previous level.
    const level1Section = html.split('Level 1')[1]?.split('Level 2')[0] ?? '';
    expect(level1Section).not.toMatch(/Pass Level 0 first/);
  });
});

// ---------------------------------------------------------------------------
// 2. Selecting next unlocked level
// ---------------------------------------------------------------------------

describe('UI flow — selecting next unlocked level (LevelSelect)', () => {
  it('enables Level 2 after passing Level 1 and enables Level 3 after passing Level 2', () => {
    const levels = buildLevels(EXERCISES);
    const p1 = applyPass(createInitialProgress(), 1, 9) as LevelProgress;
    const html1 = render(LevelSelect, {
      levels,
      progress: p1,
      name: 'Test',
      onSelect: () => {},
    });
    // Level 2 should be "Start" (unlocked), not "Locked".
    expect(html1).toMatch(/Level 2.*Start/);
    expect(html1).toMatch(/Level 3.*Locked/);

    const p2 = applyPass(p1, 2, 9) as LevelProgress;
    const html2 = render(LevelSelect, {
      levels,
      progress: p2,
      name: 'Test',
      onSelect: () => {},
    });
    expect(html2).toMatch(/Level 3.*Start/);
    expect(html2).toMatch(/Level 4.*Locked/);
  });

  it('marks a passed level as "Passed" (not just "Start")', () => {
    const levels = buildLevels(EXERCISES);
    const p = applyPass(createInitialProgress(), 1, 9) as LevelProgress;
    const html = render(LevelSelect, {
      levels,
      progress: p,
      name: 'Test',
      onSelect: () => {},
    });
    // Level 1 is passed → status "Passed".
    expect(html).toMatch(/Level 1.*Passed/);
    // Level 2 is unlocked but not passed → "Start".
    expect(html).toMatch(/Level 2.*Start/);
  });

  it('pure helper levelCardStatus agrees with the rendered status for all 10 levels', () => {
    const levels = buildLevels(EXERCISES);
    const p = applyPass(applyPass(createInitialProgress(), 1, 9), 2, 9) as LevelProgress;
    const html = render(LevelSelect, {
      levels,
      progress: p,
      name: 'Test',
      onSelect: () => {},
    });
    for (const level of levels) {
      const status = levelCardStatus(p, level.id);
      const label = status === 'passed' ? 'Passed' : status === 'unlocked' ? 'Start' : 'Locked';
      expect(html).toMatch(new RegExp(`Level ${level.id}.*${label}`));
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Results next/back/retake actions
// ---------------------------------------------------------------------------

describe('UI flow — Results next/back/retake actions', () => {
  const exercises: readonly Exercise[] = buildLevels(EXERCISES)[0].exercises;

  it('renders "Try again", "Back to levels", and "See leaderboard" for any result', () => {
    const html = render(Results, {
      result: makeResult(5),
      exercises,
      name: 'Test',
      levelId: 1 as LevelId,
      submitStatus: idleStatus,
      onRetrySubmit: () => {},
      onRetake: () => {},
      onNextLevel: () => {},
      onBackToLevels: () => {},
      onViewLeaderboard: () => {},
    });
    expect(html).toMatch(/Try again/);
    expect(html).toMatch(/Back to levels/);
    expect(html).toMatch(/See leaderboard/);
  });

  it('renders "Next level" when passed and levelId < 10', () => {
    const html = render(Results, {
      result: makeResult(9),
      exercises,
      name: 'Test',
      levelId: 5 as LevelId,
      submitStatus: idleStatus,
      onRetrySubmit: () => {},
      onRetake: () => {},
      onNextLevel: () => {},
      onBackToLevels: () => {},
      onViewLeaderboard: () => {},
    });
    expect(html).toMatch(/Next level/);
  });

  it('does NOT render "Next level" when the attempt did not pass (score < 9)', () => {
    const html = render(Results, {
      result: makeResult(8),
      exercises,
      name: 'Test',
      levelId: 5 as LevelId,
      submitStatus: idleStatus,
      onRetrySubmit: () => {},
      onRetake: () => {},
      onNextLevel: () => {},
      onBackToLevels: () => {},
      onViewLeaderboard: () => {},
    });
    expect(html).not.toMatch(/Next level/);
  });

  it('shows "Passed!" badge when score >= 9 and "Keep practicing" when below', () => {
    const passedHtml = render(Results, {
      result: makeResult(9),
      exercises,
      name: 'Test',
      levelId: 1 as LevelId,
      submitStatus: idleStatus,
      onRetrySubmit: () => {},
      onRetake: () => {},
      onNextLevel: () => {},
      onBackToLevels: () => {},
      onViewLeaderboard: () => {},
    });
    expect(passedHtml).toMatch(/Passed!/);

    const failedHtml = render(Results, {
      result: makeResult(8),
      exercises,
      name: 'Test',
      levelId: 1 as LevelId,
      submitStatus: idleStatus,
      onRetrySubmit: () => {},
      onRetake: () => {},
      onNextLevel: () => {},
      onBackToLevels: () => {},
      onViewLeaderboard: () => {},
    });
    expect(failedHtml).toMatch(/Keep practicing/);
  });

  it('renders the score number and "out of 10" label', () => {
    const html = render(Results, {
      result: makeResult(7),
      exercises,
      name: 'Test',
      levelId: 1 as LevelId,
      submitStatus: idleStatus,
      onRetrySubmit: () => {},
      onRetake: () => {},
      onNextLevel: () => {},
      onBackToLevels: () => {},
      onViewLeaderboard: () => {},
    });
    expect(html).toMatch(/>7</);
    expect(html).toMatch(/out of 10/);
  });
});

// ---------------------------------------------------------------------------
// 4. Leaderboard level filter wiring
// ---------------------------------------------------------------------------

describe('UI flow — leaderboard level filter wiring', () => {
  function entry(overrides: Partial<{ attemptId: string; level: number; name: string; score: number; timestamp: number }>): {
    attemptId: string;
    name: string;
    score: number;
    level: LevelId;
    timestamp: number;
  } {
    return {
      attemptId: 'a',
      name: 'S',
      score: 8,
      timestamp: 1,
      level: 1,
      ...overrides,
    } as never;
  }

  it('renders a <select> with Global + Level 1-10 options', () => {
    const html = render(Leaderboard, {
      entries: [],
      status: { kind: 'idle' },
      levelFilter: null,
      onLevelFilterChange: () => {},
      onRefresh: () => {},
      onBack: () => {},
    });
    expect(html).toMatch(/<select/);
    expect(html).toMatch(/Global/);
    for (let l = 1; l <= 10; l += 1) {
      expect(html).toMatch(new RegExp(`Level ${l}`));
    }
  });

  it('selects "global" when levelFilter is null', () => {
    const html = render(Leaderboard, {
      entries: [],
      status: { kind: 'idle' },
      levelFilter: null,
      onLevelFilterChange: () => {},
      onRefresh: () => {},
      onBack: () => {},
    });
    // The select value should be "global".
    expect(html).toMatch(/value="global"/);
  });

  it('selects the active level when levelFilter is set', () => {
    const html = render(Leaderboard, {
      entries: [],
      status: { kind: 'idle' },
      levelFilter: 3 as LevelId,
      onLevelFilterChange: () => {},
      onRefresh: () => {},
      onBack: () => {},
    });
    // The select value should be "3".
    expect(html).toMatch(/value="3"/);
  });

  it('renders only entries matching the active filter (global shows all)', () => {
    const entries = [
      entry({ attemptId: 'a1', level: 1, name: 'Ana', score: 10 }),
      entry({ attemptId: 'a2', level: 2, name: 'Bob', score: 9 }),
    ];
    const html = render(Leaderboard, {
      entries,
      status: { kind: 'loaded' },
      levelFilter: null,
      onLevelFilterChange: () => {},
      onRefresh: () => {},
      onBack: () => {},
    });
    expect(html).toMatch(/Ana/);
    expect(html).toMatch(/Bob/);
  });

  it('renders only entries matching the active filter (per-level shows one)', () => {
    const entries = [
      entry({ attemptId: 'a1', level: 1, name: 'Ana', score: 10 }),
      entry({ attemptId: 'a2', level: 2, name: 'Bob', score: 9 }),
    ];
    const html = render(Leaderboard, {
      entries,
      status: { kind: 'loaded' },
      levelFilter: 2 as LevelId,
      onLevelFilterChange: () => {},
      onRefresh: () => {},
      onBack: () => {},
    });
    expect(html).not.toMatch(/Ana/);
    expect(html).toMatch(/Bob/);
  });

  it('shows the "No scores yet" empty state when no entries match', () => {
    const html = render(Leaderboard, {
      entries: [],
      status: { kind: 'loaded' },
      levelFilter: null,
      onLevelFilterChange: () => {},
      onRefresh: () => {},
      onBack: () => {},
    });
    expect(html).toMatch(/No scores yet/);
  });

  it('renders a level column ("L{level}") for each row', () => {
    const entries = [entry({ attemptId: 'a1', level: 5, name: 'Cara', score: 7 })];
    const html = render(Leaderboard, {
      entries,
      status: { kind: 'loaded' },
      levelFilter: null,
      onLevelFilterChange: () => {},
      onRefresh: () => {},
      onBack: () => {},
    });
    expect(html).toMatch(/L5/);
  });
});

// ---------------------------------------------------------------------------
// 5. Level 10 no-next behavior
// ---------------------------------------------------------------------------

describe('UI flow — Level 10 no-next behavior (Results)', () => {
  const exercises: readonly Exercise[] = buildLevels(EXERCISES)[9].exercises;

  it('does NOT render "Next level" when levelId=10 even if passed', () => {
    const html = render(Results, {
      result: makeResult(10),
      exercises,
      name: 'Test',
      levelId: 10 as LevelId,
      submitStatus: idleStatus,
      onRetrySubmit: () => {},
      onRetake: () => {},
      onNextLevel: () => {},
      onBackToLevels: () => {},
      onViewLeaderboard: () => {},
    });
    expect(html).not.toMatch(/Next level/);
  });

  it('shows the Level 10 completion message when Level 10 is passed', () => {
    const html = render(Results, {
      result: makeResult(10),
      exercises,
      name: 'Test',
      levelId: 10 as LevelId,
      submitStatus: idleStatus,
      onRetrySubmit: () => {},
      onRetake: () => {},
      onNextLevel: () => {},
      onBackToLevels: () => {},
      onViewLeaderboard: () => {},
    });
    expect(html).toMatch(/You finished the last level/);
    expect(html).toMatch(/Amazing work/);
  });

  it('still shows "Try again" and "Back to levels" for Level 10 passed', () => {
    const html = render(Results, {
      result: makeResult(10),
      exercises,
      name: 'Test',
      levelId: 10 as LevelId,
      submitStatus: idleStatus,
      onRetrySubmit: () => {},
      onRetake: () => {},
      onNextLevel: () => {},
      onBackToLevels: () => {},
      onViewLeaderboard: () => {},
    });
    expect(html).toMatch(/Try again/);
    expect(html).toMatch(/Back to levels/);
    expect(html).toMatch(/See leaderboard/);
  });

  it('does NOT show the completion message when Level 10 is not passed', () => {
    const html = render(Results, {
      result: makeResult(8),
      exercises,
      name: 'Test',
      levelId: 10 as LevelId,
      submitStatus: idleStatus,
      onRetrySubmit: () => {},
      onRetake: () => {},
      onNextLevel: () => {},
      onBackToLevels: () => {},
      onViewLeaderboard: () => {},
    });
    expect(html).not.toMatch(/You finished the last level/);
  });

  it('does NOT show the completion message for a non-10 level even if passed', () => {
    const html = render(Results, {
      result: makeResult(10),
      exercises: buildLevels(EXERCISES)[4].exercises,
      name: 'Test',
      levelId: 5 as LevelId,
      submitStatus: idleStatus,
      onRetrySubmit: () => {},
      onRetake: () => {},
      onNextLevel: () => {},
      onBackToLevels: () => {},
      onViewLeaderboard: () => {},
    });
    expect(html).not.toMatch(/You finished the last level/);
    // Level 5 passed and < 10 should show "Next level".
    expect(html).toMatch(/Next level/);
  });

  it('pure helper canAdvance agrees: Level 10 never advances even with max score', () => {
    expect(canAdvance(10, 10)).toBe(false);
    expect(canAdvance(10, 9)).toBe(false);
    // Non-10 passed level can advance.
    expect(canAdvance(9, 9)).toBe(true);
  });

  it('pure helper didPass agrees: 9+ passes, <9 does not', () => {
    expect(didPass(9)).toBe(true);
    expect(didPass(10)).toBe(true);
    expect(didPass(8)).toBe(false);
    expect(didPass(0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Interaction-level callback wiring (no DOM dependency)
// ---------------------------------------------------------------------------

describe('UI flow — interaction callback wiring', () => {
  it('LevelSelect invokes onSelect for an unlocked level and keeps locked levels disabled', () => {
    const levels = buildLevels(EXERCISES);
    const progress = applyPass(createInitialProgress(), 1, 9) as LevelProgress;
    const selected: LevelId[] = [];
    const tree = LevelSelect({
      levels,
      progress,
      name: 'Test',
      onSelect: (id) => selected.push(id),
    });

    click(buttonByAriaLabel(tree, 'Level 2 — unlocked'));
    expect(selected).toEqual([2]);

    const lockedLevel3 = buttonByAriaLabel(tree, 'Level 3 — locked');
    expect(lockedLevel3.props.disabled).toBe(true);
  });

  it('LevelSelect wires the leaderboard button when provided', () => {
    const calls: string[] = [];
    const tree = LevelSelect({
      levels: buildLevels(EXERCISES),
      progress: createInitialProgress(),
      name: 'Test',
      onSelect: () => {},
      onViewLeaderboard: () => calls.push('leaderboard'),
    });

    click(buttonByText(tree, 'See leaderboard'));
    expect(calls).toEqual(['leaderboard']);
  });

  it('Results wires retake, next, back, leaderboard, and retry callbacks', () => {
    const calls: string[] = [];
    const tree = Results({
      result: makeResult(9),
      exercises: buildLevels(EXERCISES)[0].exercises,
      name: 'Test',
      levelId: 1,
      submitStatus: { kind: 'failed', attemptId: 'a1', message: 'offline' },
      onRetrySubmit: () => calls.push('retry'),
      onRetake: () => calls.push('retake'),
      onNextLevel: () => calls.push('next'),
      onBackToLevels: () => calls.push('back'),
      onViewLeaderboard: () => calls.push('leaderboard'),
    });

    click(buttonByText(tree, 'Try sending again'));
    click(buttonByText(tree, 'Try again'));
    click(buttonByText(tree, 'Next level'));
    click(buttonByText(tree, 'Back to levels'));
    click(buttonByText(tree, 'See leaderboard'));

    expect(calls).toEqual(['retry', 'retake', 'next', 'back', 'leaderboard']);
  });

  it('Results keeps local navigation clickable while leaderboard submit is pending', () => {
    const calls: string[] = [];
    const tree = Results({
      result: makeResult(9),
      exercises: buildLevels(EXERCISES)[0].exercises,
      name: 'Test',
      levelId: 1,
      submitStatus: { kind: 'submitting', attemptId: 'a1' },
      onRetrySubmit: () => calls.push('retry'),
      onRetake: () => calls.push('retake'),
      onNextLevel: () => calls.push('next'),
      onBackToLevels: () => calls.push('back'),
      onViewLeaderboard: () => calls.push('leaderboard'),
    });

    const retake = buttonByText(tree, 'Try again');
    const next = buttonByText(tree, 'Next level');
    const back = buttonByText(tree, 'Back to levels');
    expect(retake.props.disabled).toBeUndefined();
    expect(next.props.disabled).toBeUndefined();
    expect(back.props.disabled).toBeUndefined();

    click(retake);
    click(next);
    click(back);
    expect(calls).toEqual(['retake', 'next', 'back']);
  });

  it('Leaderboard wires filter changes, refresh, and back callbacks', () => {
    const filterCalls: (LevelId | null)[] = [];
    const calls: string[] = [];
    const tree = Leaderboard({
      entries: [],
      status: { kind: 'idle' },
      levelFilter: null,
      onLevelFilterChange: (level) => filterCalls.push(level),
      onRefresh: () => calls.push('refresh'),
      onBack: () => calls.push('back'),
    });

    const filter = selectElement(tree);
    change(filter, '3');
    change(filter, 'global');
    click(buttonByText(tree, 'Refresh'));
    click(buttonByText(tree, 'Back'));

    expect(filterCalls).toEqual([3, null]);
    expect(calls).toEqual(['refresh', 'back']);
  });
});
