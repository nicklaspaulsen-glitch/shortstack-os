"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader, CheckCircle2, AlertCircle } from "lucide-react";

export default function ExtensionAuthPage() {
  return (
    <Suspense>
      <ExtensionAuthInner />
    </Suspense>
  );
}

/**
 * Extension Auth Handshake Page
 *
 * Flow:
 * 1. User clicks "Connect to ShortStack" in the Chrome extension popup
 * 2. Popup opens this page in a new tab with ?ext_id=<extension_id>
 * 3. If the user isn't logged in, we redirect to /login and come back
 * 4. Once logged in, we call /api/extension/generate-token to get the
 *    user's Supabase access token + refresh token
 * 5. We send the tokens to the extension via chrome.runtime.sendMessage
 *    (the extension listens via externally_connectable)
 * 6. The extension stores the tokens in chrome.storage.local and the tab
 *    auto-closes
 *
 * SECURITY:
 * - Only extension IDs we recognize should be trusted (validated via
 *   externally_connectable match list in manifest.json)
 * - Tokens are scoped to the user's existing Supabase session — no new
 *   permanent credentials are minted
 * - Uses chrome.runtime.sendMessage instead of window.postMessage so the
 *   extension's content script isn't required on this page
 */
function ExtensionAuthInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const extId = searchParams?.get("ext_id") ?? null;
  const [status, setStatus] = useState<"checking" | "needs_login" | "handshaking" | "success" | "error">("checking");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      // 1. Check if we have a session
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        setStatus("needs_login");
        // Send them to /login and bounce back here after success
        const redirect = encodeURIComponent(
          `/extension-auth${extId ? `?ext_id=${extId}` : ""}`,
        );
        router.replace(`/login?redirect=${redirect}`);
        return;
      }

      // 2. Fetch the token from our API (server-validated)
      setStatus("handshaking");
      try {
        const res = await fetch("/api/extension/generate-token", { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Token endpoint returned ${res.status}`);
        }
        const tokenData = await res.json();
        if (cancelled) return;

        // 3. Deliver the token to the extension. Chrome lets web pages
        // call chrome.runtime.sendMessage with an extension id if the
        // extension declares that page's origin in externally_connectable.
        // If ext_id wasn't passed, fall back to broadcasting via
        // window.postMessage for dev builds where the popup may have
        // opened this page inside an iframe.
        // `chrome` is only defined when the page is opened by a browser
        // with extension APIs exposed (i.e. Chrome, Edge, Brave).
        const chromeApi = (
          globalThis as unknown as {
            chrome?: {
              runtime?: {
                sendMessage?: (
                  extId: string,
                  message: unknown,
                  cb?: (response: unknown) => void,
                ) => void;
              };
            };
          }
        ).chrome;
        if (extId && chromeApi?.runtime?.sendMessage) {
          await new Promise<void>((resolve) => {
            chromeApi.runtime!.sendMessage!(
              extId,
              { type: "SHORTSTACK_AUTH_TOKEN", payload: tokenData },
              () => resolve(), // we don't fail if the extension isn't listening
            );
          });
        } else if (typeof window !== "undefined" && window.opener) {
          window.opener.postMessage(
            { type: "SHORTSTACK_AUTH_TOKEN", payload: tokenData },
            "*",
          );
        }

        setStatus("success");
        // Auto-close after showing success for 1.5s
        setTimeout(() => {
          if (typeof window !== "undefined") window.close();
        }, 1500);
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [extId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[420px] text-center space-y-6">
        <h1 className="text-xl font-semibold">Connecting ShortStack Extension</h1>

        {status === "checking" && (
          <div className="flex flex-col items-center gap-3 text-muted">
            <Loader className="animate-spin" size={32} />
            <p>Checking your session…</p>
          </div>
        )}

        {status === "needs_login" && (
          <div className="flex flex-col items-center gap-3 text-muted">
            <Loader className="animate-spin" size={32} />
            <p>Redirecting to login…</p>
          </div>
        )}

        {status === "handshaking" && (
          <div className="flex flex-col items-center gap-3 text-muted">
            <Loader className="animate-spin" size={32} />
            <p>Handshaking with the extension…</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-3 text-success">
            <CheckCircle2 size={40} />
            <p className="text-foreground">Extension connected! You can close this tab.</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-3 text-error">
            <AlertCircle size={40} />
            <p className="text-foreground">Connection failed.</p>
            {errorMsg && <p className="text-xs text-muted max-w-xs">{errorMsg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
