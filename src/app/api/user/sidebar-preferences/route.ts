import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { ALL_SIDEBAR_ITEMS } from "@/lib/user-types";

// Edge runtime: pure DB read/upsert route, no Node-only imports.
export const runtime = "edge";
export const maxDuration = 10;

/** Shape of saved preferences. All fields optional — empty = show all defaults. */
interface SidebarPreferences {
  enabled_items: string[];
  custom_groups: CustomGroup[];
  order_overrides: Record<string, number>;
  business_type: string | null;
  pins: string[];
  renames: Record<string, string>;
  icon_overrides: Record<string, string>;
  sidebar_position: "left" | "right";
}

interface CustomSubGroup {
  id: string;
  name: string;
  items: string[];
}

interface CustomGroup {
  id: string;
  label?: string; // legacy
  name: string;
  icon: string;
  color: string;
  order: number;
  items: string[];
  subgroups: CustomSubGroup[];
}

const EMPTY: SidebarPreferences = {
  enabled_items: [],
  custom_groups: [],
  order_overrides: {},
  business_type: null,
  pins: [],
  renames: {},
  icon_overrides: {},
  sidebar_position: "left",
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

  // Pull extended fields from the order_overrides blob (schema-compatible storage)
  // so we don't need a schema change. We use the key `__ext__` to stash them.
  const oo = (data?.order_overrides && typeof data.order_overrides === "object") ? data.order_overrides : {};
  const extRaw = (oo as Record<string, unknown>).__ext__;
  const ext = extRaw && typeof extRaw === "object" ? extRaw as Record<string, unknown> : {};

  const prefs: SidebarPreferences = data
    ? {
        enabled_items: Array.isArray(data.enabled_items) ? data.enabled_items : [],
        custom_groups: Array.isArray(data.custom_groups) ? (data.custom_groups as CustomGroup[]) : [],
        order_overrides: stripExt(oo),
        business_type: data.business_type || null,
        pins: Array.isArray(ext.pins) ? (ext.pins as unknown[]).filter((x): x is string => typeof x === "string") : [],
        renames: ext.renames && typeof ext.renames === "object" ? (ext.renames as Record<string, string>) : {},
        icon_overrides: ext.icon_overrides && typeof ext.icon_overrides === "object" ? (ext.icon_overrides as Record<string, string>) : {},
        sidebar_position: ext.sidebar_position === "right" ? "right" : "left",
      }
    : EMPTY;

  return NextResponse.json({ preferences: prefs });
}

/**
 * POST /api/user/sidebar-preferences
 * Upserts the user's sidebar preferences.
 * Body: any subset of { enabled_items, custom_groups, order_overrides, business_type, pins, renames, icon_overrides, sidebar_position }
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
    ? body.custom_groups.filter(validCustomGroup).map(normalizeGroup)
    : undefined;

  const orderCore =
    body.order_overrides && typeof body.order_overrides === "object"
      ? sanitizeOrderOverrides(body.order_overrides)
      : undefined;

  const business_type = typeof body.business_type === "string" ? body.business_type : undefined;

  // Extended fields stashed into order_overrides.__ext__
  const extendedPatch: Record<string, unknown> = {};
  if (Array.isArray(body.pins)) {
    extendedPatch.pins = body.pins
      .filter((p): p is string => typeof p === "string")
      .filter((p) => ALL_SIDEBAR_ITEMS.includes(p));
  }
  if (body.renames && typeof body.renames === "object") {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.renames)) {
      if (typeof v === "string" && ALL_SIDEBAR_ITEMS.includes(k) && v.length <= 80) {
        out[k] = v;
      }
    }
    extendedPatch.renames = out;
  }
  if (body.icon_overrides && typeof body.icon_overrides === "object") {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.icon_overrides)) {
      if (typeof v === "string" && ALL_SIDEBAR_ITEMS.includes(k) && v.length <= 50) {
        out[k] = v;
      }
    }
    extendedPatch.icon_overrides = out;
  }
  if (body.sidebar_position === "left" || body.sidebar_position === "right") {
    extendedPatch.sidebar_position = body.sidebar_position;
  }

  // Fetch existing ext to merge
  const service = createServiceClient();
  let existingExt: Record<string, unknown> = {};
  let existingOrderCore: Record<string, number> = {};
  const { data: existing } = await service
    .from("user_sidebar_preferences")
    .select("order_overrides")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing?.order_overrides && typeof existing.order_overrides === "object") {
    const raw = existing.order_overrides as Record<string, unknown>;
    if (raw.__ext__ && typeof raw.__ext__ === "object") existingExt = raw.__ext__ as Record<string, unknown>;
    existingOrderCore = stripExt(raw);
  }

  const mergedExt = { ...existingExt, ...extendedPatch };
  const mergedOrderCore = orderCore !== undefined ? orderCore : existingOrderCore;
  const finalOrderOverrides: Record<string, unknown> = { ...mergedOrderCore, __ext__: mergedExt };

  const patch: Record<string, unknown> = { user_id: user.id };
  if (enabled_items !== undefined) patch.enabled_items = enabled_items;
  if (custom_groups !== undefined) patch.custom_groups = custom_groups;
  patch.order_overrides = finalOrderOverrides;
  if (business_type !== undefined) patch.business_type = business_type;

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
  const nameOk = typeof g.name === "string" || typeof g.label === "string";
  return (
    typeof g.id === "string" &&
    nameOk &&
    Array.isArray(g.items) &&
    (g.items as unknown[]).every((i): i is string => typeof i === "string" && ALL_SIDEBAR_ITEMS.includes(i))
  );
}

function normalizeGroup(raw: CustomGroup | Record<string, unknown>): CustomGroup {
  const g = raw as Record<string, unknown>;
  const name = (g.name as string) || (g.label as string) || "Group";
  const subs = Array.isArray(g.subgroups)
    ? (g.subgroups as Array<Record<string, unknown>>)
        .map((s): CustomSubGroup | null => {
          if (!s || typeof s !== "object") return null;
          const id = typeof s.id === "string" ? s.id : String(Math.random().toString(36).slice(2, 10));
          const sname = typeof s.name === "string" ? s.name : "Subgroup";
          const items = Array.isArray(s.items)
            ? (s.items as unknown[]).filter((x): x is string => typeof x === "string" && ALL_SIDEBAR_ITEMS.includes(x))
            : [];
          return { id, name: sname, items };
        })
        .filter((s): s is CustomSubGroup => !!s)
    : [];
  return {
    id: String(g.id),
    name: String(name),
    label: String(name),
    icon: typeof g.icon === "string" ? g.icon : "Layers",
    color: typeof g.color === "string" ? g.color : "#C9A84C",
    order: typeof g.order === "number" ? g.order : 0,
    items: (g.items as string[]).filter((i) => ALL_SIDEBAR_ITEMS.includes(i)),
    subgroups: subs,
  };
}

function sanitizeOrderOverrides(input: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === "__ext__") continue;
    if (typeof v === "number" && Number.isFinite(v) && ALL_SIDEBAR_ITEMS.includes(k)) {
      out[k] = v;
    }
  }
  return out;
}

function stripExt(oo: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(oo)) {
    if (k === "__ext__") continue;
    if (typeof v === "number") out[k] = v;
  }
  return out;
}
