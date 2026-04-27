import type { ProspectData } from "../shared/types";

// LinkedIn's class names are obfuscated and change frequently. We rely
// on stable structural selectors (h1 in main, [data-section], aria
// labels) and fall back gracefully when individual fields can't be
// found. None of this is brittle enough that one selector failure
// breaks the rest of the pipeline.

function text(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function querySelectorByLabels(...labels: string[]): Element | null {
  for (const label of labels) {
    const el = document.querySelector(`[aria-label*="${label}" i]`);
    if (el) return el;
  }
  return null;
}

function splitName(full: string): { firstName?: string; lastName?: string } {
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function pickProfileImage(): string | undefined {
  // Preferred: the main avatar inside the hero section.
  const avatar = document.querySelector<HTMLImageElement>(
    "main img.pv-top-card-profile-picture__image, main img.profile-photo-edit__preview, main img[width='400']",
  );
  if (avatar?.src) return avatar.src;
  // Fallback: any large img inside the page header
  const fallback = document.querySelector<HTMLImageElement>(
    "main section img[srcset], main img.evi-image",
  );
  return fallback?.src;
}

function pickHeadline(): string {
  // The headline sits below the H1 inside the hero.
  // Multiple LinkedIn variants — try the most stable first.
  const candidates = [
    "main section .text-body-medium.break-words",
    "main .pv-text-details__left-panel .text-body-medium",
    "main .ph5 .text-body-medium",
    "main h1 + div",
  ];
  for (const sel of candidates) {
    const t = text(document.querySelector(sel));
    if (t) return t;
  }
  return "";
}

function pickLocation(): string {
  const candidates = [
    "main .pv-text-details__left-panel .text-body-small.inline.t-black--light",
    "main .ph5 .text-body-small.inline",
    "main span.text-body-small.t-black--light",
  ];
  for (const sel of candidates) {
    const t = text(document.querySelector(sel));
    if (t) return t;
  }
  return "";
}

function pickCurrentRoleAndCompany(): { role: string; company: string } {
  // The "current position" lives in the experience aside on the hero.
  // Recent LinkedIn variants:
  // 1) <button aria-label="Current company: ACME"> wrapping a div with
  //    the company name.
  // 2) The experience section: first <li> under
  //    <section id="experience"> with role + company spans.
  const heroBtn = querySelectorByLabels(
    "Current company",
    "Current company:",
    "Current position",
  );
  if (heroBtn) {
    // Example aria-label: "Current company: ACME Co"
    const aria = heroBtn.getAttribute("aria-label") ?? "";
    const colonIdx = aria.indexOf(":");
    const company = colonIdx >= 0 ? aria.slice(colonIdx + 1).trim() : "";
    // The role is the headline-ish text inside the button or sibling.
    const role = text(heroBtn);
    if (company) return { role: role || "", company };
  }

  // Fallback: parse experience section
  const expSection = document.getElementById("experience")?.parentElement;
  if (expSection) {
    const firstLi = expSection.querySelector("li");
    if (firstLi) {
      const spans = firstLi.querySelectorAll("span[aria-hidden='true']");
      const roleText = text(spans[0]);
      const companyText = text(spans[1]);
      if (roleText) {
        // companyText sometimes includes employment type (Full-time · ...);
        // strip after the bullet if present.
        const company = companyText.split("·")[0]?.trim() ?? "";
        return { role: roleText, company };
      }
    }
  }

  return { role: "", company: "" };
}

export function extractProspect(): ProspectData | null {
  // Must be on a profile (URL check should already have happened)
  const h1 = document.querySelector<HTMLHeadingElement>("main h1");
  const fullName = text(h1);
  if (!fullName) return null;

  const headline = pickHeadline();
  const location = pickLocation();
  const { role, company } = pickCurrentRoleAndCompany();
  const profileImageUrl = pickProfileImage();

  // Canonicalize URL: keep the /in/<handle> path; strip query string.
  const canonical = new URL(window.location.href);
  canonical.search = "";
  canonical.hash = "";

  const { firstName, lastName } = splitName(fullName);

  return {
    fullName,
    firstName,
    lastName,
    headline,
    company,
    role,
    location,
    linkedinUrl: canonical.toString(),
    profileImageUrl,
    pageTitle: document.title,
    detectedAt: Date.now(),
  };
}
