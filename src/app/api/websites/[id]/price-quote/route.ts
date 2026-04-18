import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU, getResponseText, safeJsonParse } from "@/lib/ai/claude-helpers";

/**
 * Complexity analyzer + custom monthly pricing for a generated website.
 *
 * GET  /api/websites/[id]/price-quote
 * POST /api/websites/[id]/price-quote        body: { addons?: string[], persist?: boolean }
 *
 * Pricing model
 *  Base                             $9 / mo  (hosting + SSL)
 *  +$5 / mo per 1000 monthly visitors expected
 *  +$10 / mo  has animations / 3D
 *  +$15 / mo  has e-commerce / payments
 *  +$10 / mo  has forms / CRM integration
 *  +$20 / mo  has blog / CMS
 *  +$5 / mo per custom domain
 *  +$25 / mo  priority support tier
 *
 * Tier ranges
 *   Starter  $9–19    simple one-pager
 *   Pro      $29–49   multi-section with animations
 *   Business $59–99   complex with CMS / forms / integrations
 *   Premium  $149+    everything, custom everything
 *
 * Yearly = monthly * 12 * 0.83  (17% off, rounded to .99)
 */

type ComplexityFlags = {
  has_animations: boolean;
  has_3d: boolean;
  has_ecommerce: boolean;
  has_payments: boolean;
  has_forms: boolean;
  has_crm: boolean;
  has_blog: boolean;
  has_cms: boolean;
  has_video_bg: boolean;
  has_gallery: boolean;
  section_count: number;
  visitor_tier: number; // estimated 1000s of monthly visitors (1, 5, 10, 25)
  notes: string;
};

type Tier = "starter" | "pro" | "business" | "premium";

const ADDON_PRICES: Record<string, { label: string; price: number }> = {
  custom_domain: { label: "Custom domain", price: 5 },
  priority_support: { label: "Priority support", price: 25 },
  advanced_analytics: { label: "Advanced analytics", price: 10 },
  ab_testing: { label: "A/B testing", price: 15 },
  white_label: { label: "White-label (no watermark)", price: 20 },
};

function yearly(monthly: number): number {
  // 17% off, snapped to .99
  const raw = monthly * 12 * 0.83;
  return Math.max(monthly * 9, Math.floor(raw) + 0.99);
}

function pickTier(monthly: number): Tier {
  if (monthly <= 19) return "starter";
  if (monthly <= 49) return "pro";
  if (monthly <= 99) return "business";
  return "premium";
}

/**
 * Naive heuristic over the generated index.html + wizard answers — used as a
 * fallback when Claude Haiku is unavailable so we always return a quote.
 */
function heuristicAnalyze(
  html: string,
  wizard: Record<string, unknown>
): ComplexityFlags {
  const lower = html.toLowerCase();
  const sections = Array.isArray(wizard.sections) ? (wizard.sections as string[]) : [];
  const heroStyle = String(wizard.hero_style || "");
  const ctaGoal = String(wizard.cta_goal || "");

  const has_animations =
    /@keyframes|animation:|transition:|animate-\[/i.test(html) ||
    heroStyle === "interactive-gradient";
  const has_3d = heroStyle === "3d-spline" || /spline|three\.js|webgl/i.test(lower);
  const has_video_bg = heroStyle === "video-bg" || /<video[\s>]/i.test(lower);
  const has_ecommerce =
    sections.includes("pricing") ||
    ctaGoal === "buy-product" ||
    /add to cart|checkout|stripe|shopify/i.test(lower);
  const has_payments = has_ecommerce || /stripe|paypal|checkout/i.test(lower);
  const has_forms =
    sections.includes("contact") ||
    /<form[\s>]|email\s*capture|waitlist/i.test(lower);
  const has_crm = /hubspot|mailchimp|convertkit|intercom|salesforce/i.test(lower);
  const has_blog = sections.includes("blog-preview") || /<article[\s>]|blog/i.test(lower);
  const has_cms = has_blog;
  const has_gallery = sections.includes("gallery");

  const section_count = sections.length + 2; // hero + footer always
  const visitor_tier = section_count <= 4 ? 1 : section_count <= 7 ? 5 : 10;

  return {
    has_animations,
    has_3d,
    has_ecommerce,
    has_payments,
    has_forms,
    has_crm,
    has_blog,
    has_cms,
    has_video_bg,
    has_gallery,
    section_count,
    visitor_tier,
    notes: "heuristic",
  };
}

async function claudeAnalyze(
  html: string,
  wizard: Record<string, unknown>
): Promise<ComplexityFlags | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const systemPrompt = `You analyze generated one-page websites and return a strict JSON object describing complexity. Output JSON only, no prose.`;

  const userPrompt = `Analyze this generated website and return STRICT JSON matching this schema:
{
  "has_animations": boolean,
  "has_3d": boolean,
  "has_ecommerce": boolean,
  "has_payments": boolean,
  "has_forms": boolean,
  "has_crm": boolean,
  "has_blog": boolean,
  "has_cms": boolean,
  "has_video_bg": boolean,
  "has_gallery": boolean,
  "section_count": number,
  "visitor_tier": number,
  "notes": string
}

visitor_tier is the expected monthly visitors in thousands (1, 5, 10, 25, 50).

Wizard answers: ${JSON.stringify(wizard).slice(0, 1500)}

HTML (truncated): ${html.slice(0, 8000)}`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 800,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = getResponseText(response);
    return safeJsonParse<ComplexityFlags>(text);
  } catch (err) {
    console.error("[price-quote] claude analyze failed", err);
    return null;
  }
}

function calculateBreakdown(
  flags: ComplexityFlags,
  addons: string[],
  hasCustomDomain: boolean
) {
  const breakdown: Array<{ item: string; price: number }> = [
    { item: "Base hosting + SSL", price: 9 },
  ];

  if (flags.visitor_tier > 1) {
    const traffic = (flags.visitor_tier - 1) * 5;
    breakdown.push({ item: `Traffic (~${flags.visitor_tier}k visitors/mo)`, price: traffic });
  }

  if (flags.has_animations || flags.has_3d || flags.has_video_bg) {
    breakdown.push({ item: "Animations / 3D / video", price: 10 });
  }
  if (flags.has_ecommerce || flags.has_payments) {
    breakdown.push({ item: "E-commerce / payments", price: 15 });
  }
  if (flags.has_forms || flags.has_crm) {
    breakdown.push({ item: "Forms / CRM integration", price: 10 });
  }
  if (flags.has_blog || flags.has_cms) {
    breakdown.push({ item: "Blog / CMS", price: 20 });
  }

  if (hasCustomDomain) {
    breakdown.push({ item: "Custom domain", price: 5 });
  }

  for (const a of addons) {
    const def = ADDON_PRICES[a];
    if (def) breakdown.push({ item: def.label, price: def.price });
  }

  const monthly = breakdown.reduce((s, b) => s + b.price, 0);
  return { breakdown, monthly };
}

async function buildQuote(
  project: {
    id: string;
    name: string | null;
    custom_domain: string | null;
    generated_files: Record<string, string> | null;
    wizard_answers: Record<string, unknown> | null;
  },
  addons: string[]
) {
  const html = project.generated_files?.["index.html"] || "";
  const wizard = project.wizard_answers || {};

  const flags =
    (await claudeAnalyze(html, wizard)) || heuristicAnalyze(html, wizard);

  const hasCustomDomain =
    !!project.custom_domain ||
    addons.includes("custom_domain") ||
    String(wizard.domain_strategy || "") !== "subdomain";

  const { breakdown, monthly } = calculateBreakdown(flags, addons, hasCustomDomain);
  const tier = pickTier(monthly);
  const yearly_price = yearly(monthly);

  const addons_available = Object.entries(ADDON_PRICES)
    .filter(([k]) => !addons.includes(k))
    .map(([k, v]) => ({ key: k, label: v.label, price: v.price }));

  return {
    tier,
    monthly_price: Number(monthly.toFixed(2)),
    yearly_price: Number(yearly_price.toFixed(2)),
    breakdown,
    addons_active: addons,
    addons_available,
    flags,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("website_projects")
    .select("id, profile_id, name, custom_domain, generated_files, wizard_answers, addons")
    .eq("id", params.id)
    .single();

  if (!project || project.profile_id !== user.id) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 });
  }

  const addons = Array.isArray(project.addons) ? (project.addons as string[]) : [];
  const quote = await buildQuote(project, addons);
  return NextResponse.json({ success: true, quote });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const requestedAddons: string[] = Array.isArray(body?.addons) ? body.addons : [];
  const persist: boolean = !!body?.persist;
  const validAddons = requestedAddons.filter((a) => a in ADDON_PRICES);

  const { data: project } = await supabase
    .from("website_projects")
    .select("id, profile_id, name, custom_domain, generated_files, wizard_answers")
    .eq("id", params.id)
    .single();

  if (!project || project.profile_id !== user.id) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 });
  }

  const quote = await buildQuote(project, validAddons);

  if (persist) {
    await supabase.from("website_projects").update({
      pricing_tier: quote.tier,
      monthly_price: quote.monthly_price,
      yearly_price: quote.yearly_price,
      pricing_breakdown: quote.breakdown,
      addons: validAddons,
      updated_at: new Date().toISOString(),
    }).eq("id", project.id);
  }

  return NextResponse.json({ success: true, quote, persisted: persist });
}
