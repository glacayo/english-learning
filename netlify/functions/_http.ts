import { reportError } from './_report-error';

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function withStoreReporting(
  functionName: string,
  work: () => Promise<Response>,
  errorBody: unknown,
): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    void reportError({ functionName, message: 'store operation failed', error: err });
    return json(errorBody, 500);
  }
}
