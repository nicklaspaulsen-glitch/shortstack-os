import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { analyzeCampaign, generateAdCopy } from "@/lib/ads/ai-engine";
import { syncPlatformCampaigns, executePlatformAction, metaAds, getPlatformCredentials } from "@/lib/ads/platforms";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import type { Campaign, Client, AdAction } from "@/lib/types";

// Autopilot settings shape
interface AdsAutopilotConfig {
  enabled: boolean;
  allow_budget_increase: boolean;  // auto increase budget on high-ROAS campaigns
  allow_budget_decrease: boolean;  // auto decrease budget on low-ROAS campaigns
  allow_pause: boolean;            // auto pause campaigns with terrible ROAS
  allow_activate: boolean;         // auto reactivate paused campaigns that improved
  allow_create_ads: boolean;       // auto create new ads with AI copy
  max_budget_change_pct: number;   // max % budget change per action (e.g. 20)
  min_roas_for_increase: number;   // only increase budget if ROAS above this
  max_roas_for_decrease: number;   // only decrease budget if ROAS below this
  pause_roas_threshold: number;    // pause if ROAS below this
  auto_sync: boolean;              // auto sync campaign data before analysis
  notify_on_action: boolean;       // log all actions to trinity_log
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

// GET — fetch autopilot config (authed only — config contains AI thresholds)
export async function GET() {
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("system_health")
    .select("metadata")
    .eq("integration_name", "agent_settings")
    .single();

  const settings = (data?.metadata as Record<string, unknown>) || {};
  const config = { ...DEFAULT_CONFIG, ...(settings.ads_autopilot as Record<string, unknown> || {}) };

  return NextResponse.json({ config });
}

// POST — update config or run autopilot cycle
export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const supabase = createServiceClient();

  // Save config
  if (body.action === "save_config") {
    const { data: existing } = await supabase
      .from("system_health")
      .select("id, metadata")
      .eq("integration_name", "agent_settings")
      .single();

    if (existing) {
      const metadata = (existing.metadata as Record<string, Record<string, unknown>>) || {};
      metadata.ads_autopilot = body.config;
      await supabase.from("system_health").update({ metadata }).eq("id", existing.id);
    }
    return NextResponse.json({ success: true });
  }

  // Run autopilot cycle
  if (body.action === "run") {
    const { data: settingsRow } = await supabase
      .from("system_health")
      .select("metadata")
      .eq("integration_name", "agent_settings")
      .single();

    const settings = (settingsRow?.metadata as Record<string, unknown>) || {};
    const config: AdsAutopilotConfig = { ...DEFAULT_CONFIG, ...(settings.ads_autopilot as Record<string, unknown> || {}) };

    if (!config.enabled) {
      return NextResponse.json({ skipped: true, reason: "Autopilot disabled" });
    }

    const results = {
      synced: 0,
      analyzed: 0,
      actions_taken: 0,
      actions_skipped: 0,
      ads_created: 0,
      details: [] as string[],
    };

    // Resolve caller's owned clients so autopilot only operates on their accounts.
    const ownerId = await getEffectiveOwnerId(authSupabase, user.id);
    if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: ownedClients } = await supabase
      .from("clients")
      .select("id")
      .eq("profile_id", ownerId);
    const ownedClientIds = (ownedClients || []).map(c => c.id as string);
    if (ownedClientIds.length === 0) {
      return NextResponse.json({ ...results, details: ["No clients owned by caller"] });
    }

    // Get caller's clients with ad accounts — never operate cross-tenant.
    const { data: adAccounts } = await supabase
      .from("social_accounts")
      .select("client_id, platform")
      .in("client_id", ownedClientIds)
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
      // Step 1: Sync if enabled
      if (config.auto_sync) {
        for (const platform of platforms) {
          try {
            const syncResult = await syncPlatformCampaigns(clientId, platform);
            results.synced += syncResult.synced;
          } catch { /* continue */ }
        }
      }

      // Step 2: Get campaigns
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("*")
        .eq("client_id", clientId)
        .in("status", ["active", "paused"]);

      if (!campaigns || campaigns.length === 0) continue;

      // Step 3: Get client info
      const { data: client } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (!client) continue;

      // Step 4: Analyze each campaign and take allowed actions
      for (const campaign of campaigns as Campaign[]) {
        results.analyzed++;

        try {
          const analysis = await analyzeCampaign(
            campaign,
            client as Client,
            campaigns as Campaign[]
          );

          for (const action of analysis.actions) {
            const actionType = action.action_type;

            // Check if this action type is allowed
            const isAllowed =
              (actionType === "budget_increase" && config.allow_budget_increase) ||
              (actionType === "budget_decrease" && config.allow_budget_decrease) ||
              (actionType === "pause_campaign" && config.allow_pause) ||
              (actionType === "activate_campaign" && config.allow_activate);

            if (!isAllowed) {
              results.actions_skipped++;
              continue;
            }

            // Validate against thresholds
            if (actionType === "budget_increase" && campaign.roas < config.min_roas_for_increase) {
              results.actions_skipped++;
              continue;
            }
            if (actionType === "budget_decrease" && campaign.roas > config.max_roas_for_decrease) {
              results.actions_skipped++;
              continue;
            }
            if (actionType === "pause_campaign" && campaign.roas > config.pause_roas_threshold) {
              results.actions_skipped++;
              continue;
            }

            // Cap budget changes
            if ((actionType === "budget_increase" || actionType === "budget_decrease") && action.proposed_changes.new_budget) {
              const currentBudget = campaign.budget_daily || 0;
              const proposedBudget = Number(action.proposed_changes.new_budget);
              if (currentBudget > 0) {
                const changePct = Math.abs((proposedBudget - currentBudget) / currentBudget) * 100;
                if (changePct > config.max_budget_change_pct) {
                  // Cap to max allowed change
                  const cappedBudget = actionType === "budget_increase"
                    ? currentBudget * (1 + config.max_budget_change_pct / 100)
                    : currentBudget * (1 - config.max_budget_change_pct / 100);
                  action.proposed_changes.new_budget = Math.round(cappedBudget * 100) / 100;
                }
              }
            }

            // Create and auto-execute the action
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
              } catch {
                results.actions_skipped++;
              }
            }
          }
        } catch {
          // Continue with next campaign
        }
      }

      // Step 5: Auto-create ads if enabled
      if (config.allow_create_ads) {
        const highPerformers = (campaigns as Campaign[]).filter(c => c.status === "active" && c.roas >= config.min_roas_for_increase && c.platform === "meta_ads");

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

      // Log results
      if (config.notify_on_action && results.actions_taken > 0) {
        await supabase.from("trinity_log").insert({
          action_type: "automation",
          description: `Ads Autopilot: ${results.actions_taken} actions, ${results.ads_created} ads created`,
          client_id: clientId,
          status: "completed",
          metadata: results,
        });
      }
    }

    return NextResponse.json({ success: true, ...results });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
