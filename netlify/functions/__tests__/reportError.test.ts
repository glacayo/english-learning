import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { reportError, resolveReportEndpoint } from '../_report-error';

describe('resolveReportEndpoint', () => {
  it('returns the trimmed endpoint when ERROR_REPORT_ENDPOINT is set', () => {
    expect(
      resolveReportEndpoint({ ERROR_REPORT_ENDPOINT: ' https://log.test/ingest ' }),
    ).toBe('https://log.test/ingest');
  });

  it('returns empty string when ERROR_REPORT_ENDPOINT is unset', () => {
    expect(resolveReportEndpoint({})).toBe('');
  });

  it('returns empty string for whitespace-only value', () => {
    expect(resolveReportEndpoint({ ERROR_REPORT_ENDPOINT: '   ' })).toBe('');
  });
});

describe('reportError', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('always logs a structured JSON line to console.error (no endpoint needed)', async () => {
    await reportError(
      { functionName: 'submit-score', message: 'store down', error: new Error('boom') },
      {},
    );
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logged = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logged) as {
      functionName: string;
      message: string;
      errorType?: string;
      timestamp: string;
    };
    expect(parsed.functionName).toBe('submit-score');
    expect(parsed.message).toBe('store down');
    expect(parsed.errorType).toBe('Error');
    expect(typeof parsed.timestamp).toBe('string');
    // ISO timestamp shape.
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('resolves immediately when no endpoint is configured (logging only)', async () => {
    // No fetch mock needed — it should NOT call fetch at all.
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await reportError(
      { functionName: 'test', message: 'no endpoint' },
      {},
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('best-effort POSTs to the endpoint when configured and never rejects', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }));
    await reportError(
      { functionName: 'get-leaderboard', message: 'store down' },
      { ERROR_REPORT_ENDPOINT: 'https://log.test/ingest' },
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://log.test/ingest');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(init?.body as string) as { functionName: string };
    expect(body.functionName).toBe('get-leaderboard');
    fetchSpy.mockRestore();
  });

  it('swallows fetch failures so the caller response is never broken', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network down'));
    // Must NOT throw.
    await expect(
      reportError(
        { functionName: 'submit-score', message: 'store down' },
        { ERROR_REPORT_ENDPOINT: 'https://log.test/ingest' },
      ),
    ).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Structured log still happened.
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('reports errorType as undefined when error is not an Error instance', async () => {
    await reportError(
      { functionName: 'test', message: 'weird', error: 'string-error' },
      {},
    );
    const logged = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logged) as { errorType?: string };
    expect(parsed.errorType).toBeUndefined();
  });
});
