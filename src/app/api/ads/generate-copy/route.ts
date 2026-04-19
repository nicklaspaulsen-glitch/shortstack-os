import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { generateAdCopy } from "@/lib/ads/ai-engine";
import { requireOwnedClient } from "@/lib/security/require-owned-client";

// POST — Generate 5 AI ad copy variations via Anthropic API
export async function POST(request: NextRequest) {
  // Auth check
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit
  const { data: profile } = await authSupabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  try {
    const supabase = createServiceClient();
    const { client_id, platform, objective, target_audience, offer, tone } =
      await request.json();

    if (!platform || !objective || !target_audience || !offer || !tone) {
      return NextResponse.json(
        { error: "platform, objective, target_audience, offer, and tone are required" },
        { status: 400 }
      );
    }

    let clientName = "the business";
    let industry = "business";

    if (client_id) {
      // Verify caller owns the client before reading it.
      const ctx = await requireOwnedClient(authSupabase, user.id, client_id);
      if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const { data: client } = await supabase
        .from("clients")
        .select("business_name, industry")
        .eq("id", client_id)
        .single();

      if (client) {
        clientName = client.business_name;
        industry = client.industry || "business";
      }
    }

    const result = await generateAdCopy({
      platform,
      clientName,
      industry,
      objective,
      targetAudience: target_audience,
      offer,
      tone,
    });

    return NextResponse.json({ success: true, adCopy: result });
  } catch (error) {
    console.error("[ads/generate-copy] POST error:", error);
    return NextResponse.json(
      { error: "Failed to generate ad copy" },
      { status: 500 }
    );
  }
}
