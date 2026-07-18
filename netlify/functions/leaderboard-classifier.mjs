/**
 * Shared leaderboard row validation for Netlify Functions and the reset CLI.
 *
 * This module is plain ESM so both TypeScript function code and the Node
 * `scripts/reset-leaderboard.mjs` CLI import the SAME classifier at runtime.
 */

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 10;
export const MIN_SCORE = 0;
export const MAX_SCORE = 10;

export function isValidLevelValue(value) {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_LEVEL &&
    value <= MAX_LEVEL
  );
}

export function toLeaderboardLevel(value) {
  return isValidLevelValue(value) ? value : null;
}

export function isValidScoreValue(value) {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_SCORE &&
    value <= MAX_SCORE
  );
}

export function classifyForReset(raw) {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return { valid: false, reason: 'null-or-missing-blob' };
  }
  if (typeof raw.attemptId !== 'string' || raw.attemptId.length === 0) {
    return { valid: false, reason: 'missing-attemptId' };
  }
  if (typeof raw.name !== 'string' || raw.name.length === 0) {
    return { valid: false, reason: 'missing-name' };
  }
  if (!isValidScoreValue(raw.score)) {
    return { valid: false, reason: 'invalid-score' };
  }
  if (typeof raw.timestamp !== 'number' || !Number.isFinite(raw.timestamp)) {
    return { valid: false, reason: 'invalid-timestamp' };
  }
  if (!isValidLevelValue(raw.level)) {
    return { valid: false, reason: 'invalid-or-missing-level' };
  }
  return { valid: true, reason: 'valid' };
}
