/**
 * Cron — Agent Task Executor
 *
 * Every 2 minutes, picks up pending tasks from `agent_task_queue` and
 * dispatches them to the appropriate handler. This is the bridge between
 * the autonomous-loop (which enqueues tasks) and the leadgen API routes
 * (which do the actual work).
 *
 * Task types dispatched:
 *   find_leads       → scrape Google Places + enrich for the owner
 *   send_outreach    → POST /api/leadgen/voice-outreach
 *   follow_up        → AI follow-up DM via Zernio
 *   generate_content → POST /api/leadgen/generate-content
 *   publish          → POST /api/leadgen/deliver
 *   setup_ads        → initialize ads autopilot for new client
 *   auto_edit_video  → trigger auto-edit pipeline for client footage
 *   reengage         → post-delivery check-in to offer more work
 *
 * Concurrency: processes up to 5 tasks per tick, in parallel.
 * Each task is claimed (status=running) before dispatch so concurrent
 * ticks don't collide.
 *
 * Auth: x-vercel-cron header OR Authorization: Bearer ${CRON_SECRET}.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callLLMTraced } from "@/lib/ai/llm-router";
import { sendDM as zernioDM } from "@/lib/services/zernio";
import { internalPost } from "@/lib/internal-fetch";
import {
  listCampaigns,
  getAdConnections,
  boostPost,
  getAdAnalytics,
} from "@/lib/services/zernio-ads";
import { getClientZernioProfile, setupClientInZernio } from "@/lib/services/zernio";
import { secureCompare } from "@/lib/security/ssrf-guard";
import { checkFetchUrl } from "@/lib/security/ssrf";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_TASKS_PER_TICK = 5;

// ── Types ────────────────────────────────────────────────────────────────────

interface QueuedTask {
  id: string;
  owner_id: string;
  task_type: string;
  agent_key: string;
  priority: number;
  payload: Record<string, unknown>;
  pipeline_id: string | null;
  scheduled_for: string | null;
}

interface TaskResult {
  ok: boolean;
  detail?: Record<string, unknown>;
  error?: string;
}

type TaskHandler = (
  supabase: SupabaseClient,
  task: QueuedTask,
) => Promise<TaskResult>;

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";

// ── Task handlers ────────────────────────────────────────────────────────────

/**
 * find_leads: Scrape Google Places for the owner's configured niche/location,
 * then extract social media handles from each business's website.
 *
 * Only inserts leads that have a DM-able social media presence (Instagram,
 * Facebook, TikTok, Twitter/X, LinkedIn). Businesses without discoverable
 * social profiles are skipped — they can't be outreached via Zernio DMs.
 *
 * Enrichment pipeline per place:
 *   1. Fetch the business website HTML
 *   2. Regex-extract social media profile URLs
 *   3. Pick the best platform (prefer Instagram > Facebook > TikTok > Twitter > LinkedIn)
 *   4. Extract the handle from the URL
 *   5. Also scrape email as fallback contact
 *   6. Insert with the real social platform + handle
 */

// Social media URL patterns — ordered by DM-friendliness
const SOCIAL_PATTERNS: Array<{
  platform: string;
  regex: RegExp;
  handleExtractor: (url: string) => string | null;
}> = [
  {
    platform: "instagram",
    regex: /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]{1,30})\/?/gi,
    handleExtractor: (url: string) => {
      const m = url.match(/instagram\.com\/([a-zA-Z0-9._]{1,30})/i);
      return m?.[1] && !["p", "reel", "explore", "accounts", "stories", "about", "developer"].includes(m[1].toLowerCase())
        ? m[1] : null;
    },
  },
  {
    platform: "facebook",
    regex: /https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9.]{1,50})\/?/gi,
    handleExtractor: (url: string) => {
      const m = url.match(/facebook\.com\/([a-zA-Z0-9.]{1,50})/i);
      return m?.[1] && !["sharer", "share", "dialog", "plugins", "login", "help", "groups", "events", "watch", "marketplace", "gaming"].includes(m[1].toLowerCase())
        ? m[1] : null;
    },
  },
  {
    platform: "tiktok",
    regex: /https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9._]{1,24})\/?/gi,
    handleExtractor: (url: string) => {
      const m = url.match(/tiktok\.com\/@([a-zA-Z0-9._]{1,24})/i);
      return m?.[1] ?? null;
    },
  },
  {
    platform: "twitter",
    regex: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]{1,15})\/?/gi,
    handleExtractor: (url: string) => {
      const m = url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]{1,15})/i);
      return m?.[1] && !["intent", "share", "search", "hashtag", "home", "explore", "i"].includes(m[1].toLowerCase())
        ? m[1] : null;
    },
  },
  {
    platform: "linkedin",
    regex: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/([a-zA-Z0-9_-]{1,100})\/?/gi,
    handleExtractor: (url: string) => {
      const m = url.match(/linkedin\.com\/(?:company|in)\/([a-zA-Z0-9_-]{1,100})/i);
      return m?.[1] ?? null;
    },
  },
];

type SocialProfile = {
  platform: string;
  handle: string;
  profileUrl: string;
};

function extractSocialProfiles(html: string): SocialProfile[] {
  const found: SocialProfile[] = [];
  const seenPlatforms = new Set<string>();

  for (const pattern of SOCIAL_PATTERNS) {
    if (seenPlatforms.has(pattern.platform)) continue;

    // Use exec loop instead of matchAll (avoids downlevelIteration requirement)
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(html)) !== null) {
      const handle = pattern.handleExtractor(match[0]);
      if (handle && !seenPlatforms.has(pattern.platform)) {
        found.push({
          platform: pattern.platform,
          handle,
          profileUrl: match[0].replace(/\/$/, ""),
        });
        seenPlatforms.add(pattern.platform);
        break; // one handle per platform is enough
      }
    }
  }

  return found;
}

const handleFindLeads: TaskHandler = async (supabase, task) => {
  const count = (task.payload.count as number) || 10;

  // Load owner's scrape config (niche + location preferences)
  const { data: config } = await supabase
    .from("autonomous_loop_settings")
    .select("metadata")
    .eq("owner_id", task.owner_id)
    .maybeSingle();

  const metadata = (config?.metadata ?? {}) as Record<string, unknown>;
  const niche = (metadata.target_niche as string) || "local business";
  const location = (metadata.target_location as string) || "United States";

  const placesKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!placesKey) {
    return { ok: false, error: "GOOGLE_PLACES_API_KEY not configured" };
  }

  const searchQuery = `${niche} in ${location}`;
  let foundCount = 0;
  let skippedNoSocial = 0;

  try {
    // Request more results than needed since we'll filter out businesses
    // without social media presence
    const fetchCount = Math.min(count * 3, 20);

    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": placesKey,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount",
        },
        body: JSON.stringify({
          textQuery: searchQuery,
          maxResultCount: fetchCount,
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    const data = (await res.json()) as {
      places?: Array<Record<string, unknown>>;
    };

    for (const place of data.places ?? []) {
      if (foundCount >= count) break;

      const name =
        (place.displayName as { text?: string })?.text || "Unknown Business";
      const phone = (place.nationalPhoneNumber as string) || null;
      const website = (place.websiteUri as string) || null;

      // Dedup by name + owner
      const { count: existing } = await supabase
        .from("lead_pipeline")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", task.owner_id)
        .ilike("display_name", name);

      if ((existing ?? 0) > 0) continue;

      // Scrape website for social media profiles + email
      // Guard against SSRF — websiteUri from Google Places is business-owner-controlled
      let socialProfiles: SocialProfile[] = [];
      let email: string | null = null;
      let siteHtml = "";

      if (website && !checkFetchUrl(website, { allowHttp: true })) {
        try {
          const siteRes = await fetch(website, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; ShortStackBot/1.0)",
              Accept: "text/html",
            },
            signal: AbortSignal.timeout(8000),
            redirect: "follow",
          });
          siteHtml = await siteRes.text();

          // Extract social media profiles
          socialProfiles = extractSocialProfiles(siteHtml);

          // Extract email as supplementary contact
          const emailMatch = siteHtml.match(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
          );
          if (emailMatch) email = emailMatch[0];
        } catch (err) {
          // website scrape failure is non-critical — skip this lead
          console.error("[cron/run-agent-tasks] website scrape failed", { website }, err);
        }
      }

      // Only insert leads with a DM-able social presence
      if (socialProfiles.length === 0) {
        skippedNoSocial++;
        continue;
      }

      // Pick the best social profile (first match = highest priority per SOCIAL_PATTERNS order)
      const primary = socialProfiles[0];

      // Also dedup by handle + platform
      const { count: handleExists } = await supabase
        .from("lead_pipeline")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", task.owner_id)
        .eq("platform", primary.platform)
        .ilike("handle", primary.handle);

      if ((handleExists ?? 0) > 0) continue;

      await supabase.from("lead_pipeline").insert({
        owner_id: task.owner_id,
        platform: primary.platform,
        handle: primary.handle,
        display_name: name,
        profile_url: primary.profileUrl,
        stage: "outreach_pending",
        source: "agent_task_find_leads",
        lead_info: {
          business_type: niche,
          address: place.formattedAddress,
          phone,
          website,
          email,
          rating: place.rating,
          review_count: place.userRatingCount,
          social_profiles: socialProfiles,
          discovery_source: "google_places",
        },
      });

      foundCount++;
    }
  } catch (err) {
    return {
      ok: false,
      error: `Places API failed: ${"Internal server error"}`,
    };
  }

  return {
    ok: true,
    detail: {
      found: foundCount,
      skipped_no_social: skippedNoSocial,
      query: searchQuery,
    },
  };
};

/**
 * send_outreach: Call /api/leadgen/voice-outreach to synthesize a voice
 * clone message and send it as a DM.
 */
const handleSendOutreach: TaskHandler = async (_supabase, task) => {
  const { lead_id, platform, handle, display_name } = task.payload as {
    lead_id?: string;
    platform?: string;
    handle?: string;
    display_name?: string;
  };

  if (!handle || !platform) {
    return { ok: false, error: "Missing handle or platform in payload" };
  }

  const result = await internalPost("/api/leadgen/voice-outreach", {
    owner_id: task.owner_id,
    handle,
    platform,
    first_name: display_name || undefined,
  });

  return {
    ok: result.ok,
    detail: { lead_id, ...result.data },
    error: result.ok ? undefined : (result.data.error as string),
  };
};

/**
 * follow_up: Generate an AI follow-up message and send it via DM.
 * The autonomous-loop already tracks follow-up attempts.
 */
const handleFollowUp: TaskHandler = async (supabase, task) => {
  const { lead_id, platform, handle, display_name, attempt } =
    task.payload as {
      lead_id?: string;
      platform?: string;
      handle?: string;
      display_name?: string;
      attempt?: number;
    };

  if (!lead_id || !handle || !platform) {
    return { ok: false, error: "Missing lead_id, handle, or platform" };
  }

  // Load the lead's conversation history for context
  const { data: lead } = await supabase
    .from("lead_pipeline")
    .select(
      "id, message_history, outreach_text, display_name, lead_info, stage",
    )
    .eq("id", lead_id)
    .maybeSingle();

  if (!lead) {
    return { ok: false, error: "Lead not found" };
  }

  // Don't follow up dead or already-qualified leads
  if (lead.stage === "dead" || lead.stage === "qualified") {
    return {
      ok: true,
      detail: { skipped: true, reason: `stage_${lead.stage}` },
    };
  }

  // Get owner profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, agency_name")
    .eq("id", task.owner_id)
    .maybeSingle();

  const agencyName =
    profile?.agency_name || profile?.full_name || "our agency";
  const leadName = display_name || lead.display_name || "there";
  const attemptNum = attempt || 1;

  // Generate follow-up message with AI
  let followUpText: string;
  try {
    const result = await callLLMTraced({
      taskType: "generation_short",
      systemPrompt: `You are a friendly follow-up specialist for ${agencyName}. Write a short, natural follow-up DM. No pressure, just checking in. Maximum 2 sentences.`,
      userPrompt: `Write follow-up #${attemptNum} for ${leadName}.
Original outreach: "${lead.outreach_text || "content creation services"}"
They haven't replied yet. Be casual, warm, and brief. Different angle from the original.
${attemptNum >= 2 ? "This is the final follow-up — mention you won't bother them again." : ""}`,
      maxTokens: 150,
      forceModel: "claude-haiku-4-5",
      surface: "agent_follow_up",
      subject: {
        kind: "lead",
        id: lead_id,
        agencyOwnerId: task.owner_id,
      },
      humanize: true,
    });
    followUpText = (
      typeof result === "string" ? result : result.text || ""
    ).trim();
  } catch (err) {
    return {
      ok: false,
      error: `AI generation failed: ${"Internal server error"}`,
    };
  }

  if (!followUpText) {
    return { ok: false, error: "AI returned empty follow-up" };
  }

  // Send via Zernio DM (centralised)
  const dmResult = await zernioDM({ platform, handle, message: followUpText });
  if (!dmResult.ok) {
    console.error("[run-agent-tasks] Zernio follow-up send failed:", dmResult.error);
  }

  // Update message history
  const history = Array.isArray(lead.message_history)
    ? (lead.message_history as Array<Record<string, unknown>>)
    : [];
  const updatedHistory = [
    ...history,
    {
      role: "assistant",
      content: `[follow-up #${attemptNum}] ${followUpText}`,
      timestamp: new Date().toISOString(),
    },
  ];

  await supabase
    .from("lead_pipeline")
    .update({
      message_history: updatedHistory,
      last_follow_up_at: new Date().toISOString(),
    })
    .eq("id", lead_id);

  return {
    ok: true,
    detail: { attempt: attemptNum, message: followUpText },
  };
};

/**
 * generate_content: Call /api/leadgen/generate-content to produce a
 * content package for a qualified lead.
 */
const handleGenerateContent: TaskHandler = async (_supabase, task) => {
  const leadId =
    (task.payload.lead_id as string) || task.pipeline_id;

  if (!leadId) {
    return { ok: false, error: "Missing lead_id in payload" };
  }

  const result = await internalPost("/api/leadgen/generate-content", {
    lead_id: leadId,
  });

  return {
    ok: result.ok,
    detail: result.data,
    error: result.ok ? undefined : (result.data.error as string),
  };
};

/**
 * publish: Deliver the generated content to the lead via DM.
 * For now, this sends the content brief + a portal link.
 * Future: actually publish to their social accounts via Zernio.
 */
const handlePublish: TaskHandler = async (supabase, task) => {
  const leadId =
    (task.payload.lead_id as string) || task.pipeline_id;

  if (!leadId) {
    return { ok: false, error: "Missing lead_id in payload" };
  }

  // Check if the lead has generated content and payment
  const { data: lead } = await supabase
    .from("lead_pipeline")
    .select(
      "id, owner_id, display_name, handle, platform, generated_content, payment_received_at, stage",
    )
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) {
    return { ok: false, error: "Lead not found" };
  }

  const content = lead.generated_content as Record<string, unknown> | null;
  if (!content?.brief) {
    return { ok: false, error: "No generated content to publish" };
  }

  // Build deliverable summary
  const brief = (content.brief as string) || "";
  const captions = (content.captions as string[]) || [];
  const hookIdeas = (content.hook_ideas as string[]) || [];
  const portalUrl = `${APP_URL}/portal/${leadId}`;

  const deliveryMessage = [
    `Hey ${lead.display_name || lead.handle}! Your content package is ready 🎉`,
    "",
    `📋 Brief: ${brief}`,
    "",
    `📱 ${captions.length} social captions + ${hookIdeas.length} video hooks ready`,
    "",
    `View everything in your portal: ${portalUrl}`,
    "",
    "Let me know what you think!",
  ].join("\n");

  const result = await internalPost("/api/leadgen/deliver", {
    lead_id: leadId,
    owner_id: task.owner_id,
    deliverable_urls: [portalUrl],
    delivery_message: deliveryMessage,
  });

  return {
    ok: result.ok,
    detail: result.data,
    error: result.ok ? undefined : (result.data.error as string),
  };
};

/**
 * setup_ads: Initialize ads autopilot for a newly-paid client whose
 * service_needs include "ads_management".
 *
 * Uses Zernio Ads API directly — handles Meta, Google, TikTok, LinkedIn,
 * Pinterest, and X through a single bearer-token integration.
 *
 * Flow:
 *   1. Ensure the lead has a Zernio profile (create if missing)
 *   2. Check which ad platforms are connected
 *   3. Sync existing campaigns from connected platforms
 *   4. DM the lead with a connection link for any missing platforms
 *   5. Log results to trinity
 */
const handleSetupAds: TaskHandler = async (supabase, task) => {
  const leadId =
    (task.payload.lead_id as string) || task.pipeline_id;

  if (!leadId) {
    return { ok: false, error: "Missing lead_id in payload" };
  }

  const { data: lead } = await supabase
    .from("lead_pipeline")
    .select("id, owner_id, display_name, handle, platform, lead_info, stage")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) {
    return { ok: false, error: "Lead not found" };
  }

  const leadInfo = (lead.lead_info ?? {}) as Record<string, unknown>;
  const clientName = lead.display_name || lead.handle || "Client";

  // 1. Ensure Zernio profile exists for this lead-as-client
  // Use lead_id as pseudo-client_id since leads aren't in the clients table yet
  let profileId = await getClientZernioProfile(supabase, leadId);
  if (!profileId) {
    const setup = await setupClientInZernio(supabase, leadId, clientName);
    if (!setup.success || !setup.profileId) {
      return { ok: false, error: `Failed to create Zernio profile: ${setup.error}` };
    }
    profileId = setup.profileId;
  }

  // 2. Check connected ad platforms
  const connections = await getAdConnections(profileId);
  const connectedPlatforms = connections
    .filter((c) => c.status === "connected")
    .map((c) => c.platform);
  const disconnectedPlatforms = connections
    .filter((c) => c.status !== "connected")
    .map((c) => c.platform);

  // 3. Sync campaigns from connected platforms
  let totalCampaigns = 0;
  const campaignSummary: Array<{ platform: string; count: number; active: number }> = [];

  for (const plat of connectedPlatforms) {
    const campaigns = await listCampaigns({ profileId, platform: plat });
    const activeCampaigns = campaigns.filter((c) => c.status === "active");
    totalCampaigns += campaigns.length;
    campaignSummary.push({
      platform: plat,
      count: campaigns.length,
      active: activeCampaigns.length,
    });
  }

  // 4. DM the lead about connection status
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";

  if (disconnectedPlatforms.length > 0 && connectedPlatforms.length === 0) {
    // No platforms connected yet — send setup DM
    const connectUrl = `${appUrl}/portal/${leadId}/connect-ads`;
    await zernioDM({
      platform: lead.platform,
      handle: lead.handle,
      message: `Hey ${clientName}! To get your ads running, I need you to connect your ad accounts. It takes about 60 seconds:\n\n${connectUrl}\n\nOnce connected, I'll start optimizing your campaigns automatically!`,
    });
  } else if (connectedPlatforms.length > 0) {
    // Some platforms connected — confirm we're managing them
    await zernioDM({
      platform: lead.platform,
      handle: lead.handle,
      message: `Hey ${clientName}! I'm now managing your ads on ${connectedPlatforms.join(", ")}. Found ${totalCampaigns} existing campaign(s). I'll monitor performance and optimize automatically. You'll get weekly reports!`,
    });
  }

  // 5. Log to trinity
  await supabase.from("trinity_log").insert({
    action_type: "automation",
    description: `Ads setup via Zernio for ${clientName} — ${connectedPlatforms.length} platform(s) connected, ${totalCampaigns} campaign(s) synced`,
    user_id: task.owner_id,
    status: "completed",
    result: {
      lead_id: leadId,
      zernio_profile_id: profileId,
      connected: connectedPlatforms,
      disconnected: disconnectedPlatforms,
      campaigns: campaignSummary,
    },
  });

  return {
    ok: true,
    detail: {
      zernio_profile_id: profileId,
      connected_platforms: connectedPlatforms,
      disconnected_platforms: disconnectedPlatforms,
      campaigns_synced: totalCampaigns,
      campaign_summary: campaignSummary,
    },
  };
};

/**
 * auto_edit_video: Trigger the auto-edit pipeline for footage attached
 * to a lead. Called from the task queue when process-footage detects
 * video attachments or when a client sends new footage via DM.
 */
const handleAutoEditVideo: TaskHandler = async (supabase, task) => {
  const {
    lead_id,
    video_url,
    project_id,
  } = task.payload as {
    lead_id?: string;
    video_url?: string;
    project_id?: string;
  };

  if (!video_url) {
    return { ok: false, error: "Missing video_url in payload" };
  }

  // Use the existing full-pass route which handles the 4-step pipeline
  const result = await internalPost("/api/video/auto-edit/full-pass", {
    video_url,
    project_id: project_id || `auto-${lead_id || task.id}`,
    auto_accept: true,
    owner_id: task.owner_id,
  });

  // If successful and we have a lead, fire delivery
  if (result.ok && lead_id && result.data.output_url) {
    await internalPost("/api/leadgen/deliver", {
      lead_id,
      owner_id: task.owner_id,
      deliverable_urls: [result.data.output_url as string],
      delivery_message: undefined, // use default
    });
  }

  return {
    ok: result.ok,
    detail: { lead_id, ...result.data },
    error: result.ok ? undefined : (result.data.error as string),
  };
};

/**
 * reengage: Post-delivery follow-up. Checks in with the client 3 days
 * after delivery to ask if they need more work — closing the
 * "rinse and repeat" loop back to qualifying/onboarding.
 */
const handleReengage: TaskHandler = async (supabase, task) => {
  const leadId =
    (task.payload.lead_id as string) || task.pipeline_id;
  const step = (task.payload.step as number) || 1; // Multi-step: 1=check-in, 2=value-add, 3=soft-pitch

  if (!leadId) {
    return { ok: false, error: "Missing lead_id in payload" };
  }

  const { data: lead } = await supabase
    .from("lead_pipeline")
    .select(
      "id, owner_id, platform, handle, display_name, stage, lead_info, delivered_at, message_history",
    )
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) {
    return { ok: false, error: "Lead not found" };
  }

  // Only re-engage delivered leads or leads we already re-engaged (outreach_sent)
  // Skip if they've already moved past outreach_sent on their own (replied, qualifying, etc.)
  if (lead.stage !== "delivered" && !(lead.stage === "outreach_sent" && step > 1)) {
    return {
      ok: true,
      detail: { skipped: true, reason: `stage_${lead.stage}`, step },
    };
  }

  // Get owner profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, agency_name")
    .eq("id", task.owner_id)
    .maybeSingle();

  const agencyName =
    profile?.agency_name || profile?.full_name || "our team";
  const leadName = lead.display_name || lead.handle || "there";
  const serviceNeeds = ((lead.lead_info as Record<string, unknown>)?.service_needs as string[]) || [];

  // Multi-step re-engagement prompts
  const stepPrompts: Record<number, { system: string; user: string }> = {
    1: {
      system: `You are a friendly account manager for ${agencyName}. Write a short, warm check-in DM to a client we just delivered work to. Ask how the content is performing. Maximum 3 sentences.`,
      user: `Write a check-in message for ${leadName}. Their business: ${(lead.lead_info as Record<string, unknown>)?.business_type || "unknown"}. Services used: ${serviceNeeds.length > 0 ? serviceNeeds.join(", ") : "content creation"}. We delivered their work recently. Be casual and brief.`,
    },
    2: {
      system: `You are a helpful account manager for ${agencyName}. Write a value-add DM — share a specific, actionable tip related to their service. Maximum 3 sentences. End with a soft offer to help implement.`,
      user: `Share a useful tip with ${leadName}. Their business: ${(lead.lead_info as Record<string, unknown>)?.business_type || "unknown"}. Services: ${serviceNeeds.length > 0 ? serviceNeeds.join(", ") : "content creation"}. If video editing: share a posting-time or hook strategy tip. If ads: share an optimization or audience tip. Be genuinely helpful, not salesy.`,
    },
    3: {
      system: `You are a direct but friendly account manager for ${agencyName}. Write a brief DM pitching the next project or batch of work. Maximum 3 sentences. Be specific about what you can do next.`,
      user: `Write a soft pitch for ${leadName}'s next project. Their business: ${(lead.lead_info as Record<string, unknown>)?.business_type || "unknown"}. Services: ${serviceNeeds.length > 0 ? serviceNeeds.join(", ") : "content creation"}. Suggest a specific next step (more videos, new ad campaign, content refresh). Make it easy to say yes.`,
    },
  };

  const prompt = stepPrompts[step] || stepPrompts[3];

  // Generate re-engagement message with AI
  let reengageText: string;
  try {
    const result = await callLLMTraced({
      taskType: "generation_short",
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      maxTokens: 200,
      forceModel: "claude-haiku-4-5",
      surface: "agent_reengage",
      subject: {
        kind: "lead",
        id: leadId,
        agencyOwnerId: task.owner_id,
      },
      humanize: true,
    });
    reengageText = (
      typeof result === "string" ? result : result.text || ""
    ).trim();
  } catch (err) {
    return {
      ok: false,
      error: `AI generation failed: ${"Internal server error"}`,
    };
  }

  if (!reengageText) {
    return { ok: false, error: "AI returned empty re-engagement message" };
  }

  // Send via Zernio DM (centralised)
  const dmResult = await zernioDM({
    platform: lead.platform,
    handle: lead.handle,
    message: reengageText,
  });
  if (!dmResult.ok) {
    console.error("[run-agent-tasks] Zernio re-engage send failed:", dmResult.error);
  }

  // Update message history and move back to outreach_sent stage
  // so future replies route through the qualify flow again
  const history = Array.isArray(lead.message_history)
    ? (lead.message_history as Array<Record<string, unknown>>)
    : [];
  const updatedHistory = [
    ...history,
    {
      role: "assistant",
      content: `[re-engagement step ${step}] ${reengageText}`,
      timestamp: new Date().toISOString(),
    },
  ];

  await supabase
    .from("lead_pipeline")
    .update({
      stage: "outreach_sent", // back to outreach_sent so replies trigger qualify flow
      message_history: updatedHistory,
    })
    .eq("id", leadId);

  // Schedule next re-engagement step if not the last
  if (step < 3) {
    const nextDelay = step === 1 ? 4 : 7; // step 2 at day 7, step 3 at day 14
    const nextAt = new Date(
      Date.now() + nextDelay * 24 * 60 * 60 * 1000,
    ).toISOString();
    await supabase.from("agent_task_queue").insert({
      owner_id: task.owner_id,
      task_type: "reengage",
      agent_key: "content-pipeline",
      priority: 30,
      payload: { lead_id: leadId, step: step + 1 },
      pipeline_id: leadId,
      status: "queued",
      scheduled_for: nextAt,
    });
  }

  return {
    ok: true,
    detail: { message: reengageText, step },
  };
};

/**
 * payment_followup: Remind a lead who hasn't paid yet.
 * Sends a gentle nudge DM and schedules another reminder
 * up to 3 times (day 2, day 5, day 9 after payment_sent).
 */
const handlePaymentFollowup: TaskHandler = async (supabase, task) => {
  const leadId =
    (task.payload.lead_id as string) || task.pipeline_id;
  const attempt = (task.payload.attempt as number) || 1;

  if (!leadId) {
    return { ok: false, error: "Missing lead_id in payload" };
  }

  const { data: lead } = await supabase
    .from("lead_pipeline")
    .select(
      "id, owner_id, platform, handle, display_name, stage, lead_info",
    )
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) {
    return { ok: false, error: "Lead not found" };
  }

  // Only follow up if still in payment_sent stage
  if (lead.stage !== "payment_sent") {
    return {
      ok: true,
      detail: { skipped: true, reason: `stage_${lead.stage}` },
    };
  }

  const leadName = lead.display_name || lead.handle || "there";

  // Get owner profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, agency_name")
    .eq("id", task.owner_id)
    .maybeSingle();

  const agencyName =
    profile?.agency_name || profile?.full_name || "our team";

  // Generate payment reminder with AI
  const toneByAttempt: Record<number, string> = {
    1: "friendly and casual — just a gentle check-in about the invoice",
    2: "warm but slightly more direct — mention you're ready to start as soon as payment comes through",
    3: "direct but still professional — last reminder, mention you'll free up the slot if no response",
  };

  let reminderText: string;
  try {
    const result = await callLLMTraced({
      taskType: "generation_short",
      systemPrompt: `You are a friendly account manager for ${agencyName}. Write a short payment reminder DM. Maximum 3 sentences. Tone: ${toneByAttempt[attempt] || toneByAttempt[3]}.`,
      userPrompt: `Write a payment follow-up DM for ${leadName}. This is reminder #${attempt} of 3. Their business: ${(lead.lead_info as Record<string, unknown>)?.business_type || "unknown"}.`,
      maxTokens: 150,
      forceModel: "claude-haiku-4-5",
      surface: "agent_payment_followup",
      subject: {
        kind: "lead",
        id: leadId,
        agencyOwnerId: task.owner_id,
      },
      humanize: true,
    });
    reminderText = (
      typeof result === "string" ? result : result.text || ""
    ).trim();
  } catch (err) {
    return {
      ok: false,
      error: `AI generation failed: ${"Internal server error"}`,
    };
  }

  if (!reminderText) {
    return { ok: false, error: "AI returned empty reminder message" };
  }

  // Send via Zernio DM
  const dmResult = await zernioDM({
    platform: lead.platform,
    handle: lead.handle,
    message: reminderText,
  });
  if (!dmResult.ok) {
    console.error("[run-agent-tasks] payment followup DM failed:", dmResult.error);
  }

  // Schedule next reminder if not the last
  if (attempt < 3) {
    const nextDelay = attempt === 1 ? 3 : 4; // day 2 → day 5 → day 9
    const nextAt = new Date(
      Date.now() + nextDelay * 24 * 60 * 60 * 1000,
    ).toISOString();
    await supabase.from("agent_task_queue").insert({
      owner_id: task.owner_id,
      task_type: "payment_followup",
      agent_key: "content-pipeline",
      priority: 20, // higher priority than re-engagement
      payload: { lead_id: leadId, attempt: attempt + 1 },
      pipeline_id: leadId,
      status: "queued",
      scheduled_for: nextAt,
    });
  }

  return {
    ok: true,
    detail: { message: reminderText, attempt },
  };
};

// ── Handler dispatch map ─────────────────────────────────────────────────────

const TASK_HANDLERS: Record<string, TaskHandler> = {
  find_leads: handleFindLeads,
  send_outreach: handleSendOutreach,
  follow_up: handleFollowUp,
  generate_content: handleGenerateContent,
  publish: handlePublish,
  setup_ads: handleSetupAds,
  auto_edit_video: handleAutoEditVideo,
  reengage: handleReengage,
  payment_followup: handlePaymentFollowup,
};

// ── Activity logger ──────────────────────────────────────────────────────────

async function logActivity(
  supabase: SupabaseClient,
  ownerId: string,
  agentKey: string,
  eventType: string,
  summary: string,
  refId?: string,
): Promise<void> {
  await supabase
    .from("agent_activity_events")
    .insert({
      agency_owner_id: ownerId,
      agent_key: agentKey,
      event_type: eventType,
      summary,
      ref_table: "agent_task_queue",
      ref_id: refId ?? null,
    })
    .then(() => {});
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }

  // May 27 audit: x-vercel-cron header alone is spoofable by any internet
  // caller — removed the bypass. CRON_SECRET bearer is the only gate, which
  // Vercel itself supplies automatically when the secret is configured.
  const authHeader = request.headers.get("authorization");
  const rawToken = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !secureCompare(rawToken, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Pick up pending tasks, ordered by priority (lower = more urgent)
  const { data: tasks, error: fetchErr } = await supabase
    .from("agent_task_queue")
    .select(
      "id, owner_id, task_type, agent_key, priority, payload, pipeline_id, scheduled_for",
    )
    .eq("status", "queued")
    .lte("scheduled_for", new Date().toISOString())
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(MAX_TASKS_PER_TICK);

  if (fetchErr) {
    console.error("[run-agent-tasks] query failed:", fetchErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const queue = (tasks ?? []) as QueuedTask[];
  if (queue.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  // Claim all tasks atomically (set status=running so concurrent ticks skip them)
  const taskIds = queue.map((t) => t.id);
  await supabase
    .from("agent_task_queue")
    .update({ status: "running", started_at: new Date().toISOString() })
    .in("id", taskIds);

  // Process in parallel
  const results = await Promise.allSettled(
    queue.map(async (task) => {
      const startMs = Date.now();
      const handler = TASK_HANDLERS[task.task_type];

      if (!handler) {
        const msg = `Unknown task_type: ${task.task_type}`;
        await supabase
          .from("agent_task_queue")
          .update({
            status: "failed",
            error_message: msg,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startMs,
          })
          .eq("id", task.id);
        return { taskId: task.id, ok: false, error: msg };
      }

      try {
        const result = await handler(supabase, task);
        const durationMs = Date.now() - startMs;

        await supabase
          .from("agent_task_queue")
          .update({
            status: result.ok ? "completed" : "failed",
            error_message: result.error ?? null,
            completed_at: new Date().toISOString(),
            duration_ms: durationMs,
          })
          .eq("id", task.id);

        // Log activity
        const emoji = result.ok ? "✅" : "❌";
        await logActivity(
          supabase,
          task.owner_id,
          task.agent_key,
          `task_${result.ok ? "completed" : "failed"}`,
          `${emoji} ${task.task_type} ${result.ok ? "completed" : "failed"} (${durationMs}ms)${result.error ? `: ${result.error}` : ""}`,
          task.id,
        );

        return { taskId: task.id, ok: result.ok, error: result.error };
      } catch (err) {
        const durationMs = Date.now() - startMs;
        const errMsg =
          "Internal server error";

        await supabase
          .from("agent_task_queue")
          .update({
            status: "failed",
            error_message: errMsg,
            completed_at: new Date().toISOString(),
            duration_ms: durationMs,
          })
          .eq("id", task.id);

        await logActivity(
          supabase,
          task.owner_id,
          task.agent_key,
          "task_failed",
          `❌ ${task.task_type} crashed: ${errMsg}`,
          task.id,
        );

        return { taskId: task.id, ok: false, error: errMsg };
      }
    }),
  );

  let completed = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.ok) completed++;
    else failed++;
  }

  return NextResponse.json({
    processed: queue.length,
    completed,
    failed,
  });
}
