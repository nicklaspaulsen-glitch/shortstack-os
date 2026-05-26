/**
 * Portal Pages Smoke Test — all /dashboard/portal/* sub-pages
 *
 * Visits each portal sub-page and checks:
 *   1. No critical JS errors
 *   2. No 404 / "page not found" / "something went wrong" text
 *   3. Page renders at least one visible element (heading or link or panel)
 *
 * Not a deep functional test — just verifies every page loads and
 * doesn't blow up on first render.
 */

import { test, expect } from "@playwright/test";
import { hasTestCreds, waitForDashboardReady } from "../helpers/auth";

const PORTAL_ROUTES = [
  { path: "/dashboard/portal",                   label: "Portal home" },
  { path: "/dashboard/portal/reports",           label: "Reports" },
  { path: "/dashboard/portal/content",           label: "Content" },
  { path: "/dashboard/portal/calendar",          label: "Calendar" },
  { path: "/dashboard/portal/agency-room",       label: "Agency room" },
  { path: "/dashboard/portal/uploads",           label: "Uploads" },
  { path: "/dashboard/portal/support",           label: "Support" },
  { path: "/dashboard/portal/billing",           label: "Billing" },
  { path: "/dashboard/portal/leads",             label: "Leads" },
  { path: "/dashboard/portal/outreach",          label: "Outreach" },
  { path: "/dashboard/portal/outreach-feed",     label: "Outreach feed" },
  { path: "/dashboard/portal/socials",           label: "Socials" },
  { path: "/dashboard/portal/settings",          label: "Settings" },
  { path: "/dashboard/portal/setup",             label: "Setup" },
];

// Match genuine error page headings only — NOT partial matches inside table cells or
// status text (e.g. "email not found" in a leads table, "location not found" etc.).
// We look for these patterns anchored to h1/h2 elements, not anywhere in the DOM.
const ERROR_HEADING_PATTERNS = /^(404|page not found|something went wrong|internal server error)$/i;

test.describe("Portal pages — smoke", () => {
  test.beforeAll(() => {
    test.skip(
      !hasTestCreds(),
      "E2E credentials not set — skipping portal smoke tests",
    );
  });

  for (const { path, label } of PORTAL_ROUTES) {
    test(`${label} (${path}) loads without errors`, async ({ page }) => {
      test.setTimeout(60_000);

      const jsErrors: string[] = [];
      page.on("pageerror", (e) => {
        // Filter noise: ResizeObserver, unhandled promise rejections from
        // third-party widgets, and Next.js hydration warnings are expected.
        const msg = e.message;
        if (
          !msg.includes("ResizeObserver") &&
          !msg.includes("Non-Error promise rejection") &&
          !msg.includes("hydration") &&
          !msg.includes("ChunkLoadError")
        ) {
          jsErrors.push(msg);
        }
      });

      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
      await waitForDashboardReady(page);
      await page.waitForTimeout(1500);

      // 1. No critical JS errors
      expect(jsErrors, `JS errors on ${path}: ${jsErrors.join("; ")}`).toHaveLength(0);

      // 2. No error page heading — check h1/h2 only to avoid false positives from
      //    table cell content like "not found" in status columns.
      const errorVisible = await page
        .locator("h1, h2")
        .filter({ hasText: ERROR_HEADING_PATTERNS })
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      expect(errorVisible, `Error page shown on ${path}`).toBe(false);

      // 3. Something visible: heading OR link OR glass panel
      const hasHeading = await page
        .locator("h1, h2")
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      const hasLink = await page
        .getByRole("link")
        .nth(1)
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      const hasPanel = await page
        .locator('[class*="glass"], [class*="rounded-xl"], [class*="rounded-2xl"]')
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      expect(
        hasHeading || hasLink || hasPanel,
        `${path} appears blank — no heading, link, or panel found`,
      ).toBe(true);
    });
  }
});
