import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Edge runtime: pure DB-write route, no Node-only imports.
export const runtime = "edge";
export const maxDuration = 10;

const VALID_USER_TYPES = new Set([
  "agency",
  "content_creator",
  "real_estate",
  "coach",
  "ecommerce",
  "saas",
  "service_provider",
  "other",
]);

/**
 * POST /api/user/onboarding
 * Saves user_type and onboarding_preferences on the profile.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    user_type?: unknown;
    onboarding_preferences?: unknown;
    onboarding_personalization?: unknown;
    onboarding_ai_answers?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.user_type === "string" && VALID_USER_TYPES.has(body.user_type)) {
    updates.user_type = body.user_type;
  }
  if (body.onboarding_preferences && typeof body.onboarding_preferences === "object") {
    updates.onboarding_preferences = body.onboarding_preferences;
  }
  if (body.onboarding_personalization && typeof body.onboarding_personalization === "object") {
    updates.onboarding_personalization = body.onboarding_personalization;
  }
  if (body.onboarding_ai_answers && typeof body.onboarding_ai_answers === "object") {
    updates.onboarding_ai_answers = body.onboarding_ai_answers;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.from("profiles").update(updates).eq("id", user.id);
  if (error) {
    console.error("[user/onboarding] update error:", error);
    return NextResponse.json({ error: "Failed to save onboarding" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/** GET /api/user/onboarding — returns current user_type + preferences */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data } = await service
    .from("profiles")
    .select("user_type, onboarding_preferences, onboarding_personalization, onboarding_ai_answers")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    user_type: data?.user_type || "agency",
    onboarding_preferences: data?.onboarding_preferences || {},
    onboarding_personalization: data?.onboarding_personalization || {},
    onboarding_ai_answers: data?.onboarding_ai_answers || {},
  });
}
