import { describe, expect, it } from 'vitest';
import { resolveAttemptName } from '../App';
import type { ApiResult } from '../api/client';
import type { ClaimNameResponse } from '../domain/types';

describe('resolveAttemptName', () => {
  it('uses the canonical name returned by a successful claim (retake spelling)', () => {
    const claim: ApiResult<ClaimNameResponse> = {
      ok: true,
      value: { ok: true, name: 'Maria' },
    };
    // Child typed different casing; server reserved first spelling.
    expect(resolveAttemptName('maria', claim)).toEqual({
      ok: true,
      name: 'Maria',
      nameClaimKey: 'maria',
    });
  });

  it('uses the trimmed typed name and derived claim key when the claim API is unavailable', () => {
    const claim: ApiResult<ClaimNameResponse> = {
      ok: false,
      reason: 'unavailable',
      message: 'No se pudo conectar con el servidor. Mostrando resultados locales.',
    };
    expect(resolveAttemptName('  Maria  ', claim)).toEqual({
      ok: true,
      name: 'Maria',
      nameClaimKey: 'maria',
      notice: 'No se pudo conectar con el servidor. Mostrando resultados locales.',
    });
  });

  it('blocks start when the server rejects the name as invalid', () => {
    const claim: ApiResult<ClaimNameResponse> = {
      ok: true,
      value: { ok: false, reason: 'invalid' },
    };
    expect(resolveAttemptName('Maria', claim)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('falls back to the typed name if a successful claim omits name', () => {
    const claim: ApiResult<ClaimNameResponse> = {
      ok: true,
      value: { ok: true },
    };
    expect(resolveAttemptName('Maria', claim)).toEqual({
      ok: true,
      name: 'Maria',
      nameClaimKey: 'maria',
    });
  });

  it('nameClaimKey is the normalized (trim + case-fold) identity', () => {
    const claim: ApiResult<ClaimNameResponse> = {
      ok: true,
      value: { ok: true, name: '  Ana  ' },
    };
    const resolved = resolveAttemptName('ANA', claim);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.nameClaimKey).toBe('ana');
  });
});
