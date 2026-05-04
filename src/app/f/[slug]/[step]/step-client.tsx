"use client";

/**
 * Public funnel step — client shell.
 *
 * Renders the step's `page_doc` and tracks a single `view` event on
 * mount. Submit / CTA-click events are tracked via the public event
 * endpoint and (when next step exists) hard-navigate to the next step
 * in the funnel.
 *
 * Visitor id: persisted in localStorage so a single visitor walking
 * through 5 steps reads as one journey for funnel analytics.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import createDOMPurify, { type Config as DOMPurifyConfig, type WindowLike } from "dompurify";

// ── DOMPurify initialisation (SSR-safe) ───────────────────────────────────────
// DOMPurify 3.x needs a DOM window. In the browser it uses the global; in Node.js
// (Next.js SSR pre-render) we provide a JSDOM window so the server can also emit
// sanitized HTML rather than a blank stub that flashes in on hydration.
function buildDOMPurify() {
  if (typeof window !== "undefined") {
    return createDOMPurify(window as unknown as WindowLike);
  }
  // @types/jsdom not installed — type the minimal shape we actually use.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { JSDOM } = require("jsdom") as { JSDOM: new (html: string) => { window: unknown } };
  return createDOMPurify(new JSDOM("").window as unknown as WindowLike);
}

const purify = buildDOMPurify();

const PURIFY_CONFIG: DOMPurifyConfig = {
  ALLOWED_TAGS: [
    "p","br","strong","b","em","i","u","s","mark",
    "h1","h2","h3","h4","h5","h6",
    "ul","ol","li","dl","dt","dd",
    "a","img","figure","figcaption",
    "blockquote","pre","code","kbd",
    "table","thead","tbody","tr","th","td",
    "span","div","hr",
  ],
  ALLOWED_ATTR: ["href","src","srcset","alt","class","style","target","rel","width","height","colspan","rowspan"],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ["script","style","object","embed","iframe","form","input","button","select","textarea"],
  FORCE_BODY: true,
};

interface PageDoc {
  headline?: string;
  subheadline?: string;
  cta_label?: string;
  cta_target?: string;
  body_html?: string;
  background?: string;
  [key: string]: unknown;
}

interface Props {
  funnelId: string;
  funnelSlug: string;
  funnelName: string;
  stepId: string;
  stepSlug: string;
  stepTitle: string;
  stepType: string;
  pageDoc: PageDoc;
  nextStepSlug: string | null;
  visitorIdHint: string | null;
}

const VISITOR_KEY = "ss_funnel_visitor_id";

function getVisitorId(hint: string | null): string {
  if (typeof window === "undefined") return hint ?? "anon";
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return hint ?? "anon";
  }
}

export default function StepClientShell({
  funnelSlug,
  funnelName,
  stepSlug,
  stepTitle,
  stepType,
  pageDoc,
  nextStepSlug,
  visitorIdHint,
}: Props) {
  const router = useRouter();
  const visitorId = useMemo(() => getVisitorId(visitorIdHint), [visitorIdHint]);
  const tracked = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    const url = `/api/f/${encodeURIComponent(funnelSlug)}/${encodeURIComponent(stepSlug)}/event`;
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "view", visitor_id: visitorId }),
      keepalive: true,
    }).catch(() => {
      // Intentionally swallow — view-tracking failures must never break the page.
    });
  }, [funnelSlug, stepSlug, visitorId]);

  async function trackAndAdvance(eventType: "click" | "submit" | "purchase", target?: string) {
    setSubmitting(true);
    try {
      const url = `/api/f/${encodeURIComponent(funnelSlug)}/${encodeURIComponent(stepSlug)}/event`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, visitor_id: visitorId, metadata: { target } }),
      });
    } catch {
      // Best-effort.
    } finally {
      setSubmitting(false);
    }

    if (target && /^https?:/i.test(target)) {
      window.location.href = target;
      return;
    }
    if (nextStepSlug) {
      router.push(`/f/${funnelSlug}/${nextStepSlug}`);
    }
  }

  const headline = pageDoc.headline ?? stepTitle ?? funnelName;
  const subheadline = pageDoc.subheadline ?? null;
  const ctaLabel = pageDoc.cta_label ?? "Continue";
  const ctaTarget = pageDoc.cta_target ?? null;
  const bodyHtml = typeof pageDoc.body_html === "string" ? pageDoc.body_html : null;

  // Sanitise body HTML with DOMPurify (replaces the former regex approach which
  // was bypassable via nested tag tricks and entity encoding).  Authors who want
  // arbitrary embeds / iframes must use a website_projects page instead.
  const safeHtml = useMemo(() => {
    if (!bodyHtml) return null;
    return purify.sanitize(bodyHtml, PURIFY_CONFIG);
  }, [bodyHtml]);

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-16"
      style={{
        background: pageDoc.background ?? "linear-gradient(135deg, #0a0a0a 0%, #1a1033 50%, #2c1a55 100%)",
      }}
    >
      <article className="max-w-2xl w-full text-center">
        <div className="mb-3 text-xs uppercase tracking-[0.16em] text-purple-300/80">
          {stepType.replace(/_/g, " ")}
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
          {headline}
        </h1>
        {subheadline && (
          <p className="mt-4 text-lg text-white/70 max-w-xl mx-auto">{subheadline}</p>
        )}
        {safeHtml && (
          <div
            className="prose prose-invert mt-6 mx-auto max-w-none"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        )}
        <div className="mt-10 flex justify-center">
          <button
            disabled={submitting}
            onClick={() =>
              void trackAndAdvance(
                stepType === "checkout" ? "purchase" : "submit",
                ctaTarget ?? undefined
              )
            }
            className="px-8 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-base transition-colors"
          >
            {submitting ? "Loading…" : ctaLabel}
          </button>
        </div>
      </article>
    </main>
  );
}
