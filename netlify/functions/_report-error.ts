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
 */

export interface ErrorReport {
  functionName: string;
  message: string;
  errorType?: string;
  timestamp: string;
}

export function resolveReportEndpoint(env: Record<string, string | undefined>): string {
  return (env.ERROR_REPORT_ENDPOINT ?? '').trim();
}

function runtimeEnv(): Record<string, string | undefined> {
  const g = globalThis as Record<string, unknown>;
  const p = g.process as { env?: Record<string, string | undefined> } | undefined;
  return p?.env ?? {};
}

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

  console.error(JSON.stringify(report));

  const endpoint = resolveReportEndpoint(env);
  if (endpoint.length === 0) {
    return Promise.resolve();
  }

  return reportToEndpoint(endpoint, report).catch(() => {
    // Swallow: reporting must never break the response path.
  });
}

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
