import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

/**
 * GET /api/sections/[section] — Section hub data.
 *
 * Returns stats + recent activity + per-tool last-used timestamps for
 * the requested section ("sales" | "create" | "visual" | "automate").
 *
 * All counts are scoped to the effective agency owner (team_members
 * resolve to their parent agency). Missing columns/tables degrade
 * gracefully to `null` so the UI can render "—".
 */

type SectionKey = "sales" | "create" | "visual" | "automate";
const VALID: readonly SectionKey[] = ["sales", "create", "visual", "automate"] as const;

// Tool slug → list of action_type prefixes in trinity_log. Used for
// "last used per tool" + per-section activity feed.
const SECTION_TOOLS: Record<SectionKey, { slug: string; actions: string[] }[]> = {
  sales: [
    { slug: "outreach-hub", actions: ["outreach", "outreach_sent", "dm_sent"] },
    { slug: "scraper", actions: ["lead_gen", "leads_scraped"] },
    { slug: "eleven-agents", actions: ["ai_call", "lead_gen"] },
    { slug: "voice-receptionist", actions: ["voice_call"] },
    { slug: "dm-controller", actions: ["dm_sent"] },
    { slug: "conversations", actions: ["conversation"] },
    { slug: "outreach-logs", actions: ["outreach"] },
    { slug: "sequences", actions: ["sequence_sent", "sequence"] },
    { slug: "crm", actions: ["ai_crm_insights", "crm"] },
    { slug: "deals", actions: ["deal_won", "deal"] },
    { slug: "proposals", actions: ["proposal_sent", "proposal"] },
    { slug: "forecast", actions: ["forecast"] },
    { slug: "commission-tracker", actions: ["commission"] },
    { slug: "ads-manager", actions: ["ads_launched", "ad_campaign"] },
    { slug: "scheduling", actions: ["meeting_booked", "scheduling"] },
  ],
  create: [
    { slug: "copywriter", actions: ["ai_copywriter", "copy_generated"] },
    { slug: "script-lab", actions: ["script_generated"] },
    { slug: "email-composer", actions: ["email_composed", "email_generated"] },
    { slug: "carousel-generator", actions: ["carousel_generated"] },
    { slug: "newsletter", actions: ["newsletter_sent", "newsletter"] },
    { slug: "content-plan", actions: ["content_plan", "content_suggestion"] },
    { slug: "content-library", actions: ["content_saved"] },
    { slug: "community", actions: ["community"] },
  ],
  visual: [
    { slug: "thumbnail-generator", actions: ["thumbnail_generated"] },
    { slug: "video-editor", actions: ["video_edited", "video"] },
    { slug: "ai-video", actions: ["ai_video", "video_generated"] },
    { slug: "ai-studio", actions: ["ai_studio", "image_generated"] },
    { slug: "design", actions: ["design_generated", "design"] },
  ],
  automate: [
    { slug: "workflows", actions: ["workflow", "automation"] },
    { slug: "workflow-builder", actions: ["workflow_built"] },
    { slug: "sequences", actions: ["sequence"] },
    { slug: "integrations", actions: ["integration"] },
    { slug: "webhooks", actions: ["webhook"] },
  ],
};

function collectActions(section: SectionKey): string[] {
  const set = new Set<string>();
  SECTION_TOOLS[section].forEach((t) => t.actions.forEach((a) => set.add(a)));
  return Array.from(set);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { section: string } },
) {
  const section = params.section as SectionKey;
  if (!VALID.includes(section)) {
    return NextResponse.json({ error: "Unknown section" }, { status: 404 });
  }

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const service = createServiceClient();

  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  /* ── Per-tool last-used timestamps (best-effort) ─────────────── */
  const lastUsed: Record<string, string | null> = {};
  try {
    // Pull a window of recent trinity_log rows for this owner and classify
    // locally — one round-trip is cheaper than N per-tool queries.
    const actionList = collectActions(section);
    const { data: recent } = await service
      .from("trinity_log")
      .select("action_type, created_at")
      .eq("user_id", ownerId)
      .in("action_type", actionList.length > 0 ? actionList : ["__none__"])
      .order("created_at", { ascending: false })
      .limit(500);
    if (recent) {
      SECTION_TOOLS[section].forEach((t) => {
        const hit = recent.find((r) =>
          t.actions.includes((r.action_type as string) || ""),
        );
        lastUsed[t.slug] = hit ? (hit.created_at as string) : null;
      });
    }
  } catch {
    SECTION_TOOLS[section].forEach((t) => (lastUsed[t.slug] = null));
  }

  /* ── Recent activity feed (latest 10 across all tools in section) ─ */
  let activity: Array<{
    id: string;
    description: string | null;
    action_type: string;
    created_at: string;
  }> = [];
  try {
    const actionList = collectActions(section);
    const { data: rows } = await service
      .from("trinity_log")
      .select("id, description, action_type, created_at")
      .eq("user_id", ownerId)
      .in("action_type", actionList.length > 0 ? actionList : ["__none__"])
      .order("created_at", { ascending: false })
      .limit(10);
    if (rows) {
      activity = rows.map((r) => ({
        id: String(r.id),
        description: r.description as string | null,
        action_type: r.action_type as string,
        created_at: r.created_at as string,
      }));
    }
  } catch {
    activity = [];
  }

  /* ── Stats per section ──────────────────────────────────────── */
  const stats: Record<string, number | string | null> = {};

  try {
    if (section === "sales") {
      // Leads count
      const { count: leads } = await service
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("user_id", ownerId);
      stats.leads = leads ?? 0;

      // Outreach sent this week — scope by owned leads/clients
      const [{ data: ownedLeads }, { data: ownedClients }] = await Promise.all([
        service.from("leads").select("id").eq("user_id", ownerId),
        service.from("clients").select("id").eq("profile_id", ownerId),
      ]);
      const leadIds = (ownedLeads || []).map((l) => l.id as string);
      const clientIds = (ownedClients || []).map((c) => c.id as string);
      const filters: string[] = [];
      if (leadIds.length > 0) filters.push(`lead_id.in.(${leadIds.join(",")})`);
      if (clientIds.length > 0) filters.push(`client_id.in.(${clientIds.join(",")})`);
      const or = filters.length > 0 ? filters.join(",") : "id.eq.00000000-0000-0000-0000-000000000000";
      const { count: outreach } = await service
        .from("outreach_log")
        .select("*", { count: "exact", head: true })
        .or(or)
        .gte("sent_at", weekAgo);
      stats.outreach_week = outreach ?? 0;

      // Active deals (status != 'won' and != 'lost')
      const { count: activeDeals } = await service
        .from("deals")
        .select("*", { count: "exact", head: true })
        .eq("user_id", ownerId)
        .not("status", "in", "(won,lost)");
      stats.active_deals = activeDeals ?? 0;

      // MRR
      const { data: mrrClients } = await service
        .from("clients")
        .select("mrr")
        .eq("profile_id", ownerId)
        .eq("is_active", true);
      const mrr = (mrrClients || []).reduce((a, c) => a + (Number(c.mrr) || 0), 0);
      stats.mrr = mrr;
    }

    if (section === "create") {
      const { count: gens } = await service
        .from("generations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", ownerId)
        .gte("created_at", monthAgo);
      stats.generations_month = gens ?? 0;

      const { count: scripts } = await service
        .from("trinity_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", ownerId)
        .eq("action_type", "script_generated");
      stats.scripts = scripts ?? 0;

      const { count: emails } = await service
        .from("trinity_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", ownerId)
        .in("action_type", ["email_composed", "email_generated"]);
      stats.emails = emails ?? 0;

      // Posts scheduled — look for content_plan or social post generations
      const { count: posts } = await service
        .from("generations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", ownerId)
        .eq("category", "social_post");
      stats.posts = posts ?? 0;
    }

    if (section === "visual") {
      const { count: thumbs } = await service
        .from("trinity_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", ownerId)
        .eq("action_type", "thumbnail_generated");
      stats.thumbnails = thumbs ?? 0;

      const { count: videos } = await service
        .from("generations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", ownerId)
        .eq("category", "video");
      stats.videos = videos ?? 0;

      const { count: images } = await service
        .from("generations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", ownerId)
        .in("category", ["thumbnail", "image"]);
      stats.images = images ?? 0;

      // Brand assets — try brand_kit table; fall back to null
      try {
        const { count: assets } = await service
          .from("brand_assets")
          .select("*", { count: "exact", head: true })
          .eq("user_id", ownerId);
        stats.brand_assets = assets ?? 0;
      } catch {
        stats.brand_assets = null;
      }
    }

    if (section === "automate") {
      // Active workflows
      let activeWorkflows: number | null = null;
      try {
        const { count } = await service
          .from("workflows")
          .select("*", { count: "exact", head: true })
          .eq("user_id", ownerId)
          .eq("status", "active");
        activeWorkflows = count ?? 0;
      } catch {
        activeWorkflows = null;
      }
      stats.active_workflows = activeWorkflows;

      // Runs this week (workflow/automation trinity_log entries)
      const { count: runs } = await service
        .from("trinity_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", ownerId)
        .in("action_type", ["workflow", "automation"])
        .gte("created_at", weekAgo);
      stats.runs_week = runs ?? 0;

      // Agents deployed
      let agents: number | null = null;
      try {
        const { count } = await service
          .from("agents")
          .select("*", { count: "exact", head: true })
          .eq("user_id", ownerId);
        agents = count ?? 0;
      } catch {
        agents = null;
      }
      stats.agents = agents;

      // Integrations connected
      let integrations: number | null = null;
      try {
        const { count } = await service
          .from("integrations")
          .select("*", { count: "exact", head: true })
          .eq("user_id", ownerId)
          .eq("connected", true);
        integrations = count ?? 0;
      } catch {
        integrations = null;
      }
      stats.integrations = integrations;
    }
  } catch (err) {
    // Swallow — the page will show "—" for any missing numeric stat.
    console.warn("[sections] Stats fetch partial failure:", err);
  }

  // Reference today so unused-var lint doesn't fire if a branch skips it.
  void today;

  return NextResponse.json({ section, stats, lastUsed, activity });
}
