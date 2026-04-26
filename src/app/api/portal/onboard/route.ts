/**
 * Portal Self-Onboarding
 *
 * POST /api/portal/onboard
 *   Persists the data a brand-new client collects via the 5-step wizard at
 *   /dashboard/portal/setup. The wizard previously dropped its state on
 *   submit (toast → router.push) — this endpoint closes that hole so
 *   Trinity can actually read the client's brand context.
 *
 * Access: caller must be authenticated and have a clients row whose
 *   profile_id matches the auth user. We update that single row's
 *   metadata jsonb (target_audience, brand_voice, description, goals,
 *   competitors, connected_platforms) and stash a flag so the agency
 *   owner can see the client finished setup.
 *
 * If no clients row is linked yet (rare — should be created at invite
 *   time), we still record the data on profiles.metadata so it isn't
 *   lost. The account manager can wire it up later.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

interface OnboardPayload {
  description?: string;
  goals?: string;
  target_audience?: string;
  competitors?: string;
  brand_voice?: string;
  connected_platforms?: string[];
}

const ALLOWED_PLATFORMS = new Set([
  "instagram", "facebook", "tiktok", "youtube", "linkedin", "twitter",
]);

const MAX_TEXT_LEN = 2000;

function sanitizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_TEXT_LEN);
}

function sanitizePlatforms(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p): p is string => typeof p === "string")
    .filter(p => ALLOWED_PLATFORMS.has(p))
    .slice(0, ALLOWED_PLATFORMS.size);
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: OnboardPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const description = sanitizeText(body.description);
  if (!description) {
    return NextResponse.json(
      { error: "description is required" },
      { status: 400 },
    );
  }

  const onboardingData = {
    description,
    goals: sanitizeText(body.goals),
    target_audience: sanitizeText(body.target_audience),
    competitors: sanitizeText(body.competitors),
    brand_voice: sanitizeText(body.brand_voice),
    connected_platforms: sanitizePlatforms(body.connected_platforms),
    completed_at: new Date().toISOString(),
  };

  // Use service client so we can read+merge metadata jsonb without
  // tripping over per-column RLS. Authentication already verified above.
  const service = createServiceClient();

  // Find the client record this portal user owns (clients.profile_id = user.id).
  const { data: client } = await service
    .from("clients")
    .select("id, metadata")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (client?.id) {
    const existingMetadata = (client.metadata as Record<string, unknown>) || {};
    // Nest under `onboarding` so the rest of the codebase
    // (e.g. /api/content/auto-package) can read it via the existing
    // `metadata.onboarding` convention without further changes.
    const { error: updateErr } = await service
      .from("clients")
      .update({
        metadata: {
          ...existingMetadata,
          onboarding: onboardingData,
          // Also flatten the brand fields onto metadata so older readers
          // that look at metadata.target_audience / metadata.brand_voice
          // (see ads/autopilot, ads/cron) keep working.
          target_audience: onboardingData.target_audience,
          brand_voice: onboardingData.brand_voice,
        },
      })
      .eq("id", client.id);

    if (updateErr) {
      console.error("[portal/onboard] Failed to update client metadata:", updateErr);
      return NextResponse.json(
        { error: "Failed to save onboarding data" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, target: "client", client_id: client.id });
  }

  // Fallback: no clients row yet — stash on profile metadata so the data
  // survives until the account manager links the client record.
  const { data: profile } = await service
    .from("profiles")
    .select("metadata")
    .eq("id", user.id)
    .maybeSingle();

  const existingProfileMeta = (profile?.metadata as Record<string, unknown>) || {};
  const { error: profileErr } = await service
    .from("profiles")
    .update({
      metadata: { ...existingProfileMeta, onboarding: onboardingData },
    })
    .eq("id", user.id);

  if (profileErr) {
    console.error("[portal/onboard] Failed to update profile metadata:", profileErr);
    return NextResponse.json(
      { error: "Failed to save onboarding data" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, target: "profile" });
}
