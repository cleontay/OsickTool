/** Fetch with a timeout, aborting cleanly and never throwing on non-2xx (callers check res.ok). */
export async function fetchWithTimeout(
  url: string,
  opts: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 8000, ...rest } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Combine caller-provided signal (e.g. "cancel whole search") with our timeout.
  const externalSignal = rest.signal;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T = unknown>(
  url: string,
  opts: RequestInit & { timeoutMs?: number } = {},
): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(url, opts);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Small helper to safely run a connector and never let one bad source break the whole search. */
export async function safe<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

let idCounter = 0;
export function nextId(): string {
  idCounter += 1;
  return `f${Date.now().toString(36)}${idCounter}`;
}

const SECRET_PARAM_NAMES = ['key', 'api_key', 'access_key', 'apikey', 'token'];

/** Strips API key/token query params before a URL is shown in the UI or
 * included in a raw-response export - the response body itself never
 * contains the caller's key, but the request URL does. */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const name of SECRET_PARAM_NAMES) {
      if (parsed.searchParams.has(name)) parsed.searchParams.set(name, 'REDACTED');
    }
    return parsed.toString();
  } catch {
    return url;
  }
}
