/**
 * Lightweight DOM snapshot for the browser worker.
 *
 * Returns up to 50 interactable elements (buttons, links, inputs, role widgets)
 * with stable selectors so the model can reliably target them. Each element
 * is annotated with `data-bw-idx` and a 1-line summary the model can read.
 *
 * Why not full DOM? Full HTML eats >100k tokens for typical SaaS apps; this
 * keeps the prompt under ~3k tokens for most pages.
 */
// Use playwright-core (matches agent-loop.ts) — see comment there for why.
import type { Page } from "playwright-core";

export interface DomElement {
  index: number;
  tag: string;
  /** Best selector — preferred order: data-testid > id > role+name > text. */
  selector: string;
  text: string;
  role?: string;
  type?: string;
  placeholder?: string;
  visible: boolean;
}

export interface DomSnapshot {
  url: string;
  title: string;
  elements: DomElement[];
  /** Page-level visible text (first 2000 chars), for context when no obvious target. */
  pageText: string;
}

/**
 * Extract a compact, indexed list of interactable elements from the page.
 * Tags every match with `data-bw-idx` so the model can refer to elements
 * by stable index even when DOM identity is otherwise unstable.
 */
export async function extractInteractableElements(page: Page): Promise<DomSnapshot> {
  const url = page.url();
  const title = await page.title().catch(() => "");

  // Tag elements + return their summaries from a single page.evaluate call.
  // This runs in the page context, so it has full DOM access without the
  // Playwright<>browser round-trip cost.
  const result = await page.evaluate(() => {
    const MAX_ELEMENTS = 50;
    const TEXT_LIMIT = 80;

    const out: Array<{
      index: number;
      tag: string;
      selector: string;
      text: string;
      role?: string;
      type?: string;
      placeholder?: string;
      visible: boolean;
    }> = [];

    function visibleText(el: Element): string {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      return t.slice(0, TEXT_LIMIT);
    }

    function isVisible(el: Element): boolean {
      const rect = (el as HTMLElement).getBoundingClientRect?.();
      if (!rect) return false;
      if (rect.width === 0 || rect.height === 0) return false;
      const style = window.getComputedStyle(el as HTMLElement);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return false;
      }
      return true;
    }

    function bestSelector(el: Element, idx: number): string {
      const t = (el as HTMLElement).getAttribute?.bind(el);
      if (!t) return `[data-bw-idx="${idx}"]`;
      const testId = t("data-testid");
      if (testId) return `[data-testid="${testId}"]`;
      const id = (el as HTMLElement).id;
      if (id) return `#${id}`;
      const name = t("name");
      if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;
      const aria = t("aria-label");
      if (aria) return `[aria-label="${aria.replace(/"/g, '\\"')}"]`;
      return `[data-bw-idx="${idx}"]`;
    }

    const selectors =
      "a, button, input, textarea, select, [role=button], [role=link], [role=textbox], [role=tab], [role=menuitem], [contenteditable=true]";
    const candidates = Array.from(document.querySelectorAll(selectors));
    let idx = 0;
    for (const el of candidates) {
      if (out.length >= MAX_ELEMENTS) break;
      if (!isVisible(el)) continue;
      const tag = el.tagName.toLowerCase();
      const role = (el as HTMLElement).getAttribute("role") || undefined;
      const type = (el as HTMLInputElement).type || undefined;
      const placeholder = (el as HTMLInputElement).placeholder || undefined;
      const text = visibleText(el);

      // Skip empty noise (icon-only buttons with no aria/name).
      if (!text && !placeholder && !(el as HTMLElement).getAttribute("aria-label")) {
        if (tag !== "input" && tag !== "textarea" && tag !== "select") continue;
      }

      // Tag for stable downstream selection.
      (el as HTMLElement).setAttribute("data-bw-idx", String(idx));

      out.push({
        index: idx,
        tag,
        selector: bestSelector(el, idx),
        text,
        role,
        type,
        placeholder,
        visible: true,
      });
      idx++;
    }

    const pageText = (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 2000);

    return { elements: out, pageText };
  });

  return {
    url,
    title,
    elements: result.elements,
    pageText: result.pageText,
  };
}

/**
 * Format a DOM snapshot as compact text for the model prompt.
 * One line per element, kept under ~150 chars per row.
 */
export function formatSnapshotForPrompt(snap: DomSnapshot): string {
  const lines: string[] = [];
  lines.push(`URL: ${snap.url}`);
  if (snap.title) lines.push(`Title: ${snap.title}`);
  lines.push("");
  lines.push("Interactable elements (selector → text):");
  for (const el of snap.elements) {
    const labelParts: string[] = [];
    if (el.role) labelParts.push(`role=${el.role}`);
    if (el.type) labelParts.push(`type=${el.type}`);
    if (el.placeholder) labelParts.push(`placeholder=${el.placeholder.slice(0, 40)}`);
    const label = labelParts.length > 0 ? ` (${labelParts.join(", ")})` : "";
    const text = el.text || "(no text)";
    lines.push(`  [${el.index}] <${el.tag}>${label} ${el.selector} → ${text}`);
  }
  lines.push("");
  lines.push("Visible text on page (first 2000 chars):");
  lines.push(snap.pageText);
  return lines.join("\n");
}
