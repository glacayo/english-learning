import { describe, expect, it } from 'vitest';
import type { Answer, Topic } from '../types';
import {
  computeTopicStats,
  MAX_RECOMMENDATIONS,
  RECOMMENDATION_THRESHOLD,
  recommendTopics,
} from '../recommendations';
import { TOPICS } from '../../content/topics';

function answer(topic: Topic, correct: boolean): Answer {
  return { exerciseId: `e-${topic}-${Math.random().toString(36).slice(2)}`, topic, given: 'x', correct };
}

function answers(topic: Topic, total: number, missed: number): Answer[] {
  const out: Answer[] = [];
  for (let i = 0; i < total; i++) {
    out.push(answer(topic, i >= missed));
  }
  return out;
}

describe('computeTopicStats', () => {
  it('reports miss rate per topic', () => {
    const list = [
      ...answers('present-simple', 10, 4),
      ...answers('simple-past', 5, 3),
    ];
    const stats = computeTopicStats(list);
    const presentSimple = stats.find((s) => s.topic === 'present-simple')!;
    const simplePast = stats.find((s) => s.topic === 'simple-past')!;
    expect(presentSimple.total).toBe(10);
    expect(presentSimple.missed).toBe(4);
    expect(presentSimple.missRate).toBeCloseTo(0.4);
    expect(simplePast.missRate).toBeCloseTo(0.6);
  });

  it('gives missRate 0 to topics with no answers', () => {
    const stats = computeTopicStats([answer('present-simple', false)]);
    for (const topic of TOPICS) {
      const s = stats.find((st) => st.topic === topic)!;
      if (topic === 'present-simple') {
        expect(s.total).toBe(1);
        expect(s.missRate).toBe(1);
      } else {
        expect(s.total).toBe(0);
        expect(s.missRate).toBe(0);
      }
    }
  });
});

describe('recommendTopics', () => {
  it('recommends a high miss-rate topic', () => {
    const list = [...answers('simple-past', 10, 6)]; // 60%
    expect(recommendTopics(list)).toContain('simple-past');
  });

  it('excludes a low miss-rate topic (< 40%)', () => {
    const list = [...answers('present-simple', 10, 2)]; // 20%
    expect(recommendTopics(list)).not.toContain('present-simple');
  });

  it('includes a topic exactly at the 40% threshold', () => {
    const list = [...answers('daily-routine', 10, 4)]; // exactly 40%
    expect(recommendTopics(list)).toContain('daily-routine');
  });

  it('caps recommendations at three', () => {
    // 5 topics at 100% miss rate
    const list: Answer[] = [];
    const fiveTopics = TOPICS.slice(0, 5);
    for (const topic of fiveTopics) {
      list.push(...answers(topic, 2, 2));
    }
    const recs = recommendTopics(list);
    expect(recs).toHaveLength(MAX_RECOMMENDATIONS);
  });

  it('orders recommendations from highest miss rate to lowest', () => {
    const list = [
      ...answers('present-simple', 10, 9), // 90%
      ...answers('simple-past', 10, 6), // 60%
      ...answers('daily-routine', 10, 4), // 40%
    ];
    expect(recommendTopics(list)).toEqual([
      'present-simple',
      'simple-past',
      'daily-routine',
    ]);
  });

  it('breaks ties deterministically by topic name ascending', () => {
    const list = [
      ...answers('simple-past', 10, 5), // 50%
      ...answers('present-simple', 10, 5), // 50%
    ];
    const recs = recommendTopics(list);
    expect(recs).toEqual(['present-simple', 'simple-past']);
  });

  it('returns an empty list when no topic reaches the threshold', () => {
    const list = [
      ...answers('present-simple', 10, 1), // 10%
      ...answers('simple-past', 10, 2), // 20%
    ];
    expect(recommendTopics(list)).toEqual([]);
  });

  it('returns an empty list when all answers are correct', () => {
    const list = [
      ...answers('present-simple', 10, 0),
      ...answers('simple-past', 10, 0),
    ];
    expect(recommendTopics(list)).toEqual([]);
  });

  it('exposes the 40% threshold and max-3 cap as constants', () => {
    expect(RECOMMENDATION_THRESHOLD).toBe(0.4);
    expect(MAX_RECOMMENDATIONS).toBe(3);
  });
});