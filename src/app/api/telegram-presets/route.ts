import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

// Known categories the seed data uses. We don't lock inserts to this list so
// users can experiment with their own — but the dashboard filter tabs surface
// these 14.
const KNOWN_CATEGORIES = [
  "onboarding",
  "nurture",
  "reactivation",
  "payment-reminder",
  "appointment-confirm",
  "appointment-reminder",
  "review-request",
  "thank-you",
  "upsell",
  "feedback-survey",
  "holiday-promo",
  "winback",
  "referral-ask",
  "support-followup",
];

// GET /api/telegram-presets
//   ?category=<slug>  — optional filter
//   ?scope=all|mine|global — default "all" (global defaults + caller's own)
//
// Returns rows the caller is allowed to read: global defaults (user_id IS NULL)
// plus their own. RLS also enforces this but we filter server-side for clarity
// and to keep category-count computation accurate.
export async function GET(request: NextRequest) {
  const auth = createServerSupabase();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = (await getEffectiveOwnerId(auth, user.id)) ?? user.id;

  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const scope = url.searchParams.get("scope") ?? "all";

  const service = createServiceClient();
  let q = service.from("telegram_presets").select("*");

  if (scope === "mine") {
    q = q.eq("user_id", ownerId);
  } else if (scope === "global") {
    q = q.is("user_id", null);
  } else {
    // Caller sees global defaults OR their own rows.
    q = q.or(`user_id.is.null,user_id.eq.${ownerId}`);
  }

  if (category) {
    q = q.eq("category", category);
  }

  q = q.order("category", { ascending: true }).order("name", { ascending: true });

  const { data, error } = await q;
  if (error) {
    console.error("[telegram-presets] GET error:", error);
    return NextResponse.json({ error: "Failed to list presets" }, { status: 500 });
  }

  return NextResponse.json({
    presets: data ?? [],
    categories: KNOWN_CATEGORIES,
  });
}

// POST /api/telegram-presets — create a user-owned preset
export async function POST(request: NextRequest) {
  const auth = createServerSupabase();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = (await getEffectiveOwnerId(auth, user.id)) ?? user.id;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const category = typeof body.category === "string" ? body.category.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const msgBody = typeof body.body === "string" ? body.body : "";
  const variables = Array.isArray(body.variables) ? body.variables : [];

  if (!category) {
    return NextResponse.json({ error: "Category is required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!msgBody || msgBody.length < 2) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("telegram_presets")
    .insert({
      user_id: ownerId,
      category,
      name,
      body: msgBody,
      variables,
      active: body.active === undefined ? true : Boolean(body.active),
    })
    .select("*")
    .single();

  if (error) {
    console.error("[telegram-presets] POST error:", error);
    return NextResponse.json({ error: "Failed to create preset" }, { status: 500 });
  }

  return NextResponse.json({ preset: data });
}
