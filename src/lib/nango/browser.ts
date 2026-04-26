/**
 * Nango client-side connect-flow helper.
 *
 * Wraps `@nangohq/frontend` so call sites get a single Promise-returning
 * `connectIntegration(...)` instead of dealing with the SDK directly.
 *
 * Why a wrapper:
 * - Centralized public-key lookup (NEXT_PUBLIC_NANGO_PUBLIC_KEY).
 * - Consistent error shape across all integrations.
 * - Lazy SDK init on first call — the popup logic shouldn't run during SSR.
 *
 * Usage:
 *
 *   const result = await connectIntegration({
 *     integrationId: "google-zanb",
 *     connectionId:  `${userId}-google-zanb`,
 *   });
 *
 *   // Then on the server, look up credentials with getCredentials(...).
 *
 * The Nango popup handles the OAuth dance entirely — no callback route on
 * our side, no token storage, no refresh logic.
 */

"use client";

import NangoFrontend from "@nangohq/frontend";

export interface ConnectIntegrationParams {
  /** The Nango integration ID (e.g. `google-zanb`, `facebook`, `apify`). */
  integrationId: string;
  /** The Nango connection ID — convention: `${user_id}-${integration_id}`. */
  connectionId: string;
  /** Optional metadata sent to Nango with the auth request. */
  metadata?: Record<string, unknown>;
  /** Optional success callback (the Promise also resolves on success). */
  onSuccess?: (result: ConnectIntegrationResult) => void;
  /** Optional error callback (the Promise also rejects on error). */
  onError?: (err: ConnectIntegrationError) => void;
}

export interface ConnectIntegrationResult {
  integrationId: string;
  connectionId: string;
}

export class ConnectIntegrationError extends Error {
  public readonly type: "missing_public_key" | "user_cancelled" | "auth_failed" | "unknown";

  constructor(
    type: ConnectIntegrationError["type"],
    message: string,
  ) {
    super(message);
    this.name = "ConnectIntegrationError";
    this.type = type;
  }
}

let _nango: NangoFrontend | null = null;

function getNangoFrontend(): NangoFrontend {
  if (_nango) return _nango;

  const publicKey = process.env.NEXT_PUBLIC_NANGO_PUBLIC_KEY;
  if (!publicKey) {
    throw new ConnectIntegrationError(
      "missing_public_key",
      "NEXT_PUBLIC_NANGO_PUBLIC_KEY is not set. Add it to your .env.local and Vercel project.",
    );
  }

  _nango = new NangoFrontend({ publicKey });
  return _nango;
}

/** Triggers the Nango OAuth popup for the given integration. Resolves on
 *  success, rejects on error / user-cancel. The `onSuccess` / `onError`
 *  callbacks are convenience wrappers — the Promise alone is enough to drive
 *  most flows. */
export async function connectIntegration(
  params: ConnectIntegrationParams,
): Promise<ConnectIntegrationResult> {
  const { integrationId, connectionId, metadata, onSuccess, onError } = params;

  let nango: NangoFrontend;
  try {
    nango = getNangoFrontend();
  } catch (err) {
    const error =
      err instanceof ConnectIntegrationError
        ? err
        : new ConnectIntegrationError("unknown", err instanceof Error ? err.message : String(err));
    onError?.(error);
    throw error;
  }

  try {
    await nango.auth(integrationId, connectionId, {
      params: metadata as Record<string, string> | undefined,
    });

    const result: ConnectIntegrationResult = { integrationId, connectionId };
    onSuccess?.(result);
    return result;
  } catch (err) {
    const error = mapNangoError(err);
    onError?.(error);
    throw error;
  }
}

function mapNangoError(err: unknown): ConnectIntegrationError {
  // Nango's frontend SDK throws AuthError with a `type` field when the popup
  // closes / the upstream provider returns an error. We normalize that here.
  if (err && typeof err === "object" && "type" in err) {
    const errObj = err as { type: unknown; message?: unknown };
    const t = String(errObj.type || "");
    if (t === "user_cancelled" || t === "windowClosed") {
      return new ConnectIntegrationError("user_cancelled", "Connection cancelled");
    }
    return new ConnectIntegrationError("auth_failed", String(errObj.message || t));
  }
  return new ConnectIntegrationError(
    "unknown",
    err instanceof Error ? err.message : String(err),
  );
}
