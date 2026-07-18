declare module './leaderboard-classifier.mjs' {
  import type { LevelId } from '../../src/domain/types';

  export const MIN_LEVEL: 1;
  export const MAX_LEVEL: 10;
  export const MIN_SCORE: 0;
  export const MAX_SCORE: 10;

  export function isValidLevelValue(value: unknown): value is LevelId;
  export function toLeaderboardLevel(value: unknown): LevelId | null;
  export function isValidScoreValue(value: unknown): value is number;
  export function classifyForReset(raw: unknown): {
    valid: boolean;
    reason: string;
  };
}
