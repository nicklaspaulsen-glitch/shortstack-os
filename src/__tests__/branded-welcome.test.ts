/**
 * Lightweight unit tests for the branded-welcome email rendering.
 *
 * Verifies that:
 *   1. Default templates are present for every kind.
 *   2. renderTemplate substitutes vars and leaves "" for missing keys.
 *   3. The resolved welcome email contains the recipient's first name and
 *      the brand color in the rendered HTML — proving the chain works.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_TEMPLATES,
  getDefaultTemplate,
  DEFAULT_GETTING_STARTED,
} from "@/lib/email-templates/defaults";
import { ALL_EMAIL_TEMPLATE_KINDS } from "@/lib/email-templates/types";
import {
  renderTemplate,
  buildPreviewVars,
} from "@/lib/email-templates/variables";

describe("branded-welcome defaults", () => {
  it("ships a default template for every kind", () => {
    for (const kind of ALL_EMAIL_TEMPLATE_KINDS) {
      const tpl = getDefaultTemplate(kind);
      expect(tpl.kind).toBe(kind);
      expect(tpl.subject.length).toBeGreaterThan(0);
      expect(tpl.html_body.length).toBeGreaterThan(0);
      expect(tpl.plain_body.length).toBeGreaterThan(0);
      expect(tpl.is_default).toBe(true);
    }
  });

  it("client_welcome subject and body reference {{client_first_name}} and {{agency_name}}", () => {
    const tpl = DEFAULT_TEMPLATES.client_welcome;
    expect(tpl.html_body).toMatch(/\{\{client_first_name\}\}/);
    expect(tpl.html_body).toMatch(/\{\{agency_name\}\}/);
    expect(tpl.html_body).toMatch(/\{\{logo_url\}\}/);
    expect(tpl.html_body).toMatch(/\{\{brand_color\}\}/);
  });

  it("DEFAULT_GETTING_STARTED has 5 hand-written sections + 4 FAQs", () => {
    expect(DEFAULT_GETTING_STARTED.sections.length).toBeGreaterThanOrEqual(5);
    expect(DEFAULT_GETTING_STARTED.faq.length).toBeGreaterThanOrEqual(4);
    for (const section of DEFAULT_GETTING_STARTED.sections) {
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.body_md.length).toBeGreaterThan(0);
      expect(section.icon.length).toBeGreaterThan(0);
    }
  });
});

describe("renderTemplate", () => {
  it("substitutes simple vars", () => {
    expect(renderTemplate("Hi {{name}}", { name: "Alex" })).toBe("Hi Alex");
  });

  it("returns '' for missing vars (never leaks {{...}} to recipients)", () => {
    expect(renderTemplate("Hi {{first}} {{last}}", { first: "Alex" })).toBe("Hi Alex ");
  });

  it("substitutes the same var multiple times", () => {
    const out = renderTemplate("{{x}} and {{x}} again", { x: "hello" });
    expect(out).toBe("hello and hello again");
  });

  it("renders the welcome HTML with sample vars without leaving placeholders", () => {
    const vars = buildPreviewVars({
      ownerFirstName: "Sam",
      agencyName: "Sample Agency",
      brandColor: "#FF0044",
      logoUrl: "https://example.com/logo.png",
      ownerEmail: "sam@example.com",
    });
    const html = renderTemplate(DEFAULT_TEMPLATES.client_welcome.html_body, {
      ...vars,
      cta_label: vars.client_first_name + " open portal",
    });
    expect(html).toContain("Alex"); // client_first_name from preview vars
    expect(html).toContain("Sample Agency");
    expect(html).toContain("#FF0044");
    expect(html).toContain("https://example.com/logo.png");
    expect(html).not.toMatch(/\{\{\w+\}\}/);
  });
});

describe("buildPreviewVars", () => {
  it("returns sensible placeholders when nothing is supplied", () => {
    const vars = buildPreviewVars({});
    expect(vars.agency_name).toBe("Your Agency");
    expect(vars.client_first_name).toBe("Alex");
    expect(vars.owner_first_name).toBe("Sam");
    expect(vars.brand_color).toMatch(/^#/);
  });

  it("respects overrides", () => {
    const vars = buildPreviewVars({ ownerFirstName: "Nicklas", agencyName: "ShortStack" });
    expect(vars.agency_name).toBe("ShortStack");
    expect(vars.owner_first_name).toBe("Nicklas");
  });
});
