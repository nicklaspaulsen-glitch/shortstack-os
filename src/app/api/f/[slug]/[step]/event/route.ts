/**
 * Public event tracking endpoint for the funnel surface.
 *
 * Anonymous (no auth) — protected by row-level INSERT policy on
 * `funnel_analytics` (`funnel_analytics_public_insert`). The endpoint
 * validates that the funnel + step slug pair resolves to a published
 * funnel, then writes a single analytics row.
 *
 * Allowed event types: view, click, submit, purchase.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: { slug: string; step: string } };

const ALLOWED_EVENTS = new Set(["view", "click", "submit", "purchase"]);

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createServiceClient();

  let body: { event_type?: string; visitor_id?: string; metadata?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = (body.event_type ?? "").toString().trim();
  if (!ALLOWED_EVENTS.has(eventType)) {
    return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
  }

  // Resolve funnel + step ids (and confirm funnel is published)
  const { data: funnel } = await supabase
    .from("funnels")
    .select("id, status")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!funnel || (funnel as { status: string }).status !== "published") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const f = funnel as { id: string; status: string };

  const { data: step } = await supabase
    .from("funnel_steps")
    .select("id")
    .eq("funnel_id", f.id)
    .eq("slug", params.step)
    .maybeSingle();

  if (!step) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const s = step as { id: string };

  const visitorId = (body.visitor_id ?? "").toString().slice(0, 64) || null;
  const metadata: Record<string, unknown> = {};
  if (body.metadata && typeof body.metadata === "object") {
    for (const [k, v] of Object.entries(body.metadata)) {
      if (v == null || ["string", "number", "boolean"].includes(typeof v)) {
        metadata[k] = v;
      }
    }
  }
  metadata.user_agent = req.headers.get("user-agent")?.slice(0, 200) ?? null;
  metadata.referer = req.headers.get("referer")?.slice(0, 500) ?? null;

  const { error } = await supabase
    .from("funnel_analytics")
    .insert({
      funnel_id: f.id,
      step_id: s.id,
      visitor_id: visitorId,
      event_type: eventType,
      metadata,
    });

  if (error) {
    console.error("[funnel-event] insert failed", { error: error.message, slug: params.slug });
    return NextResponse.json({ error: "Tracking failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
