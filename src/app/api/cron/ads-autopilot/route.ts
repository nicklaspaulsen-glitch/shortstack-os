import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { analyzeCampaign, generateAdCopy } from "@/lib/ads/ai-engine";
import { syncPlatformCampaigns, executePlatformAction, metaAds, getPlatformCredentials } from "@/lib/ads/platforms";
import type { Campaign, Client, AdAction } from "@/lib/types";

interface AdsAutopilotConfig {
  enabled: boolean;
  allow_budget_increase: boolean;
  allow_budget_decrease: boolean;
  allow_pause: boolean;
  allow_activate: boolean;
  allow_create_ads: boolean;
  max_budget_change_pct: number;
  min_roas_for_increase: number;
  max_roas_for_decrease: number;
  pause_roas_threshold: number;
  auto_sync: boolean;
  notify_on_action: boolean;
}

const DEFAULT_CONFIG: AdsAutopilotConfig = {
  enabled: false,
  allow_budget_increase: true,
  allow_budget_decrease: true,
  allow_pause: false,
  allow_activate: false,
  allow_create_ads: false,
  max_budget_change_pct: 20,
  min_roas_for_increase: 2.0,
  max_roas_for_decrease: 0.8,
  pause_roas_threshold: 0.3,
  auto_sync: true,
  notify_on_action: true,
};

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min max for cron

export async function GET(request: NextRequest) {
  // Verify cron secret — REQUIRED. If CRON_SECRET is not set, deny rather than allow.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfigured: CRON_SECRET not set" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Load config
  const { data: settingsRow } = await supabase
    .from("system_health")
    .select("metadata")
    .eq("integration_name", "agent_settings")
    .single();

  const settings = (settingsRow?.metadata as Record<string, unknown>) || {};
  const config: AdsAutopilotConfig = { ...DEFAULT_CONFIG, ...(settings.ads_autopilot as Record<string, unknown> || {}) };

  if (!config.enabled) {
    return NextResponse.json({ skipped: true, reason: "Ads autopilot disabled" });
  }

  const results = {
    synced: 0,
    analyzed: 0,
    actions_taken: 0,
    actions_skipped: 0,
    ads_created: 0,
    details: [] as string[],
  };

  // Get all clients with ad accounts
  const { data: adAccounts } = await supabase
    .from("social_accounts")
    .select("client_id, platform")
    .in("platform", ["meta_ads", "google_ads", "tiktok_ads"])
    .eq("is_active", true);

  if (!adAccounts || adAccounts.length === 0) {
    return NextResponse.json({ ...results, details: ["No connected ad accounts"] });
  }

  const clientPlatforms: Record<string, string[]> = {};
  for (const acc of adAccounts) {
    if (!clientPlatforms[acc.client_id]) clientPlatforms[acc.client_id] = [];
    clientPlatforms[acc.client_id].push(acc.platform);
  }

  for (const clientId of Object.keys(clientPlatforms)) {
    const platforms = clientPlatforms[clientId];

    // Sync campaigns
    if (config.auto_sync) {
      for (const platform of platforms) {
        try {
          const syncResult = await syncPlatformCampaigns(clientId, platform);
          results.synced += syncResult.synced;
        } catch { /* continue */ }
      }
    }

    // Get campaigns
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("*")
      .eq("client_id", clientId)
      .in("status", ["active", "paused"]);

    if (!campaigns || campaigns.length === 0) continue;

    // Get client
    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (!client) continue;

    // Analyze each campaign
    for (const campaign of campaigns as Campaign[]) {
      results.analyzed++;

      try {
        const analysis = await analyzeCampaign(campaign, client as Client, campaigns as Campaign[]);

        for (const action of analysis.actions) {
          const actionType = action.action_type;

          const isAllowed =
            (actionType === "budget_increase" && config.allow_budget_increase) ||
            (actionType === "budget_decrease" && config.allow_budget_decrease) ||
            (actionType === "pause_campaign" && config.allow_pause) ||
            (actionType === "activate_campaign" && config.allow_activate);

          if (!isAllowed) { results.actions_skipped++; continue; }

          if (actionType === "budget_increase" && campaign.roas < config.min_roas_for_increase) { results.actions_skipped++; continue; }
          if (actionType === "budget_decrease" && campaign.roas > config.max_roas_for_decrease) { results.actions_skipped++; continue; }
          if (actionType === "pause_campaign" && campaign.roas > config.pause_roas_threshold) { results.actions_skipped++; continue; }

          // Cap budget changes
          if ((actionType === "budget_increase" || actionType === "budget_decrease") && action.proposed_changes.new_budget) {
            const currentBudget = campaign.budget_daily || 0;
            const proposedBudget = Number(action.proposed_changes.new_budget);
            if (currentBudget > 0) {
              const changePct = Math.abs((proposedBudget - currentBudget) / currentBudget) * 100;
              if (changePct > config.max_budget_change_pct) {
                action.proposed_changes.new_budget = Math.round(
                  (actionType === "budget_increase"
                    ? currentBudget * (1 + config.max_budget_change_pct / 100)
                    : currentBudget * (1 - config.max_budget_change_pct / 100)) * 100
                ) / 100;
              }
            }
          }

          // Execute action
          const { data: insertedAction } = await supabase
            .from("ad_actions")
            .insert({
              campaign_id: campaign.id,
              client_id: clientId,
              platform: campaign.platform,
              action_type: actionType,
              title: action.title,
              description: action.description,
              ai_reasoning: action.ai_reasoning,
              proposed_changes: { ...action.proposed_changes, external_campaign_id: campaign.external_campaign_id },
              current_values: action.current_values || {},
              estimated_impact: action.estimated_impact,
              priority: action.priority || "medium",
              status: "approved",
              approved_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (insertedAction) {
            try {
              const execResult = await executePlatformAction(insertedAction as AdAction);
              if (execResult.success) {
                results.actions_taken++;
                results.details.push(`${actionType}: ${campaign.name} (${campaign.platform})`);
              }
            } catch { results.actions_skipped++; }
          }
        }
      } catch { /* continue */ }
    }

    // Auto-create ads
    if (config.allow_create_ads) {
      const highPerformers = (campaigns as Campaign[]).filter(c =>
        c.status === "active" && c.roas >= config.min_roas_for_increase && c.platform === "meta_ads"
      );

      for (const campaign of highPerformers.slice(0, 2)) {
        try {
          const copy = await generateAdCopy({
            platform: campaign.platform,
            clientName: client.business_name,
            industry: client.industry || "business",
            objective: "Lead generation",
            targetAudience: (client.metadata as Record<string, unknown>)?.target_audience as string || "local customers",
            offer: (client.services as string[] || []).join(", ") || "professional services",
            tone: "professional, benefit-focused, urgent",
          });

          if (copy.variations.length > 0 && campaign.external_campaign_id) {
            const bestVariation = copy.variations[0];
            const creds = await getPlatformCredentials(clientId, "meta_ads");

            await metaAds.createAd(creds.access_token, creds.account_id, {
              name: `AI Auto: ${bestVariation.headline}`,
              campaign_id: campaign.external_campaign_id,
              creative: {
                title: bestVariation.headline,
                body: bestVariation.primary_text,
                link_url: (client.metadata as Record<string, unknown>)?.website as string || "",
                cta_type: bestVariation.cta === "Shop Now" ? "SHOP_NOW" : "LEARN_MORE",
              },
            });

            results.ads_created++;
            results.details.push(`Created ad: "${bestVariation.headline}" in ${campaign.name}`);
          }
        } catch { /* continue */ }
      }
    }

    // Log
    if (config.notify_on_action && (results.actions_taken > 0 || results.ads_created > 0)) {
      await supabase.from("trinity_log").insert({
        action_type: "automation",
        description: `[CRON] Ads Autopilot: ${results.actions_taken} actions, ${results.ads_created} ads created`,
        client_id: clientId,
        status: "completed",
        metadata: results,
      });
    }
  }

  return NextResponse.json({ success: true, ...results });
}
