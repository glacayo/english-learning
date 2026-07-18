#!/usr/bin/env node
/**
 * reset-leaderboard.mjs — selective, idempotent leaderboard Blob cleanup.
 *
 * Runs BEFORE level-aware writes begin (pre-go-live). Lists the `leaderboard`
 * Blobs store and deletes ONLY legacy/invalid rows. Valid level-aware rows
 * (integer `score` 0–10 + integer `level` 1–10) are NEVER deleted, so the
 * script is safe to re-run after children start submitting — a re-run is a
 * no-op once only valid rows remain (shared-leaderboard spec "Leaderboard
 * Reset On Deploy"; netlify-deployment spec "Leaderboard Blob Cleanup On
 * Deploy").
 *
 * Why not full wipe: a post-deploy full wipe would destroy new 0–10 rows if
 * re-run after children submit. Selective delete keeps valid rows.
 *
 * === Modes ===
 *   node scripts/reset-leaderboard.mjs --dry-run   (default) list candidates; delete nothing
 *   node scripts/reset-leaderboard.mjs --apply     delete legacy/invalid rows
 *
 *   --apply REQUIRES --confirm-site-id=<id> in explicit mode (NETLIFY_SITE_ID +
 *   token). The value MUST match the resolved NETLIFY_SITE_ID exactly. This
 *   prevents running --apply against the wrong target (wrong-target/ungated
 *   protection). In context mode (NETLIFY_BLOBS_CONTEXT) the context already
 *   pins the site, so --confirm-site-id is not required.
 *
 * === Rollback snapshot ===
 *   --apply writes a timestamped JSON snapshot of deleted candidate payloads
 *   to ./rollback-snapshots/leaderboard-rollback-<timestamp>.json BEFORE any
 *   deletion. Because deletion is irreversible, this file is the audit and
 *   recovery-by-reference artifact.
 *
 * === Required env / site context ===
 * Netlify site + Blobs credentials for the TARGET site. Provide either:
 *   - NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN (or NETLIFY_BLOBS_STORE_TOKEN), OR
 *   - NETLIFY_BLOBS_CONTEXT (Base64 JSON context used by the Blobs SDK).
 * Run against the intended site only (preview vs production explicit).
 *
 *   NETLIFY_SITE_ID=<site-id> NETLIFY_AUTH_TOKEN=<token> \
 *     node scripts/reset-leaderboard.mjs --apply --confirm-site-id=<site-id>
 *
 * Explicit mode passes `{ name, siteID, token }` into `getStore` (required by
 * @netlify/blobs outside a deployed function). Context mode relies on the SDK
 * reading `NETLIFY_BLOBS_CONTEXT`. Partial env (site without token, or token
 * without site) is rejected with a diagnostic before any Blobs call.
 * `names` store is untouched.
 *
 * === Idempotent ===
 * Re-running after a successful apply reports 0 candidates and deletes
 * nothing — valid level-aware rows survive every re-run.
 *
 * === Rollback ===
 * --apply snapshots deleted candidate payloads to a timestamped JSON file in
 * ./rollback-snapshots/ BEFORE deletion. The script never rescales or
 * migrates a legacy row; deletion is irreversible (shared-leaderboard spec:
 * "legacy rows MUST NOT be migrated, rescaled, or displayed after the
 * reset"). The snapshot is the audit/recovery-by-reference artifact.
 */

import { getStore } from '@netlify/blobs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyForReset } from '../netlify/functions/leaderboard-classifier.mjs';

export { classifyForReset } from '../netlify/functions/leaderboard-classifier.mjs';

const LEADERBOARD_STORE = 'leaderboard';

/**
 * List every leaderboard blob and partition into { valid, candidates }.
 *
 * `getStoreFromEnv` is injected so tests can pass a fake store; the CLI uses
 * the real Netlify Blobs store resolved from env.
 */
export async function scanLeaderboard(store) {
  const valid = [];
  const candidates = [];
  const keys = [];
  for await (const page of store.list({ paginate: true })) {
    for (const blob of page.blobs) keys.push(blob.key);
  }
  for (const key of keys) {
    const raw = await store.get(key, { type: 'json', consistency: 'strong' });
    const verdict = classifyForReset(raw);
    const row = { key, raw: raw ?? null, reason: verdict.reason };
    if (verdict.valid) {
      valid.push(row);
    } else {
      candidates.push(row);
    }
  }
  return { valid, candidates, total: keys.length };
}

/**
 * Delete a list of candidate keys from the store. Returns the count actually
 * removed. Failures are collected but do not abort the whole pass (best-effort
 * cleanup); the caller can re-run idempotently.
 */
export async function deleteCandidates(store, candidates) {
  let deleted = 0;
  const failed = [];
  for (const c of candidates) {
    try {
      await store.delete(c.key);
      deleted += 1;
    } catch (err) {
      failed.push({ key: c.key, error: String(err) });
    }
  }
  return { deleted, failed };
}

/**
 * Snapshot candidate payloads to a timestamped JSON rollback/audit file BEFORE
 * any deletion. Because deletion is irreversible (shared-leaderboard spec:
 * "legacy rows MUST NOT be migrated, rescaled, or displayed after the reset"),
 * this artifact is the only recovery reference.
 *
 * The file is written synchronously before the delete pass starts so a crash
 * mid-delete still leaves a complete snapshot. Returns the file path so the
 * CLI can print it.
 *
 * @param {Array<{ key: string; raw: unknown; reason: string }>} candidates
 * @param {object} [opts] — overrides for testing
 * @param {string} [opts.dir] — snapshot directory (default: `./rollback-snapshots`)
 * @param {() => string} [opts.now] — timestamp factory (default: ISO string)
 * @param {typeof writeFileSync} [opts.write] — write function (default: fs)
 * @returns {string} the snapshot file path
 */
export function writeRollbackSnapshot(candidates, opts = {}) {
  const dir = opts.dir ?? resolve(process.cwd(), 'rollback-snapshots');
  const now = opts.now ?? (() => new Date().toISOString().replace(/[:.]/g, '-'));
  const write = opts.write ?? writeFileSync;
  const ts = now();
  const filename = `leaderboard-rollback-${ts}.json`;
  const filepath = resolve(dir, filename);

  const snapshot = {
    timestamp: new Date().toISOString(),
    description:
      'Rollback snapshot of leaderboard rows deleted by reset-leaderboard --apply. ' +
      'These rows were classified as legacy/invalid and deleted. To restore, ' +
      're-create each blob key with its `raw` payload.',
    candidateCount: candidates.length,
    candidates: candidates.map((c) => ({
      key: c.key,
      reason: c.reason,
      payload: c.raw,
    })),
  };

  mkdirSync(dir, { recursive: true });
  write(filepath, JSON.stringify(snapshot, null, 2), 'utf-8');
  return filepath;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { mode: 'dry-run', selfTest: false, confirmSiteId: '' };
  for (const a of argv.slice(2)) {
    if (a === '--apply') args.mode = 'apply';
    else if (a === '--dry-run') args.mode = 'dry-run';
    else if (a === '--self-test') args.selfTest = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('--confirm-site-id=')) args.confirmSiteId = a.slice('--confirm-site-id='.length).trim();
  }
  return args;
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: node scripts/reset-leaderboard.mjs [--dry-run|--apply] [--self-test] [--confirm-site-id=<site-id>]',
      '',
      '  --dry-run              List legacy/invalid leaderboard rows; delete nothing (default).',
      '  --apply                Delete only legacy/invalid rows. Valid level-aware rows survive.',
      '  --confirm-site-id=<id> REQUIRED with --apply in explicit mode: must match the resolved NETLIFY_SITE_ID.',
      '                         Prevents running --apply against the wrong target. In context mode (NETLIFY_BLOBS_CONTEXT)',
      '                         this flag is not required (the context already pins the site).',
      '  --self-test            Run the classification unit checks and exit.',
      '  --help                 Show this help.',
      '',
      'Rollback: --apply writes a timestamped JSON snapshot of deleted candidate payloads to ./rollback-snapshots/',
      '          BEFORE any deletion, so the operation is auditable and recoverable by reference.',
      '',
      'Env (one of):',
      '  NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN (or NETLIFY_BLOBS_STORE_TOKEN)',
      '  NETLIFY_BLOBS_CONTEXT',
      '  The `names` store is never touched.',
      '',
    ].join('\n'),
  );
}

/**
 * Resolve how the script should open the leaderboard Blobs store.
 *
 * @netlify/blobs accepts:
 *   - explicit API access: `getStore({ name, siteID, token })`
 *   - deploy/context access: `getStore(name)` when `NETLIFY_BLOBS_CONTEXT` is set
 *
 * Exported for unit tests (env guard diagnostics without network I/O).
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {{
 *   ok: true,
 *   mode: 'explicit',
 *   siteID: string,
 *   token: string,
 * } | {
 *   ok: true,
 *   mode: 'context',
 * } | {
 *   ok: false,
 *   error: string,
 * }}
 */
export function resolveBlobsAccess(env = process.env) {
  const siteID = (env.NETLIFY_SITE_ID ?? '').trim();
  const token = (
    env.NETLIFY_AUTH_TOKEN ??
    env.NETLIFY_BLOBS_STORE_TOKEN ??
    ''
  ).trim();
  const blobsContext = (env.NETLIFY_BLOBS_CONTEXT ?? '').trim();

  if (blobsContext) {
    return { ok: true, mode: 'context' };
  }
  if (siteID && token) {
    return { ok: true, mode: 'explicit', siteID, token };
  }
  if (siteID && !token) {
    return {
      ok: false,
      error:
        'ERROR: NETLIFY_SITE_ID is set but no auth token was found. Set ' +
        'NETLIFY_AUTH_TOKEN (or NETLIFY_BLOBS_STORE_TOKEN) for the TARGET site. ' +
        'Alternatively set NETLIFY_BLOBS_CONTEXT.\n',
    };
  }
  if (token && !siteID) {
    return {
      ok: false,
      error:
        'ERROR: An auth token is set but NETLIFY_SITE_ID is missing. Set both ' +
        'NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN (or NETLIFY_BLOBS_STORE_TOKEN) ' +
        'for the TARGET site. Alternatively set NETLIFY_BLOBS_CONTEXT.\n',
    };
  }
  return {
    ok: false,
    error:
      'ERROR: Netlify Blobs credentials required. Set NETLIFY_SITE_ID + ' +
      'NETLIFY_AUTH_TOKEN (or NETLIFY_BLOBS_STORE_TOKEN), or set ' +
      'NETLIFY_BLOBS_CONTEXT, for the TARGET site (preview vs production explicit).\n',
  };
}

/**
 * Validate env and exit(2) with a diagnostic when credentials are incomplete.
 * Returns the resolved access descriptor for `getStoreFromEnv`.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 */
export function requireEnv(env = process.env) {
  const access = resolveBlobsAccess(env);
  if (!access.ok) {
    process.stderr.write(access.error);
    process.exit(2);
  }
  return access;
}

/**
 * Verify that `--confirm-site-id=<id>` matches the resolved target site id.
 *
 * Destructive `--apply` in explicit mode (NETLIFY_SITE_ID + token) MUST pass
 * this gate so an operator cannot accidentally wipe the wrong site. The
 * confirmed value MUST equal the resolved `access.siteID` exactly (after
 * trim). In context mode (NETLIFY_BLOBS_CONTEXT) the context already pins the
 * site, so this gate is not required.
 *
 * Returns `{ ok: true }` when the confirmation matches (or when mode is
 * `context` and no confirmation is needed), or `{ ok: false, error }` with a
 * diagnostic. Exported for unit tests.
 *
 * @param {{ ok: true; mode: string; siteID?: string }} access
 * @param {string} confirmSiteId
 * @returns {{ ok: true } | { ok: false; error: string }}
 */
export function verifyTargetConfirm(access, confirmSiteId) {
  if (access.mode === 'context') {
    // Context mode pins the site via NETLIFY_BLOBS_CONTEXT; no explicit
    // confirmation needed.
    return { ok: true };
  }
  if (access.mode === 'explicit') {
    if (confirmSiteId.length === 0) {
      return {
        ok: false,
        error:
          'ERROR: --apply requires --confirm-site-id=<id> in explicit mode to ' +
          'prevent running against the wrong target. The value MUST match the ' +
          'resolved NETLIFY_SITE_ID.\n',
      };
    }
    if (confirmSiteId !== access.siteID) {
      return {
        ok: false,
        error:
          `ERROR: --confirm-site-id="${confirmSiteId}" does not match the ` +
          `resolved NETLIFY_SITE_ID="${access.siteID}". Aborting before any ` +
          `destructive action. Re-check the target site id.\n`,
      };
    }
    return { ok: true };
  }
  return { ok: true };
}

/**
 * Open the leaderboard store using documented env credentials.
 *
 * Explicit mode always passes `{ name, siteID, token }` — required by
 * @netlify/blobs outside a function runtime. Context mode uses the store name
 * only so the SDK can read `NETLIFY_BLOBS_CONTEXT`.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 */
export function getStoreFromEnv(env = process.env) {
  const access = resolveBlobsAccess(env);
  if (!access.ok) {
    throw new Error(access.error.trim());
  }
  if (access.mode === 'explicit') {
    return getStore({
      name: LEADERBOARD_STORE,
      siteID: access.siteID,
      token: access.token,
    });
  }
  // NETLIFY_BLOBS_CONTEXT present — SDK reads site/token from that context.
  return getStore(LEADERBOARD_STORE);
}

function summarize(result) {
  process.stdout.write(
    [
      `Leaderboard scan: ${result.total} total blob(s).`,
      `  valid level-aware rows: ${result.valid.length}`,
      `  legacy/invalid candidates: ${result.candidates.length}`,
      '',
    ].join('\n'),
  );
  if (result.candidates.length > 0) {
    process.stdout.write('Candidate rows (would be deleted on --apply):\n');
    for (const c of result.candidates) {
      const name = c.raw && typeof c.raw === 'object' && 'name' in c.raw ? String(c.raw.name) : '?';
      const score = c.raw && typeof c.raw === 'object' && 'score' in c.raw ? c.raw.score : '?';
      process.stdout.write(
        `  key=${c.key} name=${name} score=${score} reason=${c.reason}\n`,
      );
    }
    process.stdout.write('\n');
  }
}

function selfTest() {
  let failures = 0;
  const cases = [
    { raw: null, expect: false },
    { raw: { attemptId: '', name: 'x', score: 9, timestamp: 1, level: 1 }, expect: false },
    { raw: { attemptId: 'a', name: 'Maria', score: 9, timestamp: 1, level: 1 }, expect: true },
    { raw: { attemptId: 'a', name: 'Maria', score: 9, timestamp: 1 }, expect: false }, // missing level
    { raw: { attemptId: 'a', name: 'Maria', score: 90, timestamp: 1, level: 1 }, expect: false }, // legacy 0-100
    { raw: { attemptId: 'a', name: 'Maria', score: 9.5, timestamp: 1, level: 1 }, expect: false }, // non-integer score
    { raw: { attemptId: 'a', name: 'Maria', score: 9, timestamp: 1, level: 0 }, expect: false }, // level out of range
    { raw: { attemptId: 'a', name: 'Maria', score: 9, timestamp: 1, level: 3.2 }, expect: false }, // non-integer level
    { raw: { attemptId: 'a', name: 'Maria', score: 11, timestamp: 1, level: 5 }, expect: false }, // score out of range
  ];
  for (const c of cases) {
    const v = classifyForReset(c.raw);
    if (v.valid !== c.expect) {
      failures += 1;
      process.stderr.write(`FAIL classifyForReset(${JSON.stringify(c.raw)}) => valid=${v.valid} (${v.reason}), expected ${c.expect}\n`);
    }
  }

  // verifyTargetConfirm checks (resilience: wrong-target protection).
  const explicit = { ok: true, mode: 'explicit', siteID: 'site-prod', token: 'tok' };
  // 10a: explicit apply without --confirm-site-id → blocked.
  {
    const r = verifyTargetConfirm(explicit, '');
    if (r.ok !== false) { failures += 1; process.stderr.write('FAIL verifyTargetConfirm(explicit, "") should be blocked\n'); }
  }
  // 10b: explicit apply with mismatching confirm → blocked.
  {
    const r = verifyTargetConfirm(explicit, 'site-wrong');
    if (r.ok !== false) { failures += 1; process.stderr.write('FAIL verifyTargetConfirm(explicit, "site-wrong") should be blocked\n'); }
  }
  // 10c: explicit apply with matching confirm → ok.
  {
    const r = verifyTargetConfirm(explicit, 'site-prod');
    if (r.ok !== true) { failures += 1; process.stderr.write('FAIL verifyTargetConfirm(explicit, "site-prod") should pass\n'); }
  }
  // 10d: context mode never requires confirmation.
  {
    const r = verifyTargetConfirm({ ok: true, mode: 'context' }, '');
    if (r.ok !== true) { failures += 1; process.stderr.write('FAIL verifyTargetConfirm(context, "") should pass\n'); }
  }

  // writeRollbackSnapshot check (resilience: snapshot-before-delete).
  {
    const written = [];
    const path = writeRollbackSnapshot(
      [{ key: 'k1', raw: { attemptId: 'k1', name: 'Old', score: 85, timestamp: 1 }, reason: 'invalid-score' }],
      {
        dir: './__rollback-self-test-tmp',
        now: () => 'fixed-ts',
        write: (p, data) => { written.push({ p, data }); },
      },
    );
    if (written.length !== 1) { failures += 1; process.stderr.write('FAIL writeRollbackSnapshot should write one file\n'); }
    const parsed = JSON.parse(written[0].data);
    if (parsed.candidateCount !== 1 || parsed.candidates[0].key !== 'k1') {
      failures += 1; process.stderr.write('FAIL writeRollbackSnapshot payload mismatch\n');
    }
    if (!path.endsWith('leaderboard-rollback-fixed-ts.json')) {
      failures += 1; process.stderr.write(`FAIL writeRollbackSnapshot path: ${path}\n`);
    }
  }

  if (failures > 0) {
    process.stderr.write(`${failures} self-test check(s) failed.\n`);
    process.exit(1);
  }
  process.stdout.write(`self-test OK (${cases.length} classification checks + 6 guard checks)\n`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }
  if (args.selfTest) {
    selfTest();
    return;
  }
  const access = requireEnv();

  // Destructive --apply target confirmation gate (resilience: wrong-target
  // protection). In explicit mode, --confirm-site-id MUST match the resolved
  // NETLIFY_SITE_ID exactly. Context mode pins the site already.
  if (args.mode === 'apply') {
    const confirm = verifyTargetConfirm(access, args.confirmSiteId);
    if (!confirm.ok) {
      process.stderr.write(confirm.error);
      process.exit(2);
    }
  }

  const store = getStoreFromEnv();
  process.stdout.write(
    `Mode: ${args.mode} (blobs access: ${access.mode}${
      access.mode === 'explicit' ? `, siteID=${access.siteID}` : ''
    })\n`,
  );
  const result = await scanLeaderboard(store);
  summarize(result);
  if (args.mode !== 'apply') {
    process.stdout.write('Dry-run: no rows deleted. Re-run with --apply to delete the candidates.\n');
    return;
  }
  if (result.candidates.length === 0) {
    process.stdout.write('Nothing to delete — store already clean (idempotent no-op).\n');
    return;
  }

  // Resilience: snapshot candidate payloads to a timestamped JSON file BEFORE
  // any deletion so the irreversible operation is auditable and recoverable
  // by reference.
  const snapshotPath = writeRollbackSnapshot(result.candidates);
  process.stdout.write(`Rollback snapshot written: ${snapshotPath}\n`);

  const { deleted, failed } = await deleteCandidates(store, result.candidates);
  process.stdout.write(`Deleted ${deleted} legacy/invalid row(s).\n`);
  if (failed.length > 0) {
    process.stderr.write(`${failed.length} deletion(s) failed; re-run --apply (idempotent):\n`);
    for (const f of failed) process.stderr.write(`  key=${f.key} error=${f.error}\n`);
    process.stderr.write(`Rollback snapshot preserved at: ${snapshotPath}\n`);
    process.exit(1);
  }
}

// Only run the CLI when this file is the entry point, not when imported as a
// module (e.g. by tests importing classifyForReset / scanLeaderboard).
import { argv } from 'node:process';

const isMain = fileURLToPath(import.meta.url) === argv[1];

if (isMain) {
  main().catch((err) => {
    console.error('[reset-leaderboard] failed', err);
    process.exit(1);
  });
}
