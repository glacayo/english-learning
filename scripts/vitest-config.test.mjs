import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Guard: verify the vitest config hard-fails on `.only` tests.
 *
 * Context7 confirms Vitest's `allowOnly: false` makes the suite fail when a
 * test or suite is marked `.only` (the default is `!process.env.CI`, which
 * lets `.only` pass silently in local runs). This test reads the config source
 * so the guard is not dependent on running a child process.
 *
 * It does NOT create temp files: it statically asserts the config property is
 * set to `false`, which is the mechanism that makes `.only` fail. A dynamic
 * spawn-vitest test would require writing a temp `.only` test file and cleaning
 * it up; the static assertion is sufficient and leaves no artifacts.
 */
describe('vitest config — focused-test guard (allowOnly)', () => {
  it('explicitly sets allowOnly: false so .only tests fail even locally', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const configPath = resolve(here, '..', 'vitest.config.ts');
    const config = readFileSync(configPath, 'utf-8');
    // The config MUST contain an explicit allowOnly: false (not rely on the
    // CI env default).
    expect(config).toMatch(/allowOnly:\s*false/);
  });
});