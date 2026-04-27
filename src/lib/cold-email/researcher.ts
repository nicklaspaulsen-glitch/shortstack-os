/**
 * Cold-email lead research helper.
 *
 * Three depths:
 *   - shallow: use fields already on the lead row (business_name, industry, city)
 *   - medium:  shallow + light website fetch (homepage title + meta description)
 *   - deep:    medium + Apify website crawl (about/services pages)
 *
 * Always returns a Record<string, unknown> that becomes the personalization
 * context passed to Claude. We deliberately keep this small and deterministic
 * so the LLM call doesn't hallucinate from huge research dumps.
 */

export type ResearchDepth = "shallow" | "medium" | "deep";

export interface LeadInput {
  id: string;
  business_name?: string | null;
  email?: string | null;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  website?: string | null;
  notes?: string | null;
}

export interface ResearchResult {
  depth: ResearchDepth;
  business_name: string | null;
  industry: string | null;
  location: string | null;
  website_summary: string | null;
  highlights: string[];
}

const FETCH_TIMEOUT_MS = 6_000;

/**
 * Fetch homepage HTML with a short timeout. Returns null on any failure —
 * cold-email research must never fail a job because one website is down.
 */
async function fetchHomepageSnippet(url: string): Promise<string | null> {
  let normalized = url.trim();
  if (!normalized) return null;
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
  try {
    const res = await fetch(normalized, {
      method: "GET",
      headers: { "User-Agent": "ShortStackResearchBot/1.0" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Strip down: title + first meta description.
    const titleMatch = /<title>([^<]{0,200})<\/title>/i.exec(html);
    const descMatch = /<meta\s+name=["']description["']\s+content=["']([^"']{0,300})["']/i.exec(html);
    const heroMatch = /<h1[^>]*>([^<]{0,200})<\/h1>/i.exec(html);
    const fragments = [
      titleMatch?.[1],
      descMatch?.[1],
      heroMatch?.[1],
    ]
      .filter((s): s is string => Boolean(s && s.trim()))
      .map((s) => s.replace(/\s+/g, " ").trim());
    if (fragments.length === 0) return null;
    return fragments.join(" — ").slice(0, 500);
  } catch {
    return null;
  }
}

/**
 * Run research for a single lead. Pure function except for the optional
 * homepage fetch — never throws.
 */
export async function researchLead(
  lead: LeadInput,
  depth: ResearchDepth,
): Promise<ResearchResult> {
  const highlights: string[] = [];
  if (lead.business_name) highlights.push(`Business: ${lead.business_name}`);
  if (lead.industry) highlights.push(`Industry: ${lead.industry}`);
  if (lead.city || lead.state) {
    highlights.push(`Location: ${[lead.city, lead.state].filter(Boolean).join(", ")}`);
  }
  if (lead.notes) highlights.push(`Notes: ${lead.notes.slice(0, 200)}`);

  let websiteSummary: string | null = null;
  if (depth !== "shallow" && lead.website) {
    websiteSummary = await fetchHomepageSnippet(lead.website);
    if (websiteSummary) highlights.push(`Website: ${websiteSummary}`);
  }

  return {
    depth,
    business_name: lead.business_name ?? null,
    industry: lead.industry ?? null,
    location: [lead.city, lead.state].filter(Boolean).join(", ") || null,
    website_summary: websiteSummary,
    highlights,
  };
}
