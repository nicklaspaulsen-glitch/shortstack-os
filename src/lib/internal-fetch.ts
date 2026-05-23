/**
 * Shared internal fetch helper with retry + exponential backoff.
 *
 * Used by the Zernio webhook and cron handler to call internal API routes
 * (leadgen/qualify, leadgen/onboard, etc.) with automatic retry on 5xx
 * errors and network failures. Never retries 4xx (client errors).
 */

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";

export interface InternalFetchResult {
  ok: boolean;
  status?: number;
  data: Record<string, unknown>;
}

export async function internalPost(
  path: string,
  body: Record<string, unknown>,
  options?: { retries?: number; timeoutMs?: number },
): Promise<InternalFetchResult> {
  const { retries = 2, timeoutMs = 90_000 } = options ?? {};
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    return { ok: false, data: { error: "WEBHOOK_SECRET not configured" } };
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${APP_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-key": webhookSecret,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (res.ok) return { ok: true, status: res.status, data };

      // Don't retry 4xx — those are caller errors, retrying won't help
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, status: res.status, data };
      }

      // 5xx — will retry
      lastError = data;
    } catch (err) {
      lastError = err;
    }

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }

  return {
    ok: false,
    data: {
      error:
        lastError instanceof Error
          ? lastError.message
          : "Internal fetch failed after retries",
      retries_exhausted: true,
    },
  };
}
