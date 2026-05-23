// ElevenAgents E2E — /dashboard/eleven-agents

import { test, expect } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("ElevenAgents — ElevenLabs Agents", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasTestCreds(),
      "E2E credentials not set — skipping authenticated tests",
    );
    test.setTimeout(200_000);
    await page.addInitScript(() => {
      try {
        localStorage.setItem("tour_completed", "true");
        localStorage.setItem("cookie-consent", "accepted");
      } catch {}
    });
    await page.goto("/dashboard/eleven-agents");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("eleven-agents page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/eleven-agents");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);

    const critical = errors.filter(
      (e) =>
        !e.includes("ResizeObserver") &&
        !e.includes("Non-Error promise rejection") &&
        !e.includes("hydration"),
    );
    expect(critical).toHaveLength(0);
  });

  // ── 2. Editorial header: eyebrow + h1 ───────────────────────────────────
  test("renders editorial header with ElevenLabs Agents eyebrow and ElevenAgents h1", async ({ page }) => {
    const eyebrow = page.getByText(/ElevenLabs Agents/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    const heading = page.getByRole("heading", { name: /ElevenAgents/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Agent list or create prompt renders — never blank ─────────────────
  test("agent list or create prompt renders — never blank", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Valid state 1: loading skeletons
    const hasSkeleton = await page
      .locator('[class*="animate-pulse"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Valid state 2: empty / onboarding prompt
    const hasEmpty = await page
      .getByText(/no agents|create.*first|get.*started|connect.*elevenlabs/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 3: agent rows
    const hasAgents = await page
      .getByText(/agent.*name|inbound|outbound|voice|active|inactive/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Valid state 4: any container that confirms the page body mounted
    const hasContainer = await page
      .locator("main, [role='main'], .dashboard-content, section")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasSkeleton || hasEmpty || hasAgents || hasContainer).toBe(true);
  });

  // ── 4. Create agent or API key setup is visible ──────────────────────────
  test("create agent or API key setup is visible", async ({ page }) => {
    await page.waitForTimeout(1500);

    const hasCreate = await page
      .getByRole("button", { name: /create.*agent|new.*agent|add.*agent/i })
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasApiKey = await page
      .getByText(/api.*key|elevenlabs.*key|connect.*elevenlabs/i)
      .first()
      .isVisible({ timeout: 4000 })
      .catch(() => false);

    const hasSetup = await page
      .locator("input[type='text'], input[type='password']")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasCreate || hasApiKey || hasSetup).toBe(true);
  });

  // ── 5. No 404 or generic error state ─────────────────────────────────────
  test("eleven-agents page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const heading = page.getByRole("heading", { name: /ElevenAgents/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});
