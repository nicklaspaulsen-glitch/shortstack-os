import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { analyzeCampaign, generateBulkInsights } from "@/lib/ads/ai-engine";
import type { Campaign, Client } from "@/lib/types";

// POST — AI-optimize a single campaign
export async function POST(request: NextRequest) {
  // Auth check
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = createServiceClient();
    const { campaign_id } = await request.json();

    if (!campaign_id) {
      return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });
    }

    // Fetch the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Fetch the client
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", campaign.client_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Fetch all campaigns for this client (for comparison)
    const { data: allCampaigns } = await supabase
      .from("campaigns")
      .select("*")
      .eq("client_id", campaign.client_id);

    // Run AI analysis
    const suggestions = await analyzeCampaign(
      campaign as Campaign,
      client as Client,
      (allCampaigns || []) as Campaign[]
    );

    // Save suggestions to campaign
    await supabase
      .from("campaigns")
      .update({ ai_suggestions: suggestions })
      .eq("id", campaign_id);

    // Create ad_actions rows for each proposed action
    const actions = Array.isArray(suggestions.actions) ? suggestions.actions : [];
    const actionRows = actions.map((action: Record<string, unknown>) => ({
      campaign_id,
      client_id: campaign.client_id,
      action_type: action.type,
      description: action.description,
      parameters: action.parameters || {},
      status: "proposed" as const,
      created_at: new Date().toISOString(),
    }));

    let actionsCreated = 0;
    if (actionRows.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("ad_actions")
        .insert(actionRows)
        .select();

      if (!insertError && inserted) {
        actionsCreated = inserted.length;
      }
    }

    return NextResponse.json({
      success: true,
      suggestions,
      actions_created: actionsCreated,
    });
  } catch (error) {
    console.error("[ads/optimize] POST error:", error);
    return NextResponse.json(
      { error: "Failed to optimize campaign" },
      { status: 500 }
    );
  }
}

// GET — Bulk insights across all active campaigns
export async function GET() {
  try {
    const supabase = createServiceClient();

    // Fetch all active campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("status", "active");

    if (campaignsError) {
      return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
    }

    // Fetch all clients for those campaigns
    const clientIds = Array.from(new Set((campaigns || []).map((c: Campaign) => c.client_id)));
    const { data: clients } = await supabase
      .from("clients")
      .select("*")
      .in("id", clientIds);

    // Generate bulk insights
    const insights = await generateBulkInsights(
      (campaigns || []) as Campaign[],
      (clients || []) as Client[]
    );

    return NextResponse.json({ success: true, insights });
  } catch (error) {
    console.error("[ads/optimize] GET error:", error);
    return NextResponse.json(
      { error: "Failed to generate bulk insights" },
      { status: 500 }
    );
  }
}
