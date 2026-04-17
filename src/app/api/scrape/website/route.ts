import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

export const maxDuration = 60;

/**
 * POST /api/scrape/website
 * ----------------------------------
 * Body: { url: string }
 * Auth required.
 *
 * Pulls the page HTML, deterministically extracts business signals
 * (name, description, logo, colors, social links, contact info, address,
 * keywords, tech stack, OG image), then runs the extracted text through
 * Claude Haiku for higher-level analysis (industry, audience, value prop,
 * services, brand voice, estimated size).
 */
export async function POST(req: NextRequest) {
  // Auth
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  // Parse request
  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!rawUrl) return NextResponse.json({ error: "URL is required" }, { status: 400 });

  // Normalize + validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: "URL must use http or https" }, { status: 400 });
  }

  // Fetch
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let html = "";
  try {
    const res = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ShortStackBot/1.0; +https://shortstack.work)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      clearTimeout(timeout);
      return NextResponse.json(
        { error: `Website returned ${res.status}` },
        { status: 422 }
      );
    }
    html = await res.text();
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error && err.name === "AbortError"
      ? "Website took too long to respond (15s timeout)"
      : "Could not fetch website. Check the URL and try again.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
  clearTimeout(timeout);

  if (!html || html.length < 50) {
    return NextResponse.json({ error: "Website returned no content" }, { status: 422 });
  }

  // Deterministic extraction
  const extracted = extractFromHtml(html, parsedUrl);

  // AI summary via Haiku (graceful on failure)
  let ai: AIAnalysis | null = null;
  try {
    ai = await runHaikuAnalysis(extracted, parsedUrl.toString());
  } catch (err) {
    console.error("[scrape/website] AI analysis failed:", err);
  }

  // Log (non-blocking)
  void createServiceClient().from("trinity_log").insert({
    action_type: "custom",
    description: `Website scraped: ${parsedUrl.hostname}`,
    status: "completed",
    user_id: user.id,
    result: { url: parsedUrl.toString(), business_name: extracted.businessName },
    metadata: {
      kind: "website_scrape",
      hostname: parsedUrl.hostname,
      had_ai: !!ai,
    },
  });

  return NextResponse.json({
    success: true,
    url: parsedUrl.toString(),
    extracted,
    ai,
  });
}

/* ─── Types ─────────────────────────────────────────────────────────── */
interface ExtractedData {
  businessName: string;
  description: string;
  logo: string;
  primaryColor: string | null;
  ogImage: string;
  socialLinks: { platform: string; url: string }[];
  phones: string[];
  emails: string[];
  address: string | null;
  keywords: string[];
  services: string[];
  techStack: string[];
}

interface AIAnalysis {
  industry: string;
  audience: string;
  valueProposition: string;
  services: string[];
  brandVoice: string;
  estimatedSize: string;
}

/* ─── Extraction ────────────────────────────────────────────────────── */
function extractFromHtml(html: string, url: URL): ExtractedData {
  const origin = url.origin;
  const text = stripHtmlForText(html);

  // Business name
  let businessName = "";
  const ogSiteName = matchAttr(html, /property=["']og:site_name["']/i);
  if (ogSiteName) businessName = ogSiteName;
  if (!businessName) {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      businessName = decodeHtmlEntities(
        titleMatch[1].replace(/\s+\|.*$/, "").replace(/\s+-\s+.*$/, "").trim()
      );
    }
  }
  if (!businessName) {
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1) businessName = decodeHtmlEntities(stripTags(h1[1]).trim());
  }

  // Description
  let description =
    matchAttr(html, /name=["']description["']/i) ||
    matchAttr(html, /property=["']og:description["']/i) ||
    "";
  description = decodeHtmlEntities(description);

  // Logo (favicon, og:image as fallback)
  let logo = "";
  const apple = html.match(/rel=["']apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)["']/i);
  if (apple) logo = resolveUrl(apple[1], origin);
  if (!logo) {
    const fav = html.match(/rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i)
      || html.match(/href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i);
    if (fav) logo = resolveUrl(fav[1], origin);
  }
  const ogImage = matchAttr(html, /property=["']og:image["']/i);
  const ogImageAbs = ogImage ? resolveUrl(ogImage, origin) : "";
  if (!logo && ogImageAbs) logo = ogImageAbs;

  // Primary color (theme-color or first hex in inline style)
  let primaryColor: string | null = matchAttr(html, /name=["']theme-color["']/i) || null;
  if (!primaryColor) {
    const hex = html.match(/(?:background(?:-color)?|color)\s*:\s*(#[0-9a-fA-F]{3,8})/);
    if (hex) primaryColor = hex[1];
  }

  // Social links
  const socialPatterns: { platform: string; rx: RegExp }[] = [
    { platform: "twitter", rx: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9_./?=#-]+/gi },
    { platform: "facebook", rx: /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_./?=#-]+/gi },
    { platform: "instagram", rx: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_./?=#-]+/gi },
    { platform: "linkedin", rx: /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company|pub)\/[A-Za-z0-9_./?=#-]+/gi },
    { platform: "tiktok", rx: /https?:\/\/(?:www\.)?tiktok\.com\/@?[A-Za-z0-9_./?=#-]+/gi },
    { platform: "youtube", rx: /https?:\/\/(?:www\.)?youtube\.com\/(?:c|user|channel|@)?[A-Za-z0-9_./?=#-]*/gi },
  ];
  const socialLinks: { platform: string; url: string }[] = [];
  const seenSocial = new Set<string>();
  for (const { platform, rx } of socialPatterns) {
    const m = html.match(rx);
    if (m) {
      for (const raw of m) {
        const cleaned = raw.replace(/[\s"'<>]+$/g, "").replace(/[)\].,]+$/, "");
        if (cleaned.endsWith("/sharer") || cleaned.endsWith("/intent")) continue;
        if (cleaned.includes("/share?") || cleaned.includes("intent/tweet")) continue;
        const key = platform + "|" + cleaned;
        if (!seenSocial.has(key)) {
          seenSocial.add(key);
          socialLinks.push({ platform, url: cleaned });
          if (socialLinks.filter(s => s.platform === platform).length >= 2) break;
        }
      }
    }
  }

  // Phones (US/EU friendly regex; deduped + length-filtered)
  const phoneRx = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/g;
  const rawPhones = (text.match(phoneRx) || [])
    .map(p => p.trim())
    .filter(p => {
      const digits = p.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15;
    });
  const phones = Array.from(new Set(rawPhones)).slice(0, 5);

  // Emails (exclude generic noreply / wixpress / sentry-style domain noise)
  const emailRx = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  const rawEmails = (text.match(emailRx) || [])
    .map(e => e.toLowerCase())
    .filter(e => {
      if (e.startsWith("info@")) return false;
      if (e.startsWith("noreply@")) return false;
      if (e.startsWith("no-reply@")) return false;
      if (e.endsWith("@sentry-next.wixpress.com")) return false;
      if (e.endsWith(".png") || e.endsWith(".jpg") || e.endsWith(".webp")) return false;
      return true;
    });
  const emails = Array.from(new Set(rawEmails)).slice(0, 5);

  // Address (schema.org LocalBusiness JSON-LD)
  let address: string | null = null;
  const ldMatches = Array.from(
    html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  );
  for (const m of ldMatches) {
    try {
      const json = JSON.parse(m[1]);
      const items = Array.isArray(json) ? json : [json];
      for (const it of items) {
        const t = it?.["@type"];
        const isLocal = (typeof t === "string" && /LocalBusiness|Organization|Restaurant|Store/i.test(t))
          || (Array.isArray(t) && t.some((x: string) => /LocalBusiness|Organization|Restaurant|Store/i.test(x)));
        if (isLocal && it.address) {
          const a = it.address;
          if (typeof a === "string") {
            address = a;
          } else if (a && typeof a === "object") {
            address = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry]
              .filter(Boolean).join(", ");
          }
          if (address) break;
        }
      }
    } catch { /* ignore malformed */ }
    if (address) break;
  }

  // Keywords / services
  const metaKeywords = matchAttr(html, /name=["']keywords["']/i);
  const keywordsFromMeta = metaKeywords ? metaKeywords.split(",").map(s => s.trim()).filter(Boolean) : [];
  const headings: string[] = [];
  const hRx = /<(h1|h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hRx.exec(html)) && headings.length < 30) {
    const t = decodeHtmlEntities(stripTags(hm[2])).trim();
    if (t && t.length > 2 && t.length < 150) headings.push(t);
  }
  const strongs: string[] = [];
  const sRx = /<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = sRx.exec(html)) && strongs.length < 30) {
    const t = decodeHtmlEntities(stripTags(sm[2])).trim();
    if (t && t.length > 2 && t.length < 100) strongs.push(t);
  }

  const keywords = Array.from(new Set([
    ...keywordsFromMeta,
    ...headings.slice(0, 12),
    ...strongs.slice(0, 8),
  ])).slice(0, 25);

  // Services (heuristic — pull headings that look like service names)
  const services = headings
    .filter(h => /^[A-Z]/.test(h) && h.length < 60 && !/welcome|about|contact|home/i.test(h))
    .slice(0, 8);

  // Tech stack hints
  const techStack: string[] = [];
  const tech: { name: string; rx: RegExp }[] = [
    { name: "WordPress", rx: /wp-content|wp-includes|generator["'][^>]*WordPress/i },
    { name: "Shopify", rx: /cdn\.shopify\.com|Shopify\.theme/i },
    { name: "Wix", rx: /wixstatic\.com|wix\.com|X-Wix-/i },
    { name: "Squarespace", rx: /squarespace\.com|sqs-html/i },
    { name: "Webflow", rx: /webflow\.com|w-mod-js/i },
    { name: "Next.js", rx: /__NEXT_DATA__|_next\/static/i },
    { name: "React", rx: /react(?:-dom)?(?:[.-]production)?\.min\.js|data-reactroot/i },
    { name: "Vue", rx: /vue(?:\.global)?(?:[.-]production)?\.min\.js|data-v-app/i },
    { name: "Tailwind", rx: /tailwind|--tw-/i },
    { name: "Bootstrap", rx: /bootstrap(?:\.min)?\.css/i },
    { name: "Google Tag Manager", rx: /googletagmanager\.com/i },
    { name: "Google Analytics", rx: /google-analytics\.com|gtag\(/i },
    { name: "Meta Pixel", rx: /connect\.facebook\.net\/[^"']*\/fbevents\.js/i },
    { name: "HubSpot", rx: /js\.hs-scripts\.com|hubspot\.com/i },
    { name: "Mailchimp", rx: /mailchimp\.com|mc\.us\d/i },
    { name: "Stripe", rx: /js\.stripe\.com/i },
    { name: "Cloudflare", rx: /cloudflare\.com|cf-ray/i },
  ];
  for (const t of tech) {
    if (t.rx.test(html)) techStack.push(t.name);
  }

  return {
    businessName: businessName || url.hostname,
    description,
    logo,
    primaryColor,
    ogImage: ogImageAbs,
    socialLinks,
    phones,
    emails,
    address,
    keywords,
    services,
    techStack,
  };
}

/* ─── AI analysis (Claude Haiku w/ prompt caching) ──────────────────── */
const AI_SYSTEM_PROMPT = `You analyze website data extracted from a single page and produce a structured business summary.

INPUT
You receive deterministic signals from a website: name, description, headings, services, social links, tech stack, contact info, and OG metadata.

TASK
From those signals, infer the business's:
- industry: A short noun phrase (e.g. "Family dentistry", "B2B SaaS for HR teams", "Italian restaurant").
- audience: One sentence describing who this business primarily serves.
- valueProposition: One sentence capturing the core promise to customers (in plain language, no marketing fluff).
- services: Up to 5 specific services or product offerings, each 2-6 words.
- brandVoice: One of "formal", "casual", "playful", "professional", "luxury", "technical".
- estimatedSize: One of "solo", "small", "medium", "enterprise". Use the tech stack, content depth, and language as cues.

GUIDANCE
- If a signal is missing, infer reasonably or write "unknown".
- Never invent specific numbers, addresses, or claims that aren't supported by the input.
- Prefer concrete language over generic.

OUTPUT
Respond with ONLY raw JSON (no markdown fences, no commentary):
{
  "industry": "...",
  "audience": "...",
  "valueProposition": "...",
  "services": ["...", "..."],
  "brandVoice": "...",
  "estimatedSize": "..."
}`;

async function runHaikuAnalysis(extracted: ExtractedData, url: string): Promise<AIAnalysis | null> {
  const userText = `URL: ${url}

Business name: ${extracted.businessName}
Description: ${extracted.description || "(none)"}
Address: ${extracted.address || "(none)"}
Phones: ${extracted.phones.join(", ") || "(none)"}
Emails: ${extracted.emails.join(", ") || "(none)"}
Services (headings): ${extracted.services.join(" | ") || "(none)"}
Keywords: ${extracted.keywords.slice(0, 15).join(", ") || "(none)"}
Social links: ${extracted.socialLinks.map(s => `${s.platform}=${s.url}`).join(" | ") || "(none)"}
Tech stack: ${extracted.techStack.join(", ") || "(none)"}

Return JSON only.`;

  const resp = await anthropic.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 800,
    system: [
      {
        type: "text",
        text: AI_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userText }],
  });

  const raw = getResponseText(resp);
  const parsed = safeJsonParse<Partial<AIAnalysis>>(raw);
  if (!parsed) return null;

  return {
    industry: typeof parsed.industry === "string" ? parsed.industry : "unknown",
    audience: typeof parsed.audience === "string" ? parsed.audience : "unknown",
    valueProposition: typeof parsed.valueProposition === "string" ? parsed.valueProposition : "unknown",
    services: Array.isArray(parsed.services)
      ? parsed.services.filter((s): s is string => typeof s === "string").slice(0, 5)
      : [],
    brandVoice: typeof parsed.brandVoice === "string" ? parsed.brandVoice : "professional",
    estimatedSize: typeof parsed.estimatedSize === "string" ? parsed.estimatedSize : "small",
  };
}

/* ─── Helpers ───────────────────────────────────────────────────────── */
function stripHtmlForText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function matchAttr(html: string, nameRx: RegExp): string {
  // Try `<meta name="..." content="...">` and reverse order
  const src = html;
  const flagged = new RegExp(nameRx.source, nameRx.flags.includes("i") ? "i" : "");
  // forward
  const re1 = new RegExp(`<meta[^>]*${flagged.source}[^>]*content=["']([^"']+)["'][^>]*>`, "i");
  const m1 = src.match(re1);
  if (m1) return decodeHtmlEntities(m1[1].trim());
  // reverse
  const re2 = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*${flagged.source}[^>]*>`, "i");
  const m2 = src.match(re2);
  if (m2) return decodeHtmlEntities(m2[1].trim());
  return "";
}

function resolveUrl(href: string, origin: string): string {
  try {
    return new URL(href, origin).toString();
  } catch {
    return href;
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}
