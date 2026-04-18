import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { ALL_SIDEBAR_ITEMS } from "@/lib/user-types";

export const maxDuration = 10;

/** Shape of saved preferences. All fields optional — empty = show all defaults. */
interface SidebarPreferences {
  enabled_items: string[];
  custom_groups: CustomGroup[];
  order_overrides: Record<string, number>;
  business_type: string | null;
}

interface CustomGroup {
  id: string;
  label: string;
  items: string[];
}

const EMPTY: SidebarPreferences = {
  enabled_items: [],
  custom_groups: [],
  order_overrides: {},
  business_type: null,
};

/**
 * GET /api/user/sidebar-preferences
 * Returns the current user's saved sidebar preferences (or empty defaults).
 */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("user_sidebar_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    // Table may not exist yet (pre-migration) — return empty defaults gracefully.
    console.error("[sidebar-preferences] GET error:", error);
    return NextResponse.json({ preferences: EMPTY });
  }

  return NextResponse.json({
    preferences: data
      ? {
          enabled_items: Array.isArray(data.enabled_items) ? data.enabled_items : [],
          custom_groups: Array.isArray(data.custom_groups) ? data.custom_groups : [],
          order_overrides: data.order_overrides && typeof data.order_overrides === "object" ? data.order_overrides : {},
          business_type: data.business_type || null,
        }
      : EMPTY,
  });
}

/**
 * POST /api/user/sidebar-preferences
 * Upserts the user's sidebar preferences.
 * Body: { enabled_items?, custom_groups?, order_overrides?, business_type? }
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Partial<SidebarPreferences>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate enabled_items — reject anything not in the canonical list.
  const enabled_items = Array.isArray(body.enabled_items)
    ? body.enabled_items
        .filter((h): h is string => typeof h === "string")
        .filter((h) => ALL_SIDEBAR_ITEMS.includes(h))
    : undefined;

  const custom_groups = Array.isArray(body.custom_groups)
    ? body.custom_groups.filter(validCustomGroup)
    : undefined;

  const order_overrides =
    body.order_overrides && typeof body.order_overrides === "object"
      ? sanitizeOrderOverrides(body.order_overrides)
      : undefined;

  const business_type = typeof body.business_type === "string" ? body.business_type : undefined;

  const patch: Record<string, unknown> = { user_id: user.id };
  if (enabled_items !== undefined) patch.enabled_items = enabled_items;
  if (custom_groups !== undefined) patch.custom_groups = custom_groups;
  if (order_overrides !== undefined) patch.order_overrides = order_overrides;
  if (business_type !== undefined) patch.business_type = business_type;

  const service = createServiceClient();
  const { error } = await service
    .from("user_sidebar_preferences")
    .upsert(patch, { onConflict: "user_id" });

  if (error) {
    console.error("[sidebar-preferences] POST error:", error);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/* ─── Validators ───────────────────────────────────────────────────── */

function validCustomGroup(raw: unknown): raw is CustomGroup {
  if (!raw || typeof raw !== "object") return false;
  const g = raw as Record<string, unknown>;
  return (
    typeof g.id === "string" &&
    typeof g.label === "string" &&
    Array.isArray(g.items) &&
    g.items.every((i): i is string => typeof i === "string" && ALL_SIDEBAR_ITEMS.includes(i))
  );
}

function sanitizeOrderOverrides(input: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === "number" && Number.isFinite(v) && ALL_SIDEBAR_ITEMS.includes(k)) {
      out[k] = v;
    }
  }
  return out;
}
