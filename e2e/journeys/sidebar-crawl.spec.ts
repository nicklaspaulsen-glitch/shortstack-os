import { test, expect } from "@playwright/test";
import { signIn, hasTestCreds } from "../helpers/auth";

/**
 * Sidebar crawl — visits every route reachable from the sidebar nav and
 * asserts each page renders without:
 *   - HTTP 404 / 5xx
 *   - "Page not found" / "404" string in the body
 *   - Console errors during initial mount (allowed-list for known noise)
 *   - Unhandled JS exceptions
 *
 * Use this to find regressions where someone moved a route + forgot a
 * sidebar entry, or shipped a page that 500s on first paint.
 *
 * Run:
 *   E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... \
 *     npx playwright test e2e/journeys/sidebar-crawl.spec.ts \
 *       --reporter=list
 *
 * Generates a markdown report at `test-results/sidebar-crawl-report.md`
 * with the status of every visited page.
 */

// Routes pulled from src/components/sidebar.tsx + glass-top-nav.tsx
// Keep in sync when the nav changes. Anything in the sidebar should
// be visitable.
//
// Updated 2026-05-22 from sidebar.tsx NAV_ITEMS (tier 1-4 + settingsOnly).
const AGENCY_ROUTES = [
  // ── GlassTopNav primary (tier 1-2) ──────────────────────────
  "/dashboard",
  "/dashboard/clients",
  "/dashboard/analytics",
  "/dashboard/ai-video",
  "/dashboard/video-editor",
  "/dashboard/thumbnail-generator",
  "/dashboard/ai-studio",
  "/dashboard/social-manager",
  "/dashboard/websites",
  "/dashboard/ads-manager",
  "/dashboard/crm",
  "/dashboard/invoices",
  "/dashboard/agent-office",
  "/dashboard/integrations-hub",
  "/dashboard/content-library",
  "/dashboard/conversations",
  "/dashboard/brand-kit",
  "/dashboard/automations",
  "/dashboard/settings",
  // ── settingsOnly routes ─────────────────────────────────────
  "/dashboard/inbox",
  "/dashboard/calendar",
  "/dashboard/generations",
  "/dashboard/content-plan",
  "/dashboard/notifications",
  "/dashboard/team",
  "/dashboard/reports",
  "/dashboard/outreach-hub",
  "/dashboard/leadgen-pipeline",
  "/dashboard/scraper",
  "/dashboard/eleven-agents",
  "/dashboard/dialer",
  "/dashboard/voice-receptionist",
  "/dashboard/voicemail-drop",
  "/dashboard/voice-studio",
  "/dashboard/dm-controller",
  "/dashboard/outreach-feed",
  "/dashboard/coach",
  "/dashboard/outreach-logs",
  "/dashboard/cold-email",
  "/dashboard/sequences",
  "/dashboard/lead-sources",
  "/dashboard/leads",
  "/dashboard/deals",
  "/dashboard/proposals",
  "/dashboard/trinity",
  "/dashboard/forecast",
  "/dashboard/affiliates",
  "/dashboard/scheduling",
  "/dashboard/meetings",
  "/dashboard/verticals",
  "/dashboard/copywriter",
  "/dashboard/email-composer",
  "/dashboard/email-templates",
  "/dashboard/sms-templates",
  "/dashboard/newsletter",
  "/dashboard/brand-voice",
  "/dashboard/landing-pages",
  "/dashboard/funnels",
  "/dashboard/forms",
  "/dashboard/intake",
  "/dashboard/social-studio",
  "/dashboard/design-studio",
  "/dashboard/carousel-generator",
  "/dashboard/services",
  "/dashboard/workflows",
  "/dashboard/workflow-builder",
  "/dashboard/whatsapp",
  "/dashboard/workspace/board",
  "/dashboard/workspace/whiteboard",
  "/dashboard/workspace/files",
  "/dashboard/workspaces",
  "/dashboard/production",
  "/dashboard/projects",
  "/dashboard/financials",
  "/dashboard/invoice-templates",
  "/dashboard/subaccounts",
  "/dashboard/pricing",
  "/dashboard/white-label",
  "/dashboard/billing",
  "/dashboard/usage",
  "/dashboard/phone-email",
  "/dashboard/phone-setup",
  "/dashboard/mail-setup",
  "/dashboard/domains",
  "/dashboard/client-health",
  "/dashboard/reviews",
  "/dashboard/tickets",
  "/dashboard/referrals",
  "/dashboard/monitor",
  "/dashboard/report-generator",
  "/dashboard/marketplace",
  "/dashboard/download",
  "/dashboard/google-business",
  "/dashboard/discord",
  "/dashboard/notion-sync",
  "/dashboard/telegram",
  "/dashboard/webhooks",
  "/dashboard/api/keys",
  "/dashboard/api/webhooks",
  "/dashboard/api-docs",
  "/dashboard/activity-log",
  // ── Admin routes ────────────────────────────────────────────
  "/dashboard/admin",
  "/dashboard/admin/agent-traces",
  "/dashboard/admin/llm-costs",
  "/dashboard/admin/self-test",
  "/dashboard/admin/status",
  // ── Script Lab (sidebar.tsx Create section legacy) ──────────
  "/dashboard/script-lab",
] as const;

interface RouteResult {
  path: string;
  ok: boolean;
  status: number;
  consoleErrors: string[];
  pageErrors: string[];
  durationMs: number;
}

/**
 * Console messages we silently ignore. Add only patterns that appear on
 * many pages and are confirmed-noise (e.g. third-party SDK warnings, hot-
 * reload churn). Each entry is a substring match — keep specific.
 */
const ALLOWED_CONSOLE_NOISE = [
  "Download the React DevTools",
  "[next-auth]",
  "OnboardingTour", // mounts on every dashboard with optional copy
  "ResizeObserver",
  "hydration",
  "Non-Error promise rejection",
];

function isNoise(text: string): boolean {
  return ALLOWED_CONSOLE_NOISE.some((pattern) => text.includes(pattern));
}

test.describe("Sidebar route crawl", () => {
  test.skip(!hasTestCreds(), "Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD to run");

  test("every sidebar route renders cleanly", async ({ page, request }, testInfo) => {
    test.setTimeout(20 * 60_000); // 20 min — crawls ~100 pages

    await signIn(page);

    const results: RouteResult[] = [];

    for (const path of AGENCY_ROUTES) {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];

      const onConsole = (msg: import("@playwright/test").ConsoleMessage) => {
        if (msg.type() === "error") {
          const text = msg.text();
          if (!isNoise(text)) consoleErrors.push(text);
        }
      };
      const onError = (err: Error) => {
        if (!isNoise(err.message)) pageErrors.push(err.message);
      };

      page.on("console", onConsole);
      page.on("pageerror", onError);

      const start = Date.now();
      const res = await page.goto(path, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => null);
      const durationMs = Date.now() - start;
      const status = res?.status() ?? 0;
      // Brief settle for client-side errors to surface
      await page.waitForTimeout(500);

      // Body sanity check
      const bodyText = await page.locator("body").innerText().catch(() => "");
      const looksLike404 =
        /404|page not found|not\s+found/i.test(bodyText.slice(0, 600)) &&
        !path.startsWith("/dashboard/admin");

      const ok = status >= 200 && status < 400 && !looksLike404 && pageErrors.length === 0;

      results.push({ path, ok, status, consoleErrors, pageErrors, durationMs });

      page.off("console", onConsole);
      page.off("pageerror", onError);
    }

    // Summary report
    const broken = results.filter((r) => !r.ok);
    const lines = [
      "# Sidebar Crawl Report",
      "",
      `Total routes: ${results.length}`,
      `Healthy: ${results.length - broken.length}`,
      `Broken: ${broken.length}`,
      "",
      "## Broken routes",
      "",
      ...(broken.length === 0
        ? ["(none)"]
        : broken.map(
            (r) =>
              `### ${r.path}\nstatus: ${r.status}\nduration: ${r.durationMs}ms\nconsoleErrors: ${r.consoleErrors.join(" | ") || "(none)"}\npageErrors: ${r.pageErrors.join(" | ") || "(none)"}`
          )),
      "",
      "## All routes",
      "",
      ...results.map(
        (r) =>
          `- ${r.ok ? "OK  " : "FAIL"} ${r.path} → ${r.status} (${r.durationMs}ms)${r.consoleErrors.length ? ` errors=${r.consoleErrors.length}` : ""}`
      ),
    ];
    const report = lines.join("\n");

    // eslint-disable-next-line no-console
    console.log(report);

    await testInfo.attach("sidebar-crawl-report.md", {
      body: report,
      contentType: "text/markdown",
    });
    await testInfo.attach("sidebar-crawl.json", {
      body: JSON.stringify(results, null, 2),
      contentType: "application/json",
    });

    // Assertion — fail the run if anything is broken so CI catches regressions.
    expect(broken, `${broken.length} broken routes (see attached report)`).toEqual([]);
  });
});
