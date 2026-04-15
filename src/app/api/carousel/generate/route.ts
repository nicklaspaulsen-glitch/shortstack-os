import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

interface SlideContent {
  slideNumber: number;
  headline: string;
  body: string;
}

interface CarouselRequest {
  topic: string;
  slideCount: number;
  style: string;
  template?: string;
  brandColors?: { primary: string; secondary: string };
}

export async function POST(request: NextRequest) {
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

  const body: CarouselRequest = await request.json();
  const { topic, slideCount, style, template, brandColors } = body;

  if (!topic || !slideCount || !style) {
    return NextResponse.json({ error: "Missing required fields: topic, slideCount, style" }, { status: 400 });
  }
  if (slideCount < 3 || slideCount > 10) {
    return NextResponse.json({ error: "slideCount must be between 3 and 10" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  }

  const templateContext = template
    ? `\nCarousel format: ${template}. Structure slides to match this format perfectly.`
    : "";

  const colorContext = brandColors
    ? `\nBrand colors: primary ${brandColors.primary}, secondary ${brandColors.secondary}. Reference these colors in visual direction notes.`
    : "";

  const styleDescriptions: Record<string, string> = {
    minimalist: "Clean, lots of whitespace, short punchy text, elegant simplicity",
    bold: "Big impactful statements, strong calls to action, commanding presence",
    corporate: "Professional, data-driven, polished language, trustworthy tone",
    playful: "Fun, casual, emoji-friendly, conversational and approachable",
    dark: "Moody, dramatic, powerful statements, premium feel",
    gradient: "Modern, vibrant, trend-forward, dynamic energy",
  };

  const styleGuide = styleDescriptions[style] || "Professional and engaging";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: `You are a social media content strategist who creates viral carousel content for Instagram and LinkedIn. You write concise, high-impact slide content optimized for engagement and saves. Every carousel should hook on slide 1, deliver value in the middle, and end with a strong CTA.`,
        messages: [{
          role: "user",
          content: `Create a ${slideCount}-slide carousel about: "${topic}"

Style: ${styleGuide}${templateContext}${colorContext}

Rules:
- Slide 1 is always a compelling hook/title slide (max 8 words headline, 15 words body)
- Middle slides deliver the core value (max 6 words headline, 25 words body each)
- Final slide is always a CTA (follow, save, share, comment)
- Headlines must be punchy, scannable, and use power words
- Body text supports the headline without repeating it
- Each slide should make the viewer want to swipe to the next

Return ONLY a JSON array with exactly ${slideCount} objects, each with: slideNumber (number), headline (string), body (string). No markdown, no explanation, just the JSON array.`,
        }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Anthropic API error:", res.status, errBody);
      return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
    }

    const data = await res.json();
    const rawText: string = data.content?.[0]?.text || "[]";

    // Extract JSON from response — handle potential markdown wrapping
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });
    }

    const slides: SlideContent[] = JSON.parse(jsonMatch[0]);

    // Validate slide structure
    const validSlides = slides.map((s, i) => ({
      slideNumber: i + 1,
      headline: String(s.headline || `Slide ${i + 1}`),
      body: String(s.body || ""),
    }));

    return NextResponse.json({ slides: validSlides });
  } catch (err) {
    console.error("Carousel generation error:", err);
    return NextResponse.json({ error: "Failed to generate carousel content" }, { status: 500 });
  }
}
