import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { anthropic, MODEL_SONNET, getResponseText, safeJsonParse } from "@/lib/ai/claude-helpers";

/**
 * Claude-powered website generator.
 *
 * Accepts wizard answers + project_id, runs Claude Sonnet with a conversion-
 * optimized system prompt, and saves the generated files/content/meta to the
 * website_projects row.
 *
 * Body:
 *   {
 *     project_id?: string,     // if set, update this project; otherwise a new one is created
 *     client_id?: string,
 *     answers: Record<string, unknown>,
 *   }
 *
 * Response: { success: true, project_id, files, content, meta }
 */

const SYSTEM_PROMPT = `You are a world-class web designer and conversion copywriter.

Generate a high-converting ONE-PAGE website as a self-contained set of files (HTML, CSS, JS). The HTML must reference the CSS/JS files using \`<link rel="stylesheet" href="styles.css">\` and \`<script src="script.js"></script>\`. All three files are served from the same static origin.

## Conversion best practices (MANDATORY)
1. **Hero section** with a bold, benefit-led headline, subheadline clarifying the offer, and a primary CTA button above the fold.
2. **Social proof** near the hero (logos row, rating stars, customer counts, testimonial snippets).
3. **Benefits-focused copy** — talk about outcomes for the visitor, not features.
4. **Urgency / scarcity** cues where relevant ("Only 3 spots left this week", "Free for the first 100 signups").
5. **Visual hierarchy** — each section has a clear H2, supporting copy, and a CTA or visual anchor.
6. **3D / animated elements** — use CSS transforms, gradient animations, subtle parallax on scroll, \`@keyframes\` float/pulse/gradient-shift on hero background, and tasteful hover lifts.
7. **CTAs repeated 3+ times** — hero, mid-page, footer. Use the CTA goal from the wizard.
8. **Trust signals** — guarantee badges, certifications, years in business, award logos.
9. **Mobile-first Tailwind** — use CDN: \`<script src="https://cdn.tailwindcss.com"></script>\`. Make every breakpoint (sm/md/lg) look great.
10. **Framer-Motion-like animations via CSS** — use \`animate-[fadeInUp_0.8s_ease-out]\`, keyframes in styles.css, \`IntersectionObserver\` in script.js to trigger \`.in-view\` classes.

## Style system
- Respect the wizard's \`style_vibe\` (bold, minimal, luxury, playful, dark-cinematic, pastel, corporate, editorial).
- Use the \`brand_primary\` and \`brand_accent\` colors in CSS variables.
- Use the \`hero_style\` (big-headline-image, video-bg, 3d-spline, split-screen, fullscreen-photo, interactive-gradient) to pick the hero layout.

## Sections
Render only the sections the wizard requested (About, Features, Services, Pricing, Testimonials, FAQ, Blog preview, Gallery, Team, Contact). Hero, Footer, and CTA block are always included.

## Output format (STRICT JSON, nothing else — no markdown fences, no prose)
{
  "files": {
    "index.html": "<!DOCTYPE html>...",
    "styles.css": "...",
    "script.js": "..."
  },
  "content": {
    "hero_title": "string",
    "hero_subtitle": "string",
    "cta_text": "string",
    "sections": ["hero","about","features","testimonials","faq","footer"]
  },
  "meta": {
    "title": "SEO page title (<= 60 chars)",
    "description": "Meta description (150-160 chars, CTA included)",
    "og_image": null
  }
}

The files must be COMPLETE — no placeholders, no "TODO", no "..." truncation. Write the full index.html, full styles.css, full script.js.`;

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { project_id, client_id, answers = {} } = body as {
    project_id?: string;
    client_id?: string | null;
    answers?: Record<string, unknown>;
  };

  const a = answers as Record<string, unknown>;
  const businessName = String(a.business_name || "Business");
  const industry = String(a.industry || a.business_type || "business");
  const styleVibe = String(a.style_vibe || "minimal-clean");
  const heroStyle = String(a.hero_style || "big-headline-image");
  const ctaGoal = String(a.cta_goal || "Book call");
  const sections = Array.isArray(a.sections) ? (a.sections as string[]) : ["about", "features", "testimonials", "faq"];
  const targetAudience = String(a.target_audience || "prospects");
  const valueProp = String(a.value_prop || "");
  const brandPrimary = String(a.brand_primary || "#C9A84C");
  const brandAccent = String(a.brand_accent || "#0f172a");
  const visuals = String(a.visuals || "AI-generated images");

  // Ensure project exists (or create a draft)
  let pid = project_id;
  if (!pid) {
    const { data: created } = await supabase
      .from("website_projects")
      .insert({
        profile_id: user.id,
        client_id: client_id || null,
        name: businessName,
        industry,
        template_style: styleVibe,
        status: "generating",
        wizard_answers: answers,
        business_info: {
          business_name: businessName,
          industry,
          target_audience: targetAudience,
          value_prop: valueProp,
        },
      })
      .select("id")
      .single();
    pid = created?.id;
  } else {
    // Verify ownership and mark as generating
    const { data: existing } = await supabase
      .from("website_projects")
      .select("id, profile_id")
      .eq("id", pid)
      .single();
    if (!existing || existing.profile_id !== user.id) {
      return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 });
    }
    await supabase.from("website_projects").update({
      status: "generating",
      wizard_answers: answers,
      name: businessName,
      industry,
      template_style: styleVibe,
      updated_at: new Date().toISOString(),
    }).eq("id", pid);
  }

  const userPrompt = `Build a high-converting one-page website with the following brief:

Business: ${businessName}
Industry / niche: ${industry}
Target audience: ${targetAudience}
Value proposition: ${valueProp || "(derive from industry)"}

Style vibe: ${styleVibe}
Hero style: ${heroStyle}
CTA goal: ${ctaGoal}
Sections to include: ${sections.join(", ")}
Brand primary color: ${brandPrimary}
Brand accent color: ${brandAccent}
Visuals approach: ${visuals}

Generate index.html, styles.css, script.js. Include hero animations, benefit-driven copy, social proof, trust badges, 3+ CTAs, and mobile-responsive Tailwind. Return STRICT JSON only — no markdown fences.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 16000,
      system: [{
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      }],
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<{
      files: Record<string, string>;
      content: Record<string, unknown>;
      meta: Record<string, unknown>;
    }>(text);

    if (!parsed || !parsed.files || !parsed.files["index.html"]) {
      await supabase.from("website_projects").update({
        status: "failed",
        error_log: "Claude returned invalid JSON or missing index.html",
        updated_at: new Date().toISOString(),
      }).eq("id", pid);
      return NextResponse.json({
        error: "Claude returned invalid output",
        raw: text.slice(0, 500),
      }, { status: 500 });
    }

    await supabase.from("website_projects").update({
      status: "preview",
      generated_files: parsed.files,
      generated_content: parsed.content || {},
      updated_at: new Date().toISOString(),
    }).eq("id", pid);

    return NextResponse.json({
      success: true,
      project_id: pid,
      files: parsed.files,
      content: parsed.content,
      meta: parsed.meta,
    });
  } catch (err) {
    await supabase.from("website_projects").update({
      status: "failed",
      error_log: String(err),
      updated_at: new Date().toISOString(),
    }).eq("id", pid);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
