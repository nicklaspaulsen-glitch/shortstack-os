import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Lovable.dev Website Builder — creates full websites via Lovable API
// Better than raw HTML generation — produces real React apps
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt, client_id, business_name, industry } = await request.json();

  const lovableKey = process.env.LOVABLE_API_KEY;

  // If Lovable API key is set, use their API
  if (lovableKey) {
    try {
      const res = await fetch("https://api.lovable.dev/v1/projects", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt || `Build a professional website for ${business_name || "a business"} in the ${industry || "service"} industry. Include: hero section with CTA, services, about us, testimonials, contact form. Modern dark design with gold accents.`,
        }),
      });
      const data = await res.json();

      if (data.project_url || data.id) {
        // Log
        await supabase.from("trinity_log").insert({
          action_type: "website",
          description: `Lovable website created for ${business_name || "client"}`,
          client_id: client_id || null,
          status: "completed",
          result: { url: data.project_url, id: data.id, source: "lovable" },
        });

        return NextResponse.json({
          success: true,
          source: "lovable",
          project_url: data.project_url,
          editor_url: data.editor_url || `https://lovable.dev/projects/${data.id}`,
          project_id: data.id,
        });
      }

      return NextResponse.json({ error: data.message || "Lovable creation failed" }, { status: 500 });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // Fallback: generate the prompt for user to paste into Lovable manually
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 500,
          messages: [{
            role: "user",
            content: `Write a Lovable.dev prompt to build a website for ${business_name || "a business"} (${industry || "service"} industry). Be specific about design, sections, colors, and functionality. Max 200 words.`,
          }],
        }),
      });
      const data = await res.json();
      const lovablePrompt = data.content?.[0]?.text || "";

      return NextResponse.json({
        success: true,
        source: "prompt",
        lovable_prompt: lovablePrompt,
        lovable_url: "https://lovable.dev/projects/create",
        message: "Copy this prompt and paste it into Lovable to create the website. Add LOVABLE_API_KEY to automate this.",
      });
    } catch {}
  }

  return NextResponse.json({ error: "No AI service configured" }, { status: 500 });
}
