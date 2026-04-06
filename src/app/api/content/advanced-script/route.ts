import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Advanced Script Generator — uses viral research, frameworks, and client data
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    client_id,
    script_type, // short_form, long_form
    platform, // instagram, tiktok, youtube, linkedin
    topic,
    framework, // hook_story_offer, pas, aida, before_after, contrarian, listicle
    viral_reference, // optional: reference viral video to put own twist on
    tone, // professional, casual, bold, educational, storytelling
    target_audience,
    pain_points,
  } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  // Get client context
  let clientContext = "";
  let _clientName = "the business";
  if (client_id) {
    const { data: client } = await supabase.from("clients").select("business_name, industry, services, metadata").eq("id", client_id).single();
    if (client) {
      _clientName = client.business_name;
      const meta = (client.metadata as Record<string, unknown>) || {};
      clientContext = `
CLIENT CONTEXT:
- Business: ${client.business_name}
- Industry: ${client.industry}
- Services: ${(client.services || []).join(", ")}
- Client's pain points: ${meta.biggest_challenge || pain_points || "growing their business"}
- Client's goals: ${meta.goals || "more customers"}
- Ideal customer: ${meta.ideal_customer || target_audience || "local customers"}`;
    }
  }

  const frameworks: Record<string, string> = {
    hook_story_offer: `HOOK-STORY-OFFER Framework:
1. HOOK (0-3 sec): Pattern interrupt, curiosity gap, or bold statement that stops the scroll
2. STORY (3-45 sec): Relatable story, transformation, or demonstration that builds emotional connection
3. OFFER (45-60 sec): Clear value proposition and CTA`,

    pas: `PAS Framework (Problem-Agitate-Solution):
1. PROBLEM: Call out the specific pain point your audience has
2. AGITATE: Twist the knife — make them feel the pain of NOT solving it
3. SOLUTION: Present your service/product as the clear answer + CTA`,

    aida: `AIDA Framework (Attention-Interest-Desire-Action):
1. ATTENTION: Bold hook that demands attention
2. INTEREST: Share surprising facts, stats, or insights
3. DESIRE: Paint the picture of what life looks like after
4. ACTION: Clear, specific call to action`,

    before_after: `BEFORE/AFTER Framework:
1. BEFORE: Show the current painful state (relatable)
2. THE BRIDGE: What changed / the discovery / the method
3. AFTER: Show the transformation / results
4. CTA: How they can get the same results`,

    contrarian: `CONTRARIAN Framework:
1. CONTROVERSIAL TAKE: Challenge a common belief in the industry
2. EVIDENCE: Back it up with logic, data, or experience
3. NEW PERSPECTIVE: Reframe how they should think about it
4. CTA: Invite them to try the new approach`,

    listicle: `LISTICLE Framework:
1. HOOK: "X things/mistakes/secrets that [outcome]"
2. ITEMS: Each point is punchy, specific, and valuable
3. BONUS: Extra tip that provides massive value
4. CTA: "Follow for more" or specific next step`,
  };

  const selectedFramework = frameworks[framework] || frameworks.hook_story_offer;
  const isLongForm = script_type === "long_form";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: `You are a world-class content strategist and scriptwriter. You write scripts that go viral. You understand psychology, storytelling, and what makes people watch until the end. You write for ${platform || "social media"} and know the algorithm inside out.`,
        messages: [{
          role: "user",
          content: `Write an advanced ${isLongForm ? "long-form (8-15 minute)" : "short-form (30-60 second)"} video script for ${platform || "Instagram/TikTok"}.
${clientContext}

TOPIC: ${topic || "helping businesses grow with digital marketing"}
TONE: ${tone || "professional but approachable"}
TARGET AUDIENCE: ${target_audience || "business owners"}

${viral_reference ? `VIRAL REFERENCE TO TWIST: "${viral_reference}" — Put our own unique spin on this concept, don't copy it.` : ""}

USE THIS FRAMEWORK:
${selectedFramework}

Return a JSON object:
{
  "title": "video title (SEO optimized)",
  "hook": {
    "text": "exact words for the first 3 seconds",
    "type": "curiosity_gap / bold_claim / question / controversy / statistic",
    "why_it_works": "psychology behind this hook"
  },
  "script": {
    "sections": [
      {
        "name": "section name (e.g., HOOK, PROBLEM, STORY, etc)",
        "duration": "0:00-0:05",
        "dialogue": "exact words to say",
        "visual_direction": "what to show on screen",
        "text_overlay": "text to put on screen if any",
        "emotion": "the emotion to convey"
      }
    ]
  },
  "pain_points_addressed": ["list of specific pain points this video hits"],
  "value_delivered": "what the viewer gains from watching",
  "cta": {
    "text": "exact CTA words",
    "type": "follow / comment / DM / link / book_call",
    "placement": "where in the video"
  },
  "caption": "full social media caption with emojis and hashtags",
  "hashtags": ["30 relevant hashtags"],
  "posting_strategy": {
    "best_time": "optimal posting time",
    "best_day": "optimal day",
    "boost_tip": "one tip to maximize reach"
  },
  "thumbnail": {
    "text": "thumbnail text overlay",
    "emotion": "expression to make",
    "colors": "dominant colors"
  },
  "ab_variations": [
    {
      "hook_alt": "alternative hook to test",
      "why": "reason to test this variation"
    },
    {
      "hook_alt": "second alternative hook",
      "why": "reason"
    }
  ]
}`,
        }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const script = JSON.parse(cleaned);

    // Save to content_scripts
    await supabase.from("content_scripts").insert({
      client_id: client_id || null,
      title: script.title,
      script_type,
      brand_voice: tone,
      script_body: JSON.stringify(script.script),
      hook: script.hook?.text || "",
      outline: script.script,
      seo_title: script.title,
      description: script.caption,
      hashtags: script.hashtags,
      keywords: script.pain_points_addressed,
      thumbnail_idea: script.thumbnail ? `${script.thumbnail.text} | ${script.thumbnail.emotion}` : null,
      target_platform: platform,
      status: "scripted",
      metadata: {
        framework,
        cta: script.cta,
        posting_strategy: script.posting_strategy,
        ab_variations: script.ab_variations,
        value_delivered: script.value_delivered,
        viral_reference: viral_reference || null,
        advanced: true,
      },
    });

    return NextResponse.json({ success: true, script });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
