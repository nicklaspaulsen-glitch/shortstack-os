/**
 * Dashboard interactions crawl
 *
 * Visits every agency + portal route and probes UI interactions:
 *   - Tab strips / pill nav (switches view)
 *   - Accordion / expand toggles (opens a section)
 *   - Table sort headers
 *   - View-mode toggles (grid / list)
 *
 * Up to 3 interactions per page. Reports any JS errors that fire
 * AFTER an interaction (load-time errors are covered by sidebar-crawl).
 *
 * Safe-only — any element whose visible text or aria-label matches
 * DESTRUCTIVE_PATTERN is silently skipped.
 *
 * Run:
 *   npx playwright test e2e/journeys/interactions-crawl.spec.ts --reporter=list
 *
 * Attaches interactions-crawl-report.md + interactions-crawl.json to the run.
 * Screenshots of failing pages go to test-results/interact-failures/.
 */

import { test, expect, type Page, type Locator } from "@playwright/test";
import * as fs from "fs";
import { signIn, hasTestCreds } from "../helpers/auth";

// ── Routes ────────────────────────────────────────────────────────────────────

const ALL_ROUTES = [
  // ── Agency routes (mirrors sidebar-crawl.spec.ts) ──────────────────────────
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
  "/dashboard/admin",
  "/dashboard/admin/agent-traces",
  "/dashboard/admin/llm-costs",
  "/dashboard/admin/self-test",
  "/dashboard/admin/status",
  "/dashboard/script-lab",
  // ── Portal routes ───────────────────────────────────────────────────────────
  "/dashboard/portal",
  "/dashboard/portal/reports",
  "/dashboard/portal/content",
  "/dashboard/portal/calendar",
  "/dashboard/portal/agency-room",
  "/dashboard/portal/uploads",
  "/dashboard/portal/support",
  "/dashboard/portal/billing",
  "/dashboard/portal/leads",
  "/dashboard/portal/outreach",
  "/dashboard/portal/outreach-feed",
  "/dashboard/portal/socials",
  "/dashboard/portal/settings",
  "/dashboard/portal/setup",
] as const;

// ── Safety filters ────────────────────────────────────────────────────────────

/**
 * Text / aria-label patterns that indicate a destructive or state-changing
 * action. Any element whose visible text OR aria-label matches this is
 * skipped — we only probe read-safe interactions.
 */
const DESTRUCTIVE_PATTERN =
  /\b(delete|remove|cancel\s*plan|archive|send|publish|pay|checkout|sign.?out|log.?out|reset|clear\s*all|drop|destroy|export|download|revoke|disable|deactivate|purge|wipe|submit|save|confirm|apply\s*changes|invite|connect)\b/i;

// JS errors we've confirmed are third-party noise on every page
const JS_NOISE_PATTERNS = [
  "ResizeObserver loop",
  "hydration",
  "Non-Error promise rejection",
  "ChunkLoadError",
  "OnboardingTour",
  "[next-auth]",
  "Download the React DevTools",
  "Warning: ",
  "Cannot update a component",
];

function isJsNoise(msg: string): boolean {
  return JS_NOISE_PATTERNS.some((p) => msg.includes(p));
}

// ── Target collection ─────────────────────────────────────────────────────────

interface Target {
  el: Locator;
  desc: string;
}

/**
 * Find up to `limit` safe interactive elements on the current page.
 * Probes in priority order: tabs → accordions → sort headers → view toggles.
 */
async function collectSafeTargets(page: Page, limit: number): Promise<Target[]> {
  const found: Target[] = [];

  async function probe(selector: string, kind: string, maxTake = 2) {
    if (found.length >= limit) return;
    try {
      const els = await page.locator(selector).all();
      for (const el of els.slice(0, maxTake)) {
        if (found.length >= limit) break;
        const visible = await el.isVisible().catch(() => false);
        if (!visible) continue;
        const rawText = (await el.textContent().catch(() => "")) ?? "";
        const text = rawText.trim().slice(0, 60);
        const ariaLabel = ((await el.getAttribute("aria-label").catch(() => "")) ?? "").trim();
        const combined = text || ariaLabel;
        if (DESTRUCTIVE_PATTERN.test(combined) || DESTRUCTIVE_PATTERN.test(ariaLabel)) continue;
        found.push({ el, desc: `${kind}: "${combined || selector}"` });
      }
    } catch {
      /* stale handle or locator failure — safe to skip */
    }
  }

  // 1. Tab strips — ARIA role=tab not yet selected
  await probe('[role="tab"]:not([aria-selected="true"]):not([disabled])', "tab");
  // 2. Radix / shadcn-ui inactive tabs
  await probe('[data-state="inactive"][role="tab"]:not([disabled])', "radix-tab");
  // 3. Pill tab buttons used in custom tab strips
  await probe(
    'button.tab-pill:not(.active):not([disabled]), [class*="tab-pill"]:not([class*="active"]):not(button[disabled])',
    "pill-tab"
  );
  // 4. Accordion / collapsible expand buttons (only collapsed ones)
  await probe('button[aria-expanded="false"]:not([disabled])', "expand", 1);
  // 5. Table column sort buttons
  await probe("thead th button:not([disabled])", "sort", 2);
  // 6. View-mode toggles (grid / list / table icons)
  await probe(
    'button[aria-label*="grid" i]:not([disabled]), button[aria-label*="list" i]:not([disabled]), button[aria-label*="table" i]:not([disabled])',
    "view-toggle",
    1
  );

  return found;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface InteractResult {
  desc: string;
  clicked: boolean;
  clickError?: string;
  jsErrors: string[];
}

interface RouteResult {
  path: string;
  loadOk: boolean;
  loadStatus: number;
  loadMs: number;
  interacts: InteractResult[];
  hasPostInteractJsErrors: boolean;
}

// ── Test ──────────────────────────────────────────────────────────────────────

test.describe("Dashboard interactions crawl", () => {
  test.beforeAll(() => {
    test.skip(!hasTestCreds(), "E2E credentials not set — skipping interaction crawl");
  });

  test(
    "every dashboard route handles tab/accordion/sort interactions without JS errors",
    async ({ page }, testInfo) => {
      test.setTimeout(50 * 60_000); // 50 min for ~110 routes × up to 3 interactions

      fs.mkdirSync("test-results/interact-failures", { recursive: true });

      await signIn(page);

      const results: RouteResult[] = [];

      for (const routePath of ALL_ROUTES) {
        // ── 1. Navigate ──────────────────────────────────────────────────────
        const loadStart = Date.now();
        const res = await page
          .goto(routePath, { waitUntil: "domcontentloaded", timeout: 20_000 })
          .catch(() => null);
        const loadMs = Date.now() - loadStart;
        const loadStatus = res?.status() ?? 0;
        const loadOk = loadStatus >= 200 && loadStatus < 400;

        await page.waitForTimeout(700); // let React commit + lazy fetches settle

        const result: RouteResult = {
          path: routePath,
          loadOk,
          loadStatus,
          loadMs,
          interacts: [],
          hasPostInteractJsErrors: false,
        };

        // ── 2. Probe interactions (only if page loaded OK) ────────────────────
        if (loadOk) {
          const postInteractErrors: string[] = [];
          const onPageError = (err: Error) => {
            if (!isJsNoise(err.message)) postInteractErrors.push(err.message);
          };
          page.on("pageerror", onPageError);

          const targets = await collectSafeTargets(page, 3);

          for (const target of targets) {
            // Reset error bucket for this interaction
            postInteractErrors.length = 0;

            let clicked = false;
            let clickError: string | undefined;

            try {
              await target.el.scrollIntoViewIfNeeded({ timeout: 2_000 });
              await target.el.click({ timeout: 3_000 });
              await page.waitForTimeout(450); // let React re-render + any errors surface
              clicked = true;
            } catch (e: unknown) {
              clickError =
                e instanceof Error ? e.message.slice(0, 120) : String(e).slice(0, 120);
            }

            const jsErrsCopy = [...postInteractErrors];
            result.interacts.push({
              desc: target.desc,
              clicked,
              clickError,
              jsErrors: jsErrsCopy,
            });
            if (jsErrsCopy.length > 0) result.hasPostInteractJsErrors = true;
          }

          page.off("pageerror", onPageError);

          // ── 3. Screenshot on interaction errors ───────────────────────────
          if (result.hasPostInteractJsErrors) {
            const slug = routePath.replace(/^\//, "").replace(/\//g, "__");
            const screenshotPath = `test-results/interact-failures/${slug}.png`;
            await page
              .screenshot({ path: screenshotPath, fullPage: false })
              .catch(() => {});
            await testInfo
              .attach(`fail-${slug}.png`, {
                path: screenshotPath,
                contentType: "image/png",
              })
              .catch(() => {});
          }
        }

        results.push(result);
      }

      // ── 4. Build report ─────────────────────────────────────────────────────
      const failedLoad = results.filter((r) => !r.loadOk);
      const failedInteract = results.filter((r) => r.hasPostInteractJsErrors);
      const routesWithInteractions = results.filter((r) => r.interacts.some((i) => i.clicked));
      const totalClicks = results.reduce(
        (sum, r) => sum + r.interacts.filter((i) => i.clicked).length,
        0
      );

      const lines: string[] = [
        "# Dashboard Interactions Crawl Report",
        "",
        `Total routes tested:          ${results.length}`,
        `Routes that loaded OK:        ${results.length - failedLoad.length}`,
        `Routes with interactions:     ${routesWithInteractions.length}`,
        `Total clicks performed:       ${totalClicks}`,
        `Routes with post-interact JS errors: ${failedInteract.length}`,
        "",
        "## Post-interaction JS errors",
        "",
      ];

      if (failedInteract.length === 0) {
        lines.push("(none — all clean)");
      } else {
        for (const r of failedInteract) {
          lines.push(`### ${r.path}`);
          for (const i of r.interacts.filter((i) => i.jsErrors.length > 0)) {
            lines.push(`- **${i.desc}**: ${i.jsErrors.join(" | ")}`);
          }
          lines.push("");
        }
      }

      lines.push(
        "",
        "## All routes",
        "",
        "Format: `STATUS  path  (loadMs, N/M clicked)  [target list]`",
        ""
      );

      for (const r of results) {
        const tag = !r.loadOk
          ? "LOAD-FAIL"
          : r.hasPostInteractJsErrors
          ? "JS-ERROR "
          : "OK       ";

        const clicks = r.interacts.filter((i) => i.clicked).length;
        const total = r.interacts.length;
        const targets = r.interacts.length
          ? r.interacts
              .map((i) => {
                const icon = i.jsErrors.length ? "⚠" : i.clicked ? "✓" : "✗";
                return `${icon} ${i.desc.slice(0, 30)}`;
              })
              .join(",  ")
          : "(no targets found)";

        lines.push(
          `- ${tag}  ${r.path}  (${r.loadMs}ms, ${clicks}/${total} clicked)  [${targets}]`
        );
      }

      const report = lines.join("\n");
      // eslint-disable-next-line no-console
      console.log(report);

      await testInfo.attach("interactions-crawl-report.md", {
        body: report,
        contentType: "text/markdown",
      });
      await testInfo.attach("interactions-crawl.json", {
        body: JSON.stringify(results, null, 2),
        contentType: "application/json",
      });

      // ── 5. Assert ──────────────────────────────────────────────────────────
      // Fail only on JS errors triggered by interactions (not load errors —
      // those surface in sidebar-crawl.spec.ts).
      const errorPaths = failedInteract.map((r) => r.path);
      expect(
        errorPaths,
        `${errorPaths.length} route(s) produced JS errors after UI interaction:\n${errorPaths.join("\n")}`
      ).toHaveLength(0);
    }
  );
});
