/**
 * Structured error reporting hook for Netlify Functions (resilience: the
 * serverless API previously had only `console.error` visibility).
 *
 * Goals:
 *   - Safe by default: NEVER blocks a response, NEVER throws, NEVER adds
 *     latency beyond a best-effort fire-and-forget `fetch`.
 *   - No paid services or new secrets required. When no reporting endpoint is
 *     configured (the default), it falls back to `console.error` only —
 *     identical to the previous behavior plus a structured shape.
 *   - Optionally reports to an env-configured HTTP endpoint
 *     (`ERROR_REPORT_ENDPOINT`) with a JSON payload. The endpoint is
 *     intentionally opaque — any team-owned logging/webhook URL works.
 *
 * Contract:
 *   `reportError({ functionName, message, error }, env?)`
 *     - Always logs a structured JSON line to `console.error` (visible in
 *       Netlify function logs).
 *     - When `env.ERROR_REPORT_ENDPOINT` is a non-empty string, it also POSTs
 *       a small JSON payload to that URL. The POST is best-effort:
 *       `AbortController` with a short timeout, `catch` swallow, and a
 *       `Promise` the caller can `void`-await so it never blocks the
 *       response.
 *
 * Why not a paid service: the app is a children's English exercise tool with
 * a single serverless backend; introducing Sentry/Datadog requires a secret
 * and a paid plan. A best-effort webhook to any team-owned endpoint keeps it
 * free and self-hosted.
 */

/**
 * Structured error payload. Intentionally minimal — no request bodies (which
 * may contain student names), no stack traces from untrusted callers. The
 * function name + message + error type is enough to triage without leaking
 * PII.
 */
export interface ErrorReport {
  /** Function that raised the error (e.g. "submit-score"). */
  functionName: string;
  /** Short human message (safe, no PII). */
  message: string;
  /** Error name/type when available. */
  errorType?: string;
  /** ISO timestamp of the report. */
  timestamp: string;
}

/**
 * Read the reporting endpoint from an env-like object. Kept separate so tests
 * can inject a mock env. Returns `''` when unset (default — logging only).
 */
export function resolveReportEndpoint(env: Record<string, string | undefined>): string {
  return (env.ERROR_REPORT_ENDPOINT ?? '').trim();
}

/**
 * Resolve the env object for the current runtime. In a Netlify Function, this
 * is `process.env`. In tests (node environment), `process.env` is also
 * available. This indirection avoids referencing `process` directly in the
 * netlify tsconfig (which does not include `@types/node` process globals by
 * default) while still reading the real env at runtime.
 */
function runtimeEnv(): Record<string, string | undefined> {
  const g = globalThis as Record<string, unknown>;
  const p = g.process as { env?: Record<string, string | undefined> } | undefined;
  return p?.env ?? {};
}

/**
 * Report a structured error safely.
 *
 * - ALWAYS logs a structured JSON line to `console.error` (visible in Netlify
 *   function logs regardless of whether an endpoint is configured).
 * - When `env.ERROR_REPORT_ENDPOINT` is set, fires a best-effort POST with a
 *   short timeout. The POST never throws back to the caller and never blocks
 *   the response — return the promise and `void` it, or ignore it.
 *
 * @returns a `Promise<void>` that resolves when the report completes (or
 *          immediately when no endpoint is configured). Never rejects.
 */
export function reportError(
  detail: { functionName: string; message: string; error?: unknown },
  env: Record<string, string | undefined> = runtimeEnv(),
): Promise<void> {
  const report: ErrorReport = {
    functionName: detail.functionName,
    message: detail.message,
    errorType: detail.error instanceof Error ? detail.error.name : undefined,
    timestamp: new Date().toISOString(),
  };

  // Always log structured JSON so the function logs are parseable.
  console.error(JSON.stringify(report));

  const endpoint = resolveReportEndpoint(env);
  if (endpoint.length === 0) {
    // No endpoint configured: logging only. Resolve immediately.
    return Promise.resolve();
  }

  return reportToEndpoint(endpoint, report).catch(() => {
    // Swallow: reporting must never break the response path.
  });
}

/**
 * Best-effort POST to a reporting endpoint. Uses an `AbortController` with a
 * short timeout so a slow/hung logging endpoint never delays the function
 * beyond a bounded window.
 */
async function reportToEndpoint(endpoint: string, report: ErrorReport): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}