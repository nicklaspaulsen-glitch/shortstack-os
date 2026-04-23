#!/usr/bin/env node
/**
 * Tier-2 deep-run bug-hunt agent — SCAFFOLD.
 *
 * Runs Saturday 02:00 (wire up via GitHub Actions or Vercel cron once
 * Playwright is installed). Walks every dashboard page in a real browser,
 * screenshots, and flags anomalies:
 *   - React error boundaries visible
 *   - "404" strings rendered in body text
 *   - "NaN" or "undefined" leaking into the DOM
 *   - Console errors during page load
 *
 * Design target: ~20 pages in ~5 min. Upload screenshots to Supabase Storage,
 * file one GitHub issue per anomaly via `gh issue create`.
 *
 * ─── CURRENT STATE: scaffold only ───
 * This script detects if `playwright` is installed. If yes, it runs the walk.
 * If no, it prints install instructions and exits 0 (so a cron job doesn't
 * spam failures before you've set it up).
 *
 * Run manually:
 *   node scripts/bug-hunt-deep-run.mjs
 *   node scripts/bug-hunt-deep-run.mjs --base-url=http://localhost:3000
 *   node scripts/bug-hunt-deep-run.mjs --headed
 */

import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);

// ── Config ──
const BASE_URL =
  process.argv.find((a) => a.startsWith("--base-url="))?.split("=")[1] ||
  process.env.BUG_HUNT_BASE_URL ||
  "http://localhost:3000";
const HEADED = process.argv.includes("--headed");
const SESSION_TOKEN = process.env.BUG_HUNT_SESSION_TOKEN || null;

// Pages to walk. Keep in sync with `src/lib/self-test/pages-to-walk.ts`
// (not yet created — the scaffold hard-codes the list for now).
const PAGES_TO_WALK = [
  { path: "/dashboard", name: "dashboard-home" },
  { path: "/dashboard/clients", name: "clients-list" },
  { path: "/dashboard/leads", name: "leads-list" },
  { path: "/dashboard/crm", name: "crm" },
  { path: "/dashboard/content", name: "content-library" },
  { path: "/dashboard/content-plan", name: "content-plan" },
  { path: "/dashboard/triggers", name: "triggers" },
  { path: "/dashboard/workflows", name: "workflows" },
  { path: "/dashboard/sequences", name: "sequences" },
  { path: "/dashboard/reports", name: "reports" },
  { path: "/dashboard/analytics", name: "analytics" },
  { path: "/dashboard/system-status", name: "system-status" },
  { path: "/dashboard/admin/self-test", name: "self-test" },
  { path: "/dashboard/billing", name: "billing" },
  { path: "/dashboard/settings", name: "settings" },
  { path: "/dashboard/profile", name: "profile" },
  { path: "/dashboard/notifications", name: "notifications" },
  { path: "/dashboard/conversations", name: "conversations" },
  { path: "/dashboard/scheduling", name: "scheduling" },
  { path: "/dashboard/webhooks", name: "webhooks" },
];

// Anomaly signatures we search the DOM for.
const ANOMALY_PATTERNS = [
  { key: "error-boundary", needle: "Something went wrong" },
  { key: "react-error", needle: "Error:" },
  { key: "page-404", needle: "404" },
  { key: "nan-in-dom", needle: "NaN" },
  { key: "undefined-in-dom", needle: "undefined" },
  { key: "null-in-dom", needle: "[object Object]" },
];

function tryRequirePlaywright() {
  try {
    // Prefer @playwright/test (has chromium bundled) → fall back to playwright-core.
    try { return require("@playwright/test"); } catch { /* next */ }
    return require("playwright-core");
  } catch {
    return null;
  }
}

function printInstallInstructions() {
  console.log("\n━━━ Tier-2 deep-run bug hunt ━━━");
  console.log("Playwright is not installed. To enable this agent:");
  console.log("");
  console.log("  npm install --save-dev @playwright/test");
  console.log("  npx playwright install chromium");
  console.log("");
  console.log("Then re-run:  node scripts/bug-hunt-deep-run.mjs");
  console.log("");
  console.log("See docs/bug-hunt-agent.md for the full Tier-2 design.\n");
}

async function run() {
  const pw = tryRequirePlaywright();
  if (!pw) {
    printInstallInstructions();
    process.exit(0);
    return;
  }

  const { chromium } = pw;
  console.log(`[bug-hunt] Launching chromium against ${BASE_URL} (headed=${HEADED})`);
  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    // Auth: pass a signed-in session cookie if BUG_HUNT_SESSION_TOKEN is set.
    // Supabase SSR cookie name depends on project ref.
    storageState: SESSION_TOKEN ? undefined : undefined,
  });

  // If a raw access token is provided, inject it as localStorage for the
  // Supabase client to pick up.
  if (SESSION_TOKEN) {
    await context.addInitScript(`
      try {
        localStorage.setItem('sb-access-token', ${JSON.stringify(SESSION_TOKEN)});
      } catch (e) {}
    `);
  }

  const page = await context.newPage();
  const results = [];

  for (const target of PAGES_TO_WALK) {
    const url = `${BASE_URL}${target.path}`;
    console.log(`[bug-hunt] Walking ${url}`);
    const consoleErrors = [];
    page.on("pageerror", (err) => consoleErrors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const started = Date.now();
    let status = "ok";
    const anomalies = [];

    try {
      const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 20_000 });
      const httpStatus = resp?.status() ?? 0;
      if (httpStatus >= 400) {
        anomalies.push({ key: "http-error", detail: `HTTP ${httpStatus}` });
      }
      // Give React a tick to render any deferred boundaries.
      await page.waitForTimeout(500);
      const bodyText = await page.locator("body").innerText().catch(() => "");
      for (const pat of ANOMALY_PATTERNS) {
        if (bodyText.includes(pat.needle)) {
          anomalies.push({ key: pat.key, detail: `Found "${pat.needle}" in DOM` });
        }
      }
      if (consoleErrors.length > 0) {
        anomalies.push({ key: "console-errors", detail: consoleErrors.slice(0, 3).join(" | ") });
      }

      // Screenshot — persist under /tmp/bug-hunt/ for Claude to inspect later.
      const shotPath = `/tmp/bug-hunt/${target.name}.png`;
      try {
        await page.screenshot({ path: shotPath, fullPage: true });
      } catch {
        // Non-fatal; screenshot dir may not exist on some hosts.
      }

      if (anomalies.length > 0) status = "anomalies";
    } catch (err) {
      status = "navigation-failed";
      anomalies.push({ key: "nav-threw", detail: String(err).slice(0, 200) });
    }

    results.push({
      url,
      name: target.name,
      status,
      duration_ms: Date.now() - started,
      anomalies,
    });
    page.removeAllListeners();
  }

  await browser.close();

  // Summarize + file GitHub issues.
  const failing = results.filter((r) => r.status !== "ok");
  console.log(`\n[bug-hunt] Walk complete. ${results.length - failing.length}/${results.length} clean. ${failing.length} with anomalies.`);
  for (const r of failing) {
    console.log(`  ✗ ${r.url}`);
    for (const a of r.anomalies) console.log(`      - ${a.key}: ${a.detail}`);
  }

  // TODO: `gh issue create` for each anomaly. Stubbed for now to keep the
  // scaffold inert until Nicklas wires up GITHUB_TOKEN. See
  // docs/bug-hunt-agent.md §Tier 2 → "Issue filing".

  // Exit non-zero if anything broke so CI picks it up.
  process.exit(failing.length > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("[bug-hunt] Fatal:", err);
  process.exit(2);
});
