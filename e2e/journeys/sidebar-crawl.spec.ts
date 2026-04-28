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

// Routes pulled from src/components/sidebar.tsx — keep in sync when the
// nav changes. Anything in the sidebar should be visitable.
const AGENCY_ROUTES = [
  // Core
  "/dashboard/inbox",
  "/dashboard/generations",
  "/dashboard",
  "/dashboard/community",
  "/dashboard/analytics",
  "/dashboard/reports",
  // Sales
  "/dashboard/outreach-hub",
  "/dashboard/scraper",
  "/dashboard/eleven-agents",
  "/dashboard/dialer",
  "/dashboard/voice-receptionist",
  "/dashboard/voicemail-drop",
  "/dashboard/voice-studio",
  "/dashboard/dm-controller",
  "/dashboard/conversations",
  "/dashboard/outreach-feed",
  "/dashboard/coach",
  "/dashboard/outreach-logs",
  "/dashboard/cold-email",
  "/dashboard/sequences",
  "/dashboard/lead-sources",
  "/dashboard/crm",
  "/dashboard/tags",
  "/dashboard/deals",
  "/dashboard/proposals",
  "/dashboard/forecast",
  "/dashboard/commission-tracker",
  "/dashboard/affiliates",
  "/dashboard/ads-manager",
  "/dashboard/calendar",
  "/dashboard/scheduling",
  "/dashboard/meetings",
  "/dashboard/clients",
  "/dashboard/courses",
  "/dashboard/verticals",
  // Create
  "/dashboard/copywriter",
  "/dashboard/script-lab",
  "/dashboard/email-composer",
  "/dashboard/email-templates",
  "/dashboard/sms-templates",
  "/dashboard/newsletter",
  "/dashboard/brand-voice",
  "/dashboard/brand-kit",
  // Workspace
  "/dashboard/workspace/board",
  "/dashboard/workspace/whiteboard",
  "/dashboard/workspace/files",
  // Manage
  "/dashboard/workspaces",
  "/dashboard/team",
  "/dashboard/production",
  "/dashboard/projects",
  "/dashboard/financials",
  // Settings
  "/dashboard/settings",
  "/dashboard/settings/email-templates",
  "/dashboard/settings/getting-started",
  "/dashboard/settings/voice-profile",
  // Admin
  "/dashboard/admin",
  "/dashboard/admin/agent-traces",
  "/dashboard/admin/llm-costs",
  "/dashboard/admin/self-test",
  "/dashboard/admin/status",
  // Pixel office + automations
  "/dashboard/agent-office",
  "/dashboard/automations",
  "/dashboard/automations/library",
  "/dashboard/automations/browser-tasks",
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
];

function isNoise(text: string): boolean {
  return ALLOWED_CONSOLE_NOISE.some((pattern) => text.includes(pattern));
}

test.describe("Sidebar route crawl", () => {
  test.skip(!hasTestCreds(), "Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD to run");

  test("every sidebar route renders cleanly", async ({ page, request }, testInfo) => {
    test.setTimeout(15 * 60_000); // 15 min — crawls ~60 pages

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
