#!/usr/bin/env node
/**
 * Screenshot audit — scans dashboard routes for broken UI.
 *
 * Detects:
 *   - Overlapping popups / multiple open dialogs (overlay stack wars)
 *   - Modals / dialogs missing `aria-modal="true"` or a backdrop
 *   - Fixed-positioned, high-z-index elements rendered outside the viewport
 *   - Elements whose bounding box extends past a clipping ancestor
 *     (overflow: hidden cutting off visible content)
 *
 * Outputs full-page screenshots + a JSON report to:
 *   ./screenshot-audit/<timestamp>/
 *     ├── <route>.png            (one per route, slugified)
 *     └── report.json            (findings + metadata)
 *
 * Usage:
 *   npm run audit:screenshots
 *   BASE_URL=http://localhost:3000 node scripts/screenshot-audit.mjs
 *   BASE_URL=https://app.shortstack.com AUTH_COOKIE="sb-access-token=..." \
 *     node scripts/screenshot-audit.mjs
 *
 * Env:
 *   BASE_URL     Target origin. Default: http://localhost:3000
 *   AUTH_COOKIE  Raw Cookie header value for protected routes. If missing,
 *                auth-gated routes will redirect to /login and get flagged.
 *   HEADLESS     "false" to see the browser. Default: true.
 *   TIMEOUT_MS   Per-page navigation timeout. Default: 30000.
 *
 * ─── CURRENT STATE: scaffold ───
 * If `playwright` is not installed, this script prints install instructions
 * and exits 0 so CI doesn't spam failures before setup.
 *
 *   npm install --save-dev playwright
 *   npx playwright install chromium
 *
 * See docs/screenshot-audit-setup.md for CI wiring.
 */

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);

// ─── Config ──────────────────────────────────────────────────────────────────

const ROUTES = [
  "/dashboard",
  "/dashboard/crm",
  "/dashboard/deals",
  "/dashboard/leads",
  "/dashboard/outreach",
  "/dashboard/workflows",
  "/dashboard/websites",
  "/dashboard/landing-pages",
  "/dashboard/calendar",
  "/dashboard/scheduling",
  "/dashboard/community",
  "/dashboard/social-manager",
  "/dashboard/forms",
  "/dashboard/reviews",
  "/dashboard/phone-setup",
  "/dashboard/mail-setup",
  "/dashboard/upgrade",
  "/dashboard/brand",
  "/dashboard/analytics",
  "/dashboard/thumbnail-generator",
  "/dashboard/video-editor",
  "/dashboard/ai-video",
  "/dashboard/ai-studio",
  "/dashboard/content-library",
  "/dashboard/settings",
  "/dashboard/referrals",
  "/dashboard/report-generator",
  "/dashboard/conversations",
  "/dashboard/clients",
  "/dashboard/logo-picker",
  "/dashboard/system-status",
  "/dashboard/domains",
  "/dashboard/download",
];

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const AUTH_COOKIE = process.env.AUTH_COOKIE || "";
const HEADLESS = process.env.HEADLESS !== "false";
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 30000);
const VIEWPORT = { width: 1440, height: 900 };

// ─── Playwright gate ─────────────────────────────────────────────────────────

let playwright;
try {
  playwright = require("playwright");
} catch {
  console.warn(
    "[screenshot-audit] `playwright` is not installed. Skipping run.\n" +
      "Install with:\n" +
      "  npm install --save-dev playwright\n" +
      "  npx playwright install chromium\n\n" +
      "Then re-run: npm run audit:screenshots",
  );
  process.exit(0);
}

// ─── Slug helpers ────────────────────────────────────────────────────────────

const slug = (route) =>
  route
    .replace(/^\//, "")
    .replace(/\/$/, "")
    .replace(/[^a-z0-9\-_/]/gi, "_")
    .replace(/\//g, "__") || "root";

const timestamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
};

// ─── In-page UI audit ────────────────────────────────────────────────────────

/**
 * Runs inside the browser. Returns structured findings for the current page.
 */
function pageAuditFn() {
  const findings = [];

  const push = (severity, rule, detail) => {
    findings.push({ severity, rule, detail });
  };

  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  // ── Rule 1: modals / dialogs ────────────────────────────────────────────────
  const dialogSelectors = [
    '[role="dialog"]',
    ".modal",
    "[data-modal]",
    '[role="alertdialog"]',
  ];
  const seen = new Set();
  const dialogs = [];
  for (const sel of dialogSelectors) {
    for (const el of document.querySelectorAll(sel)) {
      if (seen.has(el)) continue;
      seen.add(el);
      const style = window.getComputedStyle(el);
      const visible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0.01 &&
        el.getBoundingClientRect().width > 0 &&
        el.getBoundingClientRect().height > 0;
      if (!visible) continue;

      dialogs.push(el);

      const ariaModal = el.getAttribute("aria-modal");
      if (ariaModal !== "true") {
        push("warn", "dialog-missing-aria-modal", {
          selector: sel,
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          classes: el.className || null,
        });
      }

      // Backdrop heuristic: sibling or fixed overlay covering viewport behind dialog
      const hasBackdrop = Boolean(
        document.querySelector(
          '.modal-backdrop, [data-backdrop], [data-modal-backdrop], .backdrop, [role="presentation"]',
        ),
      );
      if (!hasBackdrop) {
        push("warn", "dialog-missing-backdrop", {
          selector: sel,
          id: el.id || null,
        });
      }
    }
  }

  if (dialogs.length > 1) {
    push("warn", "multiple-open-dialogs", {
      count: dialogs.length,
      message:
        "Multiple visible dialogs detected on the same page — likely overlay stack war.",
    });
  }

  // ── Rule 2: fixed + high z-index elements outside viewport ─────────────────
  const allEls = document.querySelectorAll("*");
  for (const el of allEls) {
    const style = window.getComputedStyle(el);
    if (style.position !== "fixed") continue;
    const z = parseInt(style.zIndex, 10);
    if (!Number.isFinite(z) || z <= 100) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const outside =
      rect.right < 0 ||
      rect.bottom < 0 ||
      rect.left > viewportW ||
      rect.top > viewportH;
    if (outside) {
      push("error", "fixed-highz-offscreen", {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        classes: (el.className && String(el.className).slice(0, 120)) || null,
        zIndex: z,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        },
        viewport: { w: viewportW, h: viewportH },
      });
    }
  }

  // ── Rule 3: overflow:hidden clipping visible content ───────────────────────
  // Walk clipping ancestors and flag when a child's box extends past the parent.
  const clipCandidates = Array.from(
    document.querySelectorAll("main, section, article, div, aside"),
  ).filter((el) => {
    const s = window.getComputedStyle(el);
    return (
      (s.overflow === "hidden" ||
        s.overflowX === "hidden" ||
        s.overflowY === "hidden") &&
      el.getBoundingClientRect().width > 0 &&
      el.getBoundingClientRect().height > 0
    );
  });

  let clippingHits = 0;
  const CLIP_LIMIT = 20; // avoid unbounded report size
  outer: for (const parent of clipCandidates) {
    const pRect = parent.getBoundingClientRect();
    for (const child of parent.children) {
      const cRect = child.getBoundingClientRect();
      if (cRect.width === 0 || cRect.height === 0) continue;
      const overflowsRight = cRect.right - pRect.right > 2;
      const overflowsBottom = cRect.bottom - pRect.bottom > 2;
      const overflowsLeft = pRect.left - cRect.left > 2;
      const overflowsTop = pRect.top - cRect.top > 2;
      if (
        overflowsRight ||
        overflowsBottom ||
        overflowsLeft ||
        overflowsTop
      ) {
        push("warn", "overflow-hidden-clipping", {
          parent: {
            tag: parent.tagName.toLowerCase(),
            id: parent.id || null,
            classes:
              (parent.className && String(parent.className).slice(0, 120)) ||
              null,
          },
          child: {
            tag: child.tagName.toLowerCase(),
            id: child.id || null,
            classes:
              (child.className && String(child.className).slice(0, 120)) ||
              null,
          },
          overflowsBy: {
            right: Math.round(Math.max(0, cRect.right - pRect.right)),
            bottom: Math.round(Math.max(0, cRect.bottom - pRect.bottom)),
            left: Math.round(Math.max(0, pRect.left - cRect.left)),
            top: Math.round(Math.max(0, pRect.top - cRect.top)),
          },
        });
        clippingHits++;
        if (clippingHits >= CLIP_LIMIT) break outer;
      }
    }
  }

  // ── Rule 4: obvious "missing content" heuristics ───────────────────────────
  const bodyText = (document.body?.innerText || "").trim();
  if (bodyText.length < 40) {
    push("error", "empty-or-near-empty-page", {
      bodyTextLength: bodyText.length,
      preview: bodyText.slice(0, 200),
    });
  }
  if (/\b(404|not found)\b/i.test(bodyText.slice(0, 500))) {
    push("error", "page-rendered-404", {
      preview: bodyText.slice(0, 200),
    });
  }

  return {
    url: window.location.href,
    title: document.title,
    viewport: { w: viewportW, h: viewportH },
    dialogCount: dialogs.length,
    findings,
  };
}

// ─── Cookie parsing ──────────────────────────────────────────────────────────

function parseCookieHeader(raw, url) {
  if (!raw) return [];
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return [];
  }
  return raw
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf("=");
      if (eq === -1) return null;
      return {
        name: pair.slice(0, eq).trim(),
        value: pair.slice(eq + 1).trim(),
        domain: hostname,
        path: "/",
        httpOnly: false,
        secure: url.startsWith("https://"),
        sameSite: "Lax",
      };
    })
    .filter(Boolean);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const runId = timestamp();
  const outDir = join(process.cwd(), "screenshot-audit", runId);
  mkdirSync(outDir, { recursive: true });

  console.log(`[screenshot-audit] run ${runId}`);
  console.log(`[screenshot-audit] base url: ${BASE_URL}`);
  console.log(`[screenshot-audit] output:   ${outDir}`);
  if (!AUTH_COOKIE) {
    console.warn(
      "[screenshot-audit] WARNING: AUTH_COOKIE not set. Auth-gated routes " +
        "will redirect to /login and produce findings; set AUTH_COOKIE to a " +
        "valid session Cookie header to audit protected routes.",
    );
  }

  const browser = await playwright.chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: VIEWPORT });

  const cookies = parseCookieHeader(AUTH_COOKIE, BASE_URL);
  if (cookies.length) {
    await context.addCookies(cookies);
    console.log(`[screenshot-audit] loaded ${cookies.length} cookie(s)`);
  }

  const page = await context.newPage();

  const consoleErrors = new Map(); // route -> string[]
  const pageErrors = new Map();

  const results = [];

  for (const route of ROUTES) {
    const url = `${BASE_URL}${route}`;
    const name = slug(route);
    const shotPath = join(outDir, `${name}.png`);

    const routeConsole = [];
    const routePageErrors = [];
    const onConsole = (msg) => {
      if (msg.type() === "error") routeConsole.push(msg.text());
    };
    const onPageError = (err) => {
      routePageErrors.push(String(err?.message || err));
    };
    page.on("console", onConsole);
    page.on("pageerror", onPageError);

    const startedAt = Date.now();
    const entry = {
      route,
      url,
      screenshot: shotPath,
      ok: false,
      status: null,
      finalUrl: null,
      durationMs: 0,
      audit: null,
      consoleErrors: [],
      pageErrors: [],
      error: null,
    };

    try {
      const resp = await page.goto(url, {
        waitUntil: "networkidle",
        timeout: TIMEOUT_MS,
      });
      entry.status = resp?.status() ?? null;
      entry.finalUrl = page.url();

      // Small settle delay for late-mounting portals (toasts, modals).
      await page.waitForTimeout(500);

      await page.screenshot({ path: shotPath, fullPage: true });

      const audit = await page.evaluate(pageAuditFn);
      entry.audit = audit;
      entry.ok = true;
    } catch (err) {
      entry.error = String(err?.message || err);
      // Try to grab a partial screenshot anyway, best-effort.
      try {
        await page.screenshot({ path: shotPath, fullPage: true });
      } catch {
        /* ignore */
      }
    } finally {
      entry.durationMs = Date.now() - startedAt;
      entry.consoleErrors = [...routeConsole];
      entry.pageErrors = [...routePageErrors];
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      consoleErrors.set(route, routeConsole);
      pageErrors.set(route, routePageErrors);
      results.push(entry);

      const findingCount = entry.audit?.findings?.length ?? 0;
      console.log(
        `[screenshot-audit] ${route.padEnd(34)} ` +
          `status=${entry.status ?? "ERR"} ` +
          `findings=${findingCount} ` +
          `console=${routeConsole.length} ` +
          `pageerr=${routePageErrors.length} ` +
          `(${entry.durationMs}ms)`,
      );
    }
  }

  await browser.close();

  const totals = {
    routes: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    findings: results.reduce(
      (n, r) => n + (r.audit?.findings?.length ?? 0),
      0,
    ),
    consoleErrors: results.reduce(
      (n, r) => n + (r.consoleErrors?.length ?? 0),
      0,
    ),
    pageErrors: results.reduce((n, r) => n + (r.pageErrors?.length ?? 0), 0),
  };

  const report = {
    runId,
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    authCookieUsed: Boolean(AUTH_COOKIE),
    viewport: VIEWPORT,
    totals,
    results,
  };

  const reportPath = join(outDir, "report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`\n[screenshot-audit] wrote ${reportPath}`);
  console.log(`[screenshot-audit] totals:`, totals);

  // Non-zero exit only if something critical failed, so CI can gate releases.
  const hardFail = results.some(
    (r) =>
      !r.ok ||
      (r.audit?.findings || []).some((f) => f.severity === "error"),
  );
  process.exit(hardFail ? 1 : 0);
}

main().catch((err) => {
  console.error("[screenshot-audit] fatal:", err);
  process.exit(2);
});
