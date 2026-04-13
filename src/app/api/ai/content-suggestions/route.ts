import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// POST /api/ai/content-suggestions
// Triggered when a client connects a social account.
// Analyzes their business profile + connected platforms and generates
// content ideas (scripts, carousels, video concepts, post ideas).
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, platform } = await request.json();
  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  const service = createServiceClient();

  // Fetch client info
  const { data: client } = await service
    .from("clients")
    .select("id, business_name, industry, services, website, notes")
    .eq("id", client_id)
    .single();

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Fetch all connected social accounts for this client
  const { data: accounts } = await service
    .from("social_accounts")
    .select("platform, account_name, is_active")
    .eq("client_id", client_id)
    .eq("is_active", true);

  const connectedPlatforms = (accounts || []).map(a => a.platform).join(", ") || platform || "unknown";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: `You are a social media strategist for a digital marketing agency. Generate actionable content suggestions for clients based on their business profile and connected platforms. Return JSON only.`,
        messages: [{
          role: "user",
          content: `Generate 8 content suggestions for this client:

Business: ${client.business_name || "Unknown"}
Industry: ${client.industry || "General"}
Services: ${client.services || "Not specified"}
Website: ${client.website || "None"}
Notes: ${client.notes || "None"}
Connected platforms: ${connectedPlatforms}
Newly connected: ${platform || "general"}

Return a JSON array of suggestions. Each suggestion should have:
- "type": one of "short_video", "carousel", "script", "story", "post", "reel", "thread"
- "platform": best platform for this content (from their connected ones)
- "title": catchy title (under 60 chars)
- "description": 1-2 sentence description of what to create
- "hook": a strong opening hook/first line for the content
- "tags": array of 2-3 relevant hashtags

Focus on content that would actually perform well for their industry. Mix viral-style content with educational and behind-the-scenes. Prioritize the newly connected platform.

Return ONLY the JSON array, no markdown.`,
        }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "[]";

    let suggestions;
    try {
      suggestions = JSON.parse(text.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    } catch {
      suggestions = [];
    }

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return NextResponse.json({ success: false, error: "No suggestions generated" }, { status: 500 });
    }

    // Store each suggestion in trinity_log for the client
    const rows = suggestions.map((s: { type: string; platform: string; title: string; description: string; hook: string; tags: string[] }) => ({
      user_id: user.id,
      client_id,
      agent: "content-advisor",
      action_type: "content_suggestion",
      description: `${s.type}: ${s.title}`,
      status: "pending",
      metadata: {
        type: s.type,
        platform: s.platform,
        title: s.title,
        description: s.description,
        hook: s.hook,
        tags: s.tags,
        trigger_platform: platform,
        source: "social_connect",
      },
    }));

    await service.from("trinity_log").insert(rows);

    return NextResponse.json({
      success: true,
      suggestions_count: suggestions.length,
      suggestions,
    });
  } catch (err) {
    console.error("[ai/content-suggestions] error:", err);
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }
}

// GET /api/ai/content-suggestions?client_id=xxx
// Fetch pending content suggestions for a client
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  const service = createServiceClient();
  const { data: suggestions } = await service
    .from("trinity_log")
    .select("id, description, status, metadata, created_at")
    .eq("client_id", clientId)
    .eq("action_type", "content_suggestion")
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ suggestions: suggestions || [] });
}
