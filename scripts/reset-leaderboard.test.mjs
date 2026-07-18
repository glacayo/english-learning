import { describe, expect, it } from 'vitest';
import {
  classifyForReset,
  scanLeaderboard,
  deleteCandidates,
  resolveBlobsAccess,
  writeRollbackSnapshot,
  verifyTargetConfirm,
} from './reset-leaderboard.mjs';
import { classifyForReset as storeClassifyForReset } from '../netlify/functions/_store';

/** Minimal fake Blobs store matching the surface used by scan/delete helpers. */
function fakeStore(entries) {
  const data = new Map(Object.entries(entries));
  return {
    list() {
      const keys = [...data.keys()];
      const page = { blobs: keys.map((key) => ({ key })) };
      // Async iterable yielding one page.
      return {
        [Symbol.asyncIterator]() {
          let done = false;
          return {
            next() {
              if (done) return Promise.resolve({ value: undefined, done: true });
              done = true;
              return Promise.resolve({ value: page, done: false });
            },
          };
        },
      };
    },
    async get(key) {
      return data.has(key) ? data.get(key) : null;
    },
    async delete(key) {
      const had = data.has(key);
      data.delete(key);
      return { deleted: had };
    },
  };
}

describe('classifyForReset — PR3 level-aware schema', () => {
  it('classifies a valid level-aware row as valid', () => {
    expect(
      classifyForReset({
        attemptId: 'a',
        name: 'Maria',
        score: 9,
        level: 3,
        timestamp: 1000,
      }),
    ).toEqual({ valid: true, reason: 'valid' });
  });

  it('classifies a legacy row (no level, 0-100 score) as a candidate', () => {
    // A 0-100 score fails the score check first (before the level check).
    expect(
      classifyForReset({ attemptId: 'a', name: 'Maria', score: 85, timestamp: 1000 }),
    ).toEqual({ valid: false, reason: 'invalid-score' });
  });

  it('classifies a row with valid score but missing level as a candidate', () => {
    expect(
      classifyForReset({ attemptId: 'a', name: 'Maria', score: 9, timestamp: 1000 }),
    ).toEqual({ valid: false, reason: 'invalid-or-missing-level' });
  });

  it('classifies a 0-100 score row as a candidate (invalid-score)', () => {
    expect(
      classifyForReset({ attemptId: 'a', name: 'Maria', score: 100, level: 1, timestamp: 1000 }),
    ).toEqual({ valid: false, reason: 'invalid-score' });
  });

  it('classifies a non-integer score (9.5) as a candidate', () => {
    expect(
      classifyForReset({ attemptId: 'a', name: 'Maria', score: 9.5, level: 1, timestamp: 1000 }),
    ).toEqual({ valid: false, reason: 'invalid-score' });
  });

  it('classifies a non-integer level (3.2) as a candidate', () => {
    expect(
      classifyForReset({ attemptId: 'a', name: 'Maria', score: 9, level: 3.2, timestamp: 1000 }),
    ).toEqual({ valid: false, reason: 'invalid-or-missing-level' });
  });

  it('classifies an out-of-range level (0 and 11) as a candidate', () => {
    expect(
      classifyForReset({ attemptId: 'a', name: 'Maria', score: 9, level: 0, timestamp: 1000 }),
    ).toEqual({ valid: false, reason: 'invalid-or-missing-level' });
    expect(
      classifyForReset({ attemptId: 'a', name: 'Maria', score: 9, level: 11, timestamp: 1000 }),
    ).toEqual({ valid: false, reason: 'invalid-or-missing-level' });
  });

  it('classifies null/missing blobs and missing core fields as candidates', () => {
    expect(classifyForReset(null)).toEqual({ valid: false, reason: 'null-or-missing-blob' });
    expect(classifyForReset({ attemptId: '', name: 'x', score: 9, level: 1, timestamp: 1 })).toEqual({
      valid: false,
      reason: 'missing-attemptId',
    });
    expect(classifyForReset({ attemptId: 'a', name: '', score: 9, level: 1, timestamp: 1 })).toEqual({
      valid: false,
      reason: 'missing-name',
    });
    expect(
      classifyForReset({ attemptId: 'a', name: 'x', score: 9, level: 1, timestamp: 'bad' }),
    ).toEqual({ valid: false, reason: 'invalid-timestamp' });
  });

  it('accepts boundary scores 0 and 10', () => {
    expect(
      classifyForReset({ attemptId: 'a', name: 'x', score: 0, level: 1, timestamp: 1 }),
    ).toEqual({ valid: true, reason: 'valid' });
    expect(
      classifyForReset({ attemptId: 'a', name: 'x', score: 10, level: 1, timestamp: 1 }),
    ).toEqual({ valid: true, reason: 'valid' });
  });
});

describe('scanLeaderboard', () => {
  it('partitions valid rows and legacy/invalid candidates', async () => {
    const store = fakeStore({
      valid: { attemptId: 'valid', name: 'Maria', score: 9, level: 3, timestamp: 1000 },
      legacy: { attemptId: 'legacy', name: 'Old', score: 85, timestamp: 1000 },
      badlevel: { attemptId: 'badlevel', name: 'Bad', score: 9, level: 0, timestamp: 1000 },
    });
    const result = await scanLeaderboard(store);
    expect(result.total).toBe(3);
    expect(result.valid.map((r) => r.key)).toEqual(['valid']);
    expect(result.candidates.map((r) => r.key).sort()).toEqual(['badlevel', 'legacy']);
  });

  it('reports no candidates for an all-valid store (idempotent precondition)', async () => {
    const store = fakeStore({
      v1: { attemptId: 'v1', name: 'A', score: 9, level: 1, timestamp: 1 },
    });
    const result = await scanLeaderboard(store);
    expect(result.candidates).toEqual([]);
    expect(result.valid).toHaveLength(1);
  });
});

describe('deleteCandidates', () => {
  it('deletes candidate keys and returns the count', async () => {
    const store = fakeStore({
      legacy: { attemptId: 'legacy', name: 'Old', score: 85, timestamp: 1 },
      valid: { attemptId: 'valid', name: 'A', score: 9, level: 1, timestamp: 1 },
    });
    const candidates = [{ key: 'legacy', raw: null, reason: 'invalid-or-missing-level' }];
    const res = await deleteCandidates(store, candidates);
    expect(res.deleted).toBe(1);
    expect(res.failed).toEqual([]);
  });

  it('is idempotent: deleting candidates from an all-valid store is a no-op', async () => {
    const store = fakeStore({
      valid: { attemptId: 'valid', name: 'A', score: 9, level: 1, timestamp: 1 },
    });
    const res = await deleteCandidates(store, []);
    expect(res.deleted).toBe(0);
  });
});

describe('resolveBlobsAccess — documented env modes', () => {
  it('accepts explicit NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN', () => {
    expect(
      resolveBlobsAccess({
        NETLIFY_SITE_ID: 'site-abc',
        NETLIFY_AUTH_TOKEN: 'token-xyz',
      }),
    ).toEqual({
      ok: true,
      mode: 'explicit',
      siteID: 'site-abc',
      token: 'token-xyz',
    });
  });

  it('accepts NETLIFY_BLOBS_STORE_TOKEN as the auth token with site id', () => {
    expect(
      resolveBlobsAccess({
        NETLIFY_SITE_ID: ' site-abc ',
        NETLIFY_BLOBS_STORE_TOKEN: ' store-token ',
      }),
    ).toEqual({
      ok: true,
      mode: 'explicit',
      siteID: 'site-abc',
      token: 'store-token',
    });
  });

  it('accepts NETLIFY_BLOBS_CONTEXT alone (SDK context mode)', () => {
    expect(
      resolveBlobsAccess({
        NETLIFY_BLOBS_CONTEXT: 'base64-context',
      }),
    ).toEqual({ ok: true, mode: 'context' });
  });

  it('prefers context mode when NETLIFY_BLOBS_CONTEXT is set', () => {
    expect(
      resolveBlobsAccess({
        NETLIFY_SITE_ID: 'site-abc',
        NETLIFY_AUTH_TOKEN: 'token-xyz',
        NETLIFY_BLOBS_CONTEXT: 'base64-context',
      }),
    ).toEqual({ ok: true, mode: 'context' });
  });

  it('rejects site id without token and explains the missing credential', () => {
    const result = resolveBlobsAccess({ NETLIFY_SITE_ID: 'site-abc' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error).toMatch(/NETLIFY_AUTH_TOKEN/);
    expect(result.error).toMatch(/NETLIFY_BLOBS_CONTEXT/);
  });

  it('rejects token without site id and explains the missing credential', () => {
    const result = resolveBlobsAccess({ NETLIFY_AUTH_TOKEN: 'token-xyz' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error).toMatch(/NETLIFY_SITE_ID/);
  });

  it('rejects empty env with a full credentials diagnostic', () => {
    const result = resolveBlobsAccess({});
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error).toMatch(/NETLIFY_SITE_ID/);
    expect(result.error).toMatch(/NETLIFY_BLOBS_CONTEXT/);
  });
});

describe('classifyForReset contract — script vs _store (no drift)', () => {
  const fixtures = [
    null,
    undefined,
    { attemptId: '', name: 'x', score: 9, timestamp: 1, level: 1 },
    { attemptId: 'a', name: '', score: 9, timestamp: 1, level: 1 },
    { attemptId: 'a', name: 'Maria', score: 9, timestamp: 1, level: 1 },
    { attemptId: 'a', name: 'Maria', score: 9, timestamp: 1 },
    { attemptId: 'a', name: 'Maria', score: 90, timestamp: 1, level: 1 },
    { attemptId: 'a', name: 'Maria', score: 9.5, timestamp: 1, level: 1 },
    { attemptId: 'a', name: 'Maria', score: 9, timestamp: 1, level: 0 },
    { attemptId: 'a', name: 'Maria', score: 9, timestamp: 1, level: 3.2 },
    { attemptId: 'a', name: 'Maria', score: 11, timestamp: 1, level: 5 },
    { attemptId: 'a', name: 'Maria', score: 0, timestamp: 1, level: 1 },
    { attemptId: 'a', name: 'Maria', score: 10, timestamp: 1, level: 10 },
    { attemptId: 'a', name: 'Maria', score: 9, timestamp: 'bad', level: 1 },
    { attemptId: 'a', name: 'Maria', score: 9, timestamp: Number.NaN, level: 1 },
    { attemptId: 123, name: 'x', score: 9, timestamp: 1, level: 1 },
  ];

  it('agrees on valid flag and reason for every fixture', () => {
    for (const raw of fixtures) {
      // Script accepts unknown; store type is Partial<entry>|null — cast for parity.
      expect(classifyForReset(raw)).toEqual(storeClassifyForReset(raw));
    }
  });
});

describe('writeRollbackSnapshot — snapshot-before-delete (resilience)', () => {
  it('writes a timestamped JSON file with candidate payloads before deletion', () => {
    const written = [];
    const candidates = [
      {
        key: 'legacy-1',
        raw: { attemptId: 'legacy-1', name: 'Old', score: 85, timestamp: 1 },
        reason: 'invalid-score',
      },
      {
        key: 'bad-level',
        raw: { attemptId: 'bad-level', name: 'Bad', score: 9, timestamp: 1, level: 0 },
        reason: 'invalid-or-missing-level',
      },
    ];
    const path = writeRollbackSnapshot(candidates, {
      dir: './__test-rollback-tmp',
      now: () => '2026-07-17T12-00-00-000Z',
      write: (p, data) => written.push({ p, data }),
    });
    expect(written).toHaveLength(1);
    expect(path).toContain('leaderboard-rollback-2026-07-17T12-00-00-000Z.json');
    const parsed = JSON.parse(written[0].data);
    expect(parsed.candidateCount).toBe(2);
    expect(parsed.candidates[0].key).toBe('legacy-1');
    expect(parsed.candidates[0].reason).toBe('invalid-score');
    expect(parsed.candidates[0].payload).toEqual(candidates[0].raw);
    expect(parsed.candidates[1].key).toBe('bad-level');
    expect(parsed.candidates[1].payload).toEqual(candidates[1].raw);
    // Audit metadata.
    expect(parsed.description).toMatch(/rollback/i);
    expect(parsed.timestamp).toBeTruthy();
  });

  it('writes a snapshot even for an empty candidate list (records the no-op)', () => {
    const written = [];
    const path = writeRollbackSnapshot([], {
      dir: './__test-rollback-tmp',
      now: () => 'empty-ts',
      write: (p, data) => written.push({ p, data }),
    });
    expect(written).toHaveLength(1);
    const parsed = JSON.parse(written[0].data);
    expect(parsed.candidateCount).toBe(0);
    expect(parsed.candidates).toEqual([]);
    expect(path).toContain('leaderboard-rollback-empty-ts.json');
  });

  it('captures null payloads (missing blobs) in the snapshot', () => {
    const written = [];
    writeRollbackSnapshot(
      [{ key: 'missing', raw: null, reason: 'null-or-missing-blob' }],
      {
        dir: './__test-rollback-tmp',
        now: () => 'null-ts',
        write: (p, data) => written.push({ p, data }),
      },
    );
    const parsed = JSON.parse(written[0].data);
    expect(parsed.candidates[0].payload).toBeNull();
  });
});

describe('verifyTargetConfirm — wrong-target protection (resilience)', () => {
  const explicit = { ok: true, mode: 'explicit', siteID: 'site-prod', token: 'tok' };

  it('blocks explicit --apply when --confirm-site-id is missing', () => {
    const r = verifyTargetConfirm(explicit, '');
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('expected failure');
    expect(r.error).toMatch(/--confirm-site-id/);
  });

  it('blocks explicit --apply when --confirm-site-id does not match', () => {
    const r = verifyTargetConfirm(explicit, 'site-wrong');
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('expected failure');
    expect(r.error).toMatch(/does not match/);
    expect(r.error).toContain('site-wrong');
    expect(r.error).toContain('site-prod');
  });

  it('allows explicit --apply when --confirm-site-id matches exactly', () => {
    expect(verifyTargetConfirm(explicit, 'site-prod')).toEqual({ ok: true });
  });

  it('does not require --confirm-site-id in context mode (context pins the site)', () => {
    expect(verifyTargetConfirm({ ok: true, mode: 'context' }, '')).toEqual({ ok: true });
  });

  it('blocks when site id has surrounding whitespace mismatch (exact match required)', () => {
    const r = verifyTargetConfirm(explicit, ' site-prod ');
    expect(r.ok).toBe(false);
  });
});