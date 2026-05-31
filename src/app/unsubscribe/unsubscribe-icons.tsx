"use client";

/**
 * Client component wrapper for Phosphor icons used in the unsubscribe page.
 * Isolation is necessary because @phosphor-icons/react calls
 * React.createContext() at module init, which crashes Next.js "Collecting
 * page data" phase when the import lives in a Server Component.
 *
 * See fix(build) 563006e3 — same pattern fixed for /getting-started.
 */
export { CheckCircle, Envelope, XCircle } from "@phosphor-icons/react";
