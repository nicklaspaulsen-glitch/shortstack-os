import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";

/**
 * GET /api/dashboard/ai-today
 *
 * Surfaces the 3 most actionable items for THIS user RIGHT NOW based on
 * their actual data. Uses Claude Haiku to reason over a snapshot of:
 *   - Cold leads not contacted recently
 *   - Empty content calendar slots in the next 7 days
 *   - Voice receptionist setup state (configured vs not)
 *   - Stalled deals
 *   - Unpublished social drafts
 *   - Inbound conversations awaiting reply
 *
 * Returns: { actions: Array<{ title, why, cta_label, cta_href, urgency, icon }> }
 *
 * Fast (~$0.0001/call via Haiku). Cached server-side per user for 5 minutes
 * via Cache-Control so the dashboard doesn't burn tokens on every reload.
 */
export const dynamic = "force-dynamic";

interface ActionSuggestion {
  title: string;
  why: string;
  cta_label: string;
  cta_href: string;
  urgency: "high" | "medium" | "low";
  icon: "leads" | "content" | "calls" | "deals" | "inbox" | "setup" | "money";
}

export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Snapshot the user's data — keep this small + fast (parallel queries) ──
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const next7Iso = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  const [
    { count: coldLeads },
    { count: hotLeads },
    { count: replied7d },
    { count: contentScheduled7d },
    { count: stalledDeals },
    { count: unread7d },
    { data: clientForVoice },
    { data: lastTrinityAction },
    { count: socialDraftsCount },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "new")
      .lt("scraped_at", since7d),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "replied"),
    supabase
      .from("outreach_log")
      .select("*", { count: "exact", head: true })
      .eq("status", "replied")
      .gte("sent_at", since7d),
    supabase
      .from("content_calendar")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_at", today)
      .lte("scheduled_at", next7Iso),
    supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "open")
      .lt("updated_at", since7d),
    supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "unread")
      .gte("last_message_at", since7d),
    supabase
      .from("clients")
      .select("id, business_name, eleven_agent_id, twilio_phone_number")
      .eq("profile_id", user.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("trinity_log")
      .select("created_at, action_type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("publish_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "draft")
      .gte("created_at", since30d),
  ]);

  const snapshot = {
    cold_leads_no_outreach: coldLeads || 0,
    hot_leads_replied: hotLeads || 0,
    replies_last_7d: replied7d || 0,
    content_scheduled_next_7d: contentScheduled7d || 0,
    stalled_deals_no_update_7d: stalledDeals || 0,
    unread_inbound_messages: unread7d || 0,
    voice_receptionist_configured: !!(clientForVoice?.eleven_agent_id && clientForVoice?.twilio_phone_number),
    last_trinity_action: lastTrinityAction?.action_type || null,
    last_trinity_at: lastTrinityAction?.created_at || null,
    social_drafts_pending: socialDraftsCount || 0,
  };

  // ── Ask Haiku for the top 3 actions ──
  const prompt = `You are an agency-operations assistant. Given the user's current data snapshot, propose the top 3 most useful actions they should take RIGHT NOW. Each action should be:
  - Specific and concrete (not "review your strategy")
  - Tied to a real number from the data ("5 leads went cold")
  - Actionable in <5 minutes if possible
  - Diverse (don't propose 3 lead-gen actions if other areas need attention)

Snapshot:
${JSON.stringify(snapshot, null, 2)}

Available CTA hrefs (must use one of these — no other paths):
  /dashboard/scraper           — Lead Finder
  /dashboard/outreach-hub      — Outreach campaigns
  /dashboard/eleven-agents     — AI Caller / outbound calls
  /dashboard/voice-receptionist — Voice Receptionist setup
  /dashboard/content-plan      — Content calendar
  /dashboard/social-manager    — Social media posting
  /dashboard/conversations     — Inbox / replies
  /dashboard/crm               — CRM
  /dashboard/deals             — Deal pipeline
  /dashboard/clients           — Client list
  /dashboard/copywriter        — AI copywriter
  /dashboard/ai-studio         — AI Studio
  /dashboard/thumbnail-generator — Thumbnails
  /dashboard/funnels           — Funnel builder
  /dashboard/getting-started   — Onboarding checklist

Return ONLY a valid JSON object — no markdown fences, no commentary — matching this shape:
{
  "actions": [
    {
      "title": "<short imperative — under 60 chars>",
      "why": "<one sentence explaining the data point — under 100 chars>",
      "cta_label": "<button text — under 20 chars>",
      "cta_href": "<one of the paths above>",
      "urgency": "high" | "medium" | "low",
      "icon": "leads" | "content" | "calls" | "deals" | "inbox" | "setup" | "money"
    }
  ]
}

Rules:
  - Exactly 3 actions
  - At most ONE "high" urgency action (or zero if data is fine)
  - If voice_receptionist_configured is false AND there are hot_leads, prioritize finishing voice receptionist setup
  - If unread_inbound_messages > 0, ALWAYS include "reply to inbox" as one action`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = getResponseText(response);
    const parsed = safeJsonParse<{ actions: ActionSuggestion[] }>(raw);

    if (!parsed?.actions || parsed.actions.length === 0) {
      return NextResponse.json({ actions: defaultActions(snapshot) });
    }

    // Sanitize — only allow a known set of cta_hrefs and icons.
    const allowedHrefs = new Set([
      "/dashboard/scraper", "/dashboard/outreach-hub", "/dashboard/eleven-agents",
      "/dashboard/voice-receptionist", "/dashboard/content-plan", "/dashboard/social-manager",
      "/dashboard/conversations", "/dashboard/crm", "/dashboard/deals",
      "/dashboard/clients", "/dashboard/copywriter", "/dashboard/ai-studio",
      "/dashboard/thumbnail-generator", "/dashboard/funnels", "/dashboard/getting-started",
    ]);
    const allowedIcons = new Set(["leads", "content", "calls", "deals", "inbox", "setup", "money"]);
    const allowedUrgency = new Set(["high", "medium", "low"]);

    const actions = parsed.actions.slice(0, 3).map((a) => ({
      title: String(a.title || "").slice(0, 80),
      why: String(a.why || "").slice(0, 120),
      cta_label: String(a.cta_label || "Open").slice(0, 24),
      cta_href: allowedHrefs.has(a.cta_href) ? a.cta_href : "/dashboard",
      urgency: allowedUrgency.has(a.urgency) ? a.urgency : "medium",
      icon: allowedIcons.has(a.icon) ? a.icon : "setup",
    }));

    const res = NextResponse.json({ actions, generated_at: new Date().toISOString() });
    // Cache 5 min so the dashboard doesn't re-trigger Haiku on every soft nav
    res.headers.set("Cache-Control", "private, max-age=300");
    return res;
  } catch (err) {
    console.error("[ai-today] error:", err);
    return NextResponse.json({ actions: defaultActions(snapshot) });
  }
}

function defaultActions(s: {
  cold_leads_no_outreach: number;
  unread_inbound_messages: number;
  content_scheduled_next_7d: number;
  voice_receptionist_configured: boolean;
}): ActionSuggestion[] {
  const out: ActionSuggestion[] = [];

  if (s.unread_inbound_messages > 0) {
    out.push({
      title: `Reply to ${s.unread_inbound_messages} unread message${s.unread_inbound_messages === 1 ? "" : "s"}`,
      why: "Inbound replies waiting in your shared inbox.",
      cta_label: "Open inbox",
      cta_href: "/dashboard/conversations",
      urgency: "high",
      icon: "inbox",
    });
  }

  if (s.cold_leads_no_outreach > 0) {
    out.push({
      title: `Re-engage ${s.cold_leads_no_outreach} cold leads`,
      why: `${s.cold_leads_no_outreach} leads scraped 7+ days ago with no outreach yet.`,
      cta_label: "Start outreach",
      cta_href: "/dashboard/outreach-hub",
      urgency: "medium",
      icon: "leads",
    });
  }

  if (s.content_scheduled_next_7d < 5) {
    out.push({
      title: "Generate next week's content batch",
      why: `Only ${s.content_scheduled_next_7d} posts scheduled for next 7 days.`,
      cta_label: "Plan content",
      cta_href: "/dashboard/content-plan",
      urgency: "medium",
      icon: "content",
    });
  }

  if (!s.voice_receptionist_configured) {
    out.push({
      title: "Finish Voice Receptionist setup",
      why: "Inbound calls are routing to fallback — finish the 3-step setup.",
      cta_label: "Set up",
      cta_href: "/dashboard/voice-receptionist",
      urgency: "low",
      icon: "setup",
    });
  }

  // Fallback if everything is fine
  if (out.length === 0) {
    out.push({
      title: "Run a Lead Finder pass",
      why: "Pipeline is healthy — refill the top of funnel.",
      cta_label: "Find leads",
      cta_href: "/dashboard/scraper",
      urgency: "low",
      icon: "leads",
    });
  }

  return out.slice(0, 3);
}
