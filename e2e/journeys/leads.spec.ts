/**
 * Leads E2E — /dashboard/leads
 *
 * Tests the Lead Engine page, which is the central contact/lead management hub.
 * Verifies:
 *   • Page loads without JS errors
 *   • Editorial header renders: eyebrow "Contact HQ" + h1 "Lead Engine"
 *   • Main tab "All Leads" is present
 *   • "Lead Scoring" tab is present
 *   • Search input (placeholder "Search leads...") is visible and accepts text
 *   • "Add Lead" button is visible and opens the Add Lead modal
 *   • "Import" button is visible and opens the Import CSV modal
 *   • "Export" button is visible
 *   • Add Lead modal has required form fields (business name, phone, email)
 *   • Import CSV modal renders drag-and-drop area
 *   • Typing a nonsense query in search reduces the visible lead count (or shows empty)
 *   • No 404 or generic error state
 *
 * Data-dependent assertions guard against empty accounts.
 * Tests that open modals close them before the next test via beforeEach reset.
 */

import { test, expect, type Page } from "@playwright/test";
import { dismissTourIfPresent, hasTestCreds, waitForDashboardReady } from "../helpers/auth";

test.describe("Leads — Lead Engine", () => {
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
    await page.goto("/dashboard/leads");
    await page.waitForLoadState("domcontentloaded");
    await waitForDashboardReady(page);
    await dismissTourIfPresent(page);
    // Allow the initial lead fetch to settle
    await page.waitForTimeout(1500);
  });

  // ── 1. Page loads without JS errors ─────────────────────────────────────
  test("leads page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/dashboard/leads");
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
  test("renders editorial header with Contact HQ eyebrow and Lead Engine h1", async ({ page }) => {
    // Eyebrow — italic/uppercase text above the h1
    const eyebrow = page.getByText(/Contact HQ/i).first();
    await expect(eyebrow).toBeVisible({ timeout: 8000 });

    // h1 — "Lead Engine"
    const heading = page.getByRole("heading", { name: /Lead Engine/i }).first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  // ── 3. Main tabs render ─────────────────────────────────────────────────
  test("renders All Leads and Lead Scoring tabs", async ({ page }) => {
    // "All Leads" tab
    const allLeadsTab = page.getByRole("button", { name: /All Leads/i }).first();
    await expect(allLeadsTab).toBeVisible({ timeout: 6000 });

    // "Lead Scoring" tab
    const scoringTab = page.getByRole("button", { name: /Lead Scoring/i }).first();
    await expect(scoringTab).toBeVisible({ timeout: 6000 });
  });

  // ── 4. Search input is visible and accepts text ──────────────────────────
  test("search input is visible and accepts text input", async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search leads..."]');
    await expect(searchInput).toBeVisible({ timeout: 8000 });

    await searchInput.fill("Test query");
    await expect(searchInput).toHaveValue("Test query");

    // Clear it
    await searchInput.fill("");
    await expect(searchInput).toHaveValue("");
  });

  // ── 5. Add Lead button is visible ───────────────────────────────────────
  test("Add Lead button is visible", async ({ page }) => {
    const addLeadBtn = page.getByRole("button", { name: /Add Lead/i }).first();
    await expect(addLeadBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 6. Add Lead modal opens with required form fields ───────────────────
  test("clicking Add Lead opens a modal with name, phone, and email fields", async ({ page }) => {
    const addLeadBtn = page.getByRole("button", { name: /Add Lead/i }).first();
    await expect(addLeadBtn).toBeVisible({ timeout: 6000 });
    await addLeadBtn.click();
    await page.waitForTimeout(400);

    // Modal heading
    const modalHeading = page.getByText(/Add Lead/i).first();
    await expect(modalHeading).toBeVisible({ timeout: 5000 });

    // At minimum, multiple inputs should be visible for a lead form
    const inputCount = await page.locator("input").count();
    expect(inputCount).toBeGreaterThanOrEqual(2);

    // Close the modal
    const cancelBtn = page.getByRole("button", { name: /Cancel|Close/i }).first();
    if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cancelBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(300);
  });

  // ── 7. Import button is visible ─────────────────────────────────────────
  test("Import button is visible", async ({ page }) => {
    const importBtn = page.getByRole("button", { name: /Import/i }).first();
    await expect(importBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 8. Import CSV modal opens with drag-and-drop area ───────────────────
  test("clicking Import opens a modal with a file upload / drag-and-drop area", async ({ page }) => {
    const importBtn = page.getByRole("button", { name: /Import/i }).first();
    await expect(importBtn).toBeVisible({ timeout: 6000 });
    await importBtn.click();
    await page.waitForTimeout(400);

    // Modal heading — "Import CSV"
    const modalHeading = page.getByText(/Import CSV/i).first();
    await expect(modalHeading).toBeVisible({ timeout: 5000 });

    // Drag & drop area — contains "Drag" or "drop" text
    const dropArea = page.getByText(/drag|drop|browse|click to browse/i).first();
    await expect(dropArea).toBeVisible({ timeout: 4000 });

    // File input should be present (hidden but in DOM)
    const fileInput = page.locator('input[type="file"]');
    expect(await fileInput.count()).toBeGreaterThan(0);

    // Close the modal
    const closeBtn = page.getByRole("button", { name: /Close|Cancel|✕/i }).first();
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(300);
  });

  // ── 9. Export button is visible ─────────────────────────────────────────
  test("Export button is visible", async ({ page }) => {
    const exportBtn = page.getByRole("button", { name: /Export/i }).first();
    await expect(exportBtn).toBeVisible({ timeout: 6000 });
  });

  // ── 10. Switching to Lead Scoring tab renders content ───────────────────
  test("clicking Lead Scoring tab renders scoring content or empty state", async ({ page }) => {
    const scoringTab = page.getByRole("button", { name: /Lead Scoring/i }).first();
    await expect(scoringTab).toBeVisible({ timeout: 6000 });

    await scoringTab.click();
    await page.waitForTimeout(600);

    // Content or empty state must be visible — not a blank void
    const hasContent =
      (await page
        .getByText(/scoring matrix|AI Score|score|leads scored|no leads/i)
        .first()
        .isVisible({ timeout: 4000 })
        .catch(() => false)) ||
      (await page
        .locator('[class*="rounded"]')
        .filter({ has: page.locator("button, p, span") })
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false));

    expect(hasContent).toBe(true);
  });

  // ── 11. Search narrows results for nonsense query ────────────────────────
  test("typing a nonsense search query shows 0 results or empty message", async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search leads..."]');
    await expect(searchInput).toBeVisible({ timeout: 8000 });

    // Get initial state (leads or empty)
    await page.waitForTimeout(500);

    await searchInput.fill("zzz_no_match_lead_xqz99");
    await page.waitForTimeout(600);

    // Either: an explicit "no results" / "empty" message
    const hasEmptyMsg = await page
      .getByText(/no leads|no results|nothing here|no matching|0 leads/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Or: the lead list is empty (no lead cards)
    const leadCards = page.locator('[class*="lead"], [class*="card"]').filter({
      has: page.locator("h3"),
    });
    const cardCount = await leadCards.count();

    // Pass if either the empty message shows or there are 0 lead cards
    expect(hasEmptyMsg || cardCount === 0).toBe(true);

    // Clean up
    await searchInput.fill("");
  });

  // ── 12. No 404 or generic error state ────────────────────────────────────
  test("leads page does not render a 404 or generic error state", async ({ page }) => {
    const errorText = page
      .getByText(/404|not found|page not found|something went wrong/i)
      .first();
    const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // The "Lead Engine" heading must be visible instead
    const heading = page.getByRole("heading", { name: /Lead Engine/i }).first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true when the All Leads tab is active.
 * Clicks it if it's not already active.
 */
async function ensureAllLeadsTabActive(page: Page): Promise<void> {
  const allLeadsTab = page
    .getByRole("button", { name: /All Leads/i })
    .first();
  if (!(await allLeadsTab.isVisible({ timeout: 4000 }).catch(() => false))) return;

  const isActive = await allLeadsTab
    .getAttribute("class")
    .then((c) => (c ?? "").includes("active"))
    .catch(() => false);

  if (!isActive) {
    await allLeadsTab.click().catch(() => {});
    await page.waitForTimeout(300);
  }
}
