"use client";

import { useEffect } from "react";

/**
 * Fire-and-forget view logger. POSTs once on mount; ignores failures.
 * Renders nothing.
 */
export default function ViewLogger({ slug }: { slug: string }) {
  useEffect(() => {
    const controller = new AbortController();
    const url = `/api/showcase/public/${encodeURIComponent(slug)}/view`;
    const body = JSON.stringify({ referrer: typeof document !== "undefined" ? document.referrer : null });
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
      keepalive: true,
    }).catch(() => { /* silent */ });
    return () => controller.abort();
  }, [slug]);
  return null;
}
