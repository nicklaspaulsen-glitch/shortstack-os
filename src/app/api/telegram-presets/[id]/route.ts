import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

const UPDATABLE_FIELDS = [
  "category",
  "name",
  "body",
  "variables",
  "active",
] as const;

// GET /api/telegram-presets/[id] — fetch a single preset
// Readable if it's a global default or the caller owns it.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = createServerSupabase();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = (await getEffectiveOwnerId(auth, user.id)) ?? user.id;

  const service = createServiceClient();
  const { data, error } = await service
    .from("telegram_presets")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    console.error("[telegram-presets/:id] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch preset" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Readable by owner or for global defaults (user_id null).
  if (data.user_id !== null && data.user_id !== ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ preset: data });
}

// PATCH /api/telegram-presets/[id] — update fields on a user-owned preset.
// Global defaults (user_id IS NULL) are read-only; users must "fork" via POST.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of UPDATABLE_FIELDS) {
    if (field in body) {
      patch[field] = body[field];
    }
  }

  const service = createServiceClient();
  const { data: existing } = await service
    .from("telegram_presets")
    .select("user_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.user_id === null) {
    return NextResponse.json(
      { error: "Global defaults are read-only. Duplicate it first to edit." },
      { status: 403 }
    );
  }
  if (existing.user_id !== ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await service
    .from("telegram_presets")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    console.error("[telegram-presets/:id] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update preset" }, { status: 500 });
  }

  return NextResponse.json({ preset: data });
}

// DELETE /api/telegram-presets/[id] — delete a user-owned preset.
// Global defaults are protected (we return 403 instead of silently failing).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = createServerSupabase();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = (await getEffectiveOwnerId(auth, user.id)) ?? user.id;

  const service = createServiceClient();
  const { data: existing } = await service
    .from("telegram_presets")
    .select("user_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.user_id === null) {
    return NextResponse.json(
      { error: "Global defaults cannot be deleted." },
      { status: 403 }
    );
  }
  if (existing.user_id !== ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await service
    .from("telegram_presets")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("[telegram-presets/:id] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete preset" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
