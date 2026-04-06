import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Canva Design Generator — creates designs via Canva API
// Falls back to Midjourney prompt generation if Canva isn't available
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { description, type, style, dimensions } = await request.json();
  if (!description) return NextResponse.json({ error: "Description required" }, { status: 400 });

  // Try Canva API first
  const canvaToken = process.env.CANVA_API_KEY;
  if (canvaToken) {
    try {
      // Create design via Canva API
      const createRes = await fetch("https://api.canva.com/rest/v1/designs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${canvaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          design_type: type === "social_post" ? "Instagram Post" : type === "thumbnail" ? "YouTube Thumbnail" : type === "ad" ? "Facebook Ad" : "Custom",
          title: description.substring(0, 100),
        }),
      });

      if (createRes.ok) {
        const design = await createRes.json();
        return NextResponse.json({
          success: true,
          source: "canva",
          design_id: design.design?.id,
          edit_url: design.design?.urls?.edit_url,
          view_url: design.design?.urls?.view_url,
        });
      }
    } catch {}
  }

  // Fallback: Generate Midjourney prompts
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No design service configured" }, { status: 500 });

  const dimMap: Record<string, string> = {
    "1080x1080": "--ar 1:1",
    "1920x1080": "--ar 16:9",
    "1080x1920": "--ar 9:16",
    "1280x720": "--ar 16:9",
    "1080x1350": "--ar 4:5",
  };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `Generate 3 Midjourney prompts for: "${description}"\nType: ${type || "marketing image"}\nStyle: ${style || "professional"}\n\nReturn JSON: {"prompts":[{"prompt":"/imagine prompt: [detailed] ${dimMap[dimensions || "1080x1080"] || "--ar 1:1"} --v 6 --style raw","description":"what this generates"}]}`,
        }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(cleaned);

    return NextResponse.json({ success: true, source: "midjourney", ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
