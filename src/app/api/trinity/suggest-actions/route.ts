import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { safeJsonParse } from "@/lib/ai/claude-helpers";
import { sendCached, MODEL_HAIKU } from "@/lib/ai/claude-client";
import {
  SMART_MANAGE_ACTIONS,
  SMART_MANAGE_ACTION_TYPES,
  resolveSmartManageAction,
  type SmartManageActionType,
} from "@/lib/smart-manage/actions";

// Smart Manage suggestion API.
//
// POST { client_id }
//   → loads the client's current state (plan, leads, campaigns, invoices,
//     domain/email health, social tokens), asks Claude Haiku for 3-5
//     whitelisted action suggestions, validates every action type against
//     the catalog, logs to smart_manage_log, and returns the cards.
//
// Haiku is used here for speed — this endpoint should feel instant when
// the agency user clicks "Manage".
export const maxDuration = 20;

interface SuggestedAction {
  action: SmartManageActionType;
  label: string;
  reason: string;
  estimated_impact: string;
  one_click_payload: Record<string, unknown>;
}

function daysAgo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const clientId: string | undefined = body?.client_id;
  if (!clientId) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Fetch everything we need to describe the client's current state. All
  // pulls are .maybeSingle() / best-effort — missing tables just mean the
  // section doesn't make it into the prompt.
  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [
    { data: client },
    { data: invoices },
    { data: campaigns },
    { data: calendar },
    { data: leads },
    { data: socials },
    { data: recentActivity },
  ] = await Promise.all([
    service.from("clients").select("*").eq("id", clientId).maybeSingle(),
    service.from("invoices").select("id,amount,status,due_date,description,created_at")
      .eq("client_id", clientId).order("created_at", { ascending: false }).limit(10),
    service.from("campaigns").select("id,name,platform,status,spend,roas,cpa,conversions,created_at")
      .eq("client_id", clientId).order("created_at", { ascending: false }).limit(5),
    service.from("content_calendar").select("id,scheduled_at,status,platform")
      .eq("client_id", clientId).gte("scheduled_at", since7d).limit(20),
    service.from("leads").select("id,status,created_at")
      .eq("assigned_client_id", clientId).gte("created_at", since30d).limit(100),
    service.from("social_connections").select("platform,last_post_at,token_expires_at,status")
      .eq("client_id", clientId).limit(10),
    service.from("trinity_log").select("created_at")
      .eq("client_id", clientId).order("created_at", { ascending: false }).limit(1),
  ]);

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Permission — only the owning user can manage their client.
  if (client.profile_id && client.profile_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const overdueInvoices = (invoices || []).filter(
    (i) => i.status !== "paid" && i.due_date && new Date(i.due_date).getTime() < Date.now(),
  );
  const totalOverdue = overdueInvoices.reduce((s, i) => s + (i.amount || 0), 0);

  const activeCampaigns = (campaigns || []).filter((c) => c.status === "active");
  const underperformingCampaigns = activeCampaigns.filter(
    (c) => (c.roas || 0) < 1 && (c.spend || 0) > 100,
  );

  const upcomingContent = (calendar || []).filter((c) => c.status === "scheduled").length;
  const leadCount = (leads || []).length;
  const converted = (leads || []).filter((l) => l.status === "converted").length;
  const conversionRate = leadCount ? (converted / leadCount) * 100 : 0;

  const expiringTokens = (socials || []).filter((s) => {
    const d = daysAgo(s.token_expires_at);
    return d !== null && d > -7 && d < 7; // within 7 days of now (expired or expiring)
  });
  const staleSocials = (socials || []).filter((s) => {
    const d = daysAgo(s.last_post_at);
    return d !== null && d > 14;
  });

  const lastActivity = recentActivity?.[0]?.created_at || null;
  const daysSinceActivity = daysAgo(lastActivity);

  const metadata = (client.metadata as Record<string, unknown> | undefined) || {};
  const domainStatus = (metadata.domain_status as string) || "unknown";
  const dkimStatus = (metadata.dkim_status as string) || "unknown";
  const phoneConfigured = !!client.phone;

  // Prompt Claude Haiku. Tell it EXACTLY which action types it may return
  // and the contract for the JSON response.
  const actionCatalog = SMART_MANAGE_ACTION_TYPES.map((t) => {
    const def = SMART_MANAGE_ACTIONS[t];
    return `  - ${t}: ${def.description} (payload keys: ${Object.keys(def.input_schema).join(", ")})`;
  }).join("\n");

  const stateSummary = {
    client_name: client.business_name,
    plan_tier: client.package_tier || "standard",
    mrr: client.mrr || 0,
    health_score: client.health_score || 0,
    is_active: client.is_active,
    days_since_last_activity: daysSinceActivity,
    leads_30d: leadCount,
    conversion_rate_pct: Math.round(conversionRate * 10) / 10,
    active_campaigns: activeCampaigns.length,
    underperforming_campaigns: underperformingCampaigns.map((c) => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      roas: c.roas,
      cpa: c.cpa,
      spend: c.spend,
    })),
    overdue_invoices: overdueInvoices.map((i) => ({
      id: i.id,
      amount: i.amount,
      description: i.description,
      due_date: i.due_date,
    })),
    total_overdue_usd: totalOverdue,
    upcoming_scheduled_posts: upcomingContent,
    stale_social_accounts: staleSocials.map((s) => ({
      platform: s.platform,
      days_since_post: daysAgo(s.last_post_at),
    })),
    expiring_social_tokens: expiringTokens.map((s) => ({
      platform: s.platform,
      days_until_expiry: daysAgo(s.token_expires_at) !== null ? -daysAgo(s.token_expires_at)! : null,
    })),
    domain_status: domainStatus,
    dkim_status: dkimStatus,
    phone_configured: phoneConfigured,
  };

  const systemPrompt = `You are Trinity, helping an agency user manage a single client workspace in one click.

You will be given the client's current state. Return 3-5 high-impact action suggestions.

RULES:
1. Output ONLY a JSON array. No prose, no markdown, no code fences.
2. Each item must match: { "action": <one of the whitelisted types>, "label": "<verb-first, under 40 chars>", "reason": "<one line, why NOW>", "estimated_impact": "<short, concrete — e.g. 'Recovers $1,200', '2x CTR', 'Unblocks publishing'>", "one_click_payload": <object with only the keys from the action's payload schema> }
3. NEVER invent an action type. Only these are allowed:
${actionCatalog}
4. Order by highest impact first. Prefer fixes for broken things (overdue invoices, expired tokens, stalled onboarding) over nice-to-haves.
5. Include the client_id in one_click_payload when the schema lists it.
6. If there's nothing urgent, still return 3 reasonable actions — do not return an empty array.`;

  const userPrompt = `Client state:
${JSON.stringify(stateSummary, null, 2)}

client_id: ${clientId}

Return the JSON array now.`;

  let suggestions: SuggestedAction[] = [];
  let rawResponse = "";

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      // Cache the 15-action catalog + schema rules — identical across
      // every Smart Manage call for every client. 90% off on cache hits.
      const result = await sendCached({
        model: MODEL_HAIKU,
        maxTokens: 1200,
        system: systemPrompt,
        userMessage: userPrompt,
        endpoint: "smart-manage/suggest-actions",
        userId: user.id,
      });
      rawResponse = result.text;
      const parsed = safeJsonParse<SuggestedAction[]>(rawResponse);
      if (Array.isArray(parsed)) {
        suggestions = parsed;
      }
    } catch (err) {
      console.error("[suggest-actions] Claude error:", err);
    }
  }

  // Validate & sanitize — drop anything Claude hallucinated.
  const validated: SuggestedAction[] = [];
  for (const s of suggestions) {
    const def = resolveSmartManageAction(s?.action);
    if (!def) continue;
    // Always inject the real client_id if the schema expects it, never
    // trust Claude to pass it through correctly.
    const payload: Record<string, unknown> = { ...(s.one_click_payload || {}) };
    if ("client_id" in def.input_schema) payload.client_id = clientId;
    validated.push({
      action: def.type,
      label: (s.label || def.label).slice(0, 60),
      reason: (s.reason || "").slice(0, 160),
      estimated_impact: (s.estimated_impact || "").slice(0, 80),
      one_click_payload: payload,
    });
    if (validated.length >= 5) break;
  }

  // Fallback — if Claude failed or returned nothing usable, surface a
  // deterministic set based on the client's actual state so the UI is
  // never empty.
  if (validated.length === 0) {
    if (overdueInvoices[0]) {
      validated.push({
        action: "send_invoice_reminder",
        label: `Send reminder on $${overdueInvoices[0].amount} invoice`,
        reason: "There's an overdue invoice sitting on this account.",
        estimated_impact: `Recovers $${overdueInvoices[0].amount}`,
        one_click_payload: { client_id: clientId, invoice_id: overdueInvoices[0].id },
      });
    }
    if (expiringTokens[0]) {
      validated.push({
        action: "refresh_social_token",
        label: `Refresh ${expiringTokens[0].platform} token`,
        reason: "Token expires within 7 days; posts will start failing.",
        estimated_impact: "Keeps publishing alive",
        one_click_payload: { client_id: clientId, platform: expiringTokens[0].platform },
      });
    }
    if (daysSinceActivity === null || daysSinceActivity > 30) {
      validated.push({
        action: "book_strategy_call",
        label: "Book a strategy call",
        reason: "No activity on this account for 30+ days.",
        estimated_impact: "Reduces churn risk",
        one_click_payload: { client_id: clientId, duration_minutes: 30 },
      });
    }
    if (upcomingContent < 3) {
      validated.push({
        action: "generate_content_batch",
        label: "Generate next week of content",
        reason: "Content queue is thin — risk of dark week.",
        estimated_impact: "7 posts queued",
        one_click_payload: { client_id: clientId, count: 7, platform: "instagram" },
      });
    }
    if (validated.length === 0) {
      validated.push({
        action: "request_review",
        label: "Ask for a client review",
        reason: "Healthy account with no urgent issues — compound social proof.",
        estimated_impact: "+1 testimonial",
        one_click_payload: { client_id: clientId, channel: "google" },
      });
    }
  }

  // Log the suggestion set for audit.
  try {
    await service.from("smart_manage_log").insert({
      user_id: user.id,
      client_id: clientId,
      suggested_actions: validated,
    });
  } catch (err) {
    console.error("[suggest-actions] log insert failed:", err);
  }

  return NextResponse.json({
    client_id: clientId,
    client_name: client.business_name,
    suggestions: validated,
  });
}
