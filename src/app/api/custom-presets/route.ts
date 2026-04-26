import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/*
 * codex round-1: hand-rolled validators — Zod is not used in API routes in this
 * codebase (confirmed by grep). Mirrors the same limits enforced client-side in
 * preset-edit-example-panel.tsx for defense-in-depth.
 */

const VALID_CATEGORIES = ["video", "thumbnail", "telegram"] as const;
type ValidCategory = (typeof VALID_CATEGORIES)[number];
const BASE_PRESET_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const MAX_CONFIG_BYTES = 16 * 1024; // 16 KB
const MAX_CONFIG_DEPTH = 5;

function isValidCategory(v: unknown): v is ValidCategory {
  return VALID_CATEGORIES.includes(v as ValidCategory);
}

function configDepth(val: unknown, depth = 0): number {
  if (depth > MAX_CONFIG_DEPTH) return depth;
  if (typeof val !== "object" || val === null || Array.isArray(val)) return depth;
  const children = Object.values(val as Record<string, unknown>);
  if (children.length === 0) return depth;
  return Math.max(...children.map((c) => configDepth(c, depth + 1)));
}

function isPlainObjectDeep(val: unknown): boolean {
  if (typeof val !== "object" || val === null || Array.isArray(val)) return false;
  for (const v of Object.values(val as Record<string, unknown>)) {
    if (v instanceof Date || Buffer.isBuffer(v)) return false;
    if (typeof v === "object" && v !== null && !Array.isArray(v) && !isPlainObjectDeep(v)) return false;
  }
  return true;
}

interface CustomPresetInsert {
  base_preset_id: string;
  category: ValidCategory;
  name: string;
  config: Record<string, unknown>;
}

/**
 * GET /api/custom-presets
 * Returns all custom presets belonging to the authenticated user.
 *
 * POST /api/custom-presets
 * Body: { base_preset_id, category, name, config }
 * Creates a new custom preset scoped to the authenticated user.
 */

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("custom_presets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ presets: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized — please sign in" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("base_preset_id" in body) ||
    !("category" in body) ||
    !("name" in body) ||
    !("config" in body)
  ) {
    return NextResponse.json(
      { error: "Missing required fields: base_preset_id, category, name, config" },
      { status: 400 }
    );
  }

  const raw = body as Record<string, unknown>;

  // base_preset_id — string, 1-128 chars, alphanumeric + hyphen + underscore only
  if (
    typeof raw.base_preset_id !== "string" ||
    raw.base_preset_id.trim().length < 1 ||
    raw.base_preset_id.trim().length > 128 ||
    !BASE_PRESET_ID_REGEX.test(raw.base_preset_id.trim())
  ) {
    return NextResponse.json(
      { error: "base_preset_id must be 1-128 chars, alphanumeric, hyphens, and underscores only" },
      { status: 400 }
    );
  }

  // category — exact enum match
  if (!isValidCategory(raw.category)) {
    return NextResponse.json(
      { error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  // name — string, 1-200 chars
  if (
    typeof raw.name !== "string" ||
    raw.name.trim().length < 1 ||
    raw.name.trim().length > 200
  ) {
    return NextResponse.json(
      { error: "name must be a non-empty string (max 200 chars)" },
      { status: 400 }
    );
  }

  // config — plain JSON object, not array/primitive, max 16 KB serialised, max depth 5
  if (
    typeof raw.config !== "object" ||
    raw.config === null ||
    Array.isArray(raw.config)
  ) {
    return NextResponse.json({ error: "config must be a plain JSON object" }, { status: 400 });
  }
  if (!isPlainObjectDeep(raw.config)) {
    return NextResponse.json(
      { error: "config contains unsupported value types (Date, Buffer, etc.)" },
      { status: 400 }
    );
  }
  const configSerialized = JSON.stringify(raw.config);
  if (configSerialized.length > MAX_CONFIG_BYTES) {
    return NextResponse.json(
      { error: `config exceeds 16 KB limit (got ${Math.round(configSerialized.length / 1024)}KB)` },
      { status: 400 }
    );
  }
  if (configDepth(raw.config) > MAX_CONFIG_DEPTH) {
    return NextResponse.json(
      { error: `config nesting depth exceeds maximum of ${MAX_CONFIG_DEPTH}` },
      { status: 400 }
    );
  }

  const insert: CustomPresetInsert = {
    base_preset_id: (raw.base_preset_id as string).trim(),
    category: raw.category as ValidCategory,
    name: (raw.name as string).trim(),
    config: raw.config as Record<string, unknown>,
  };

  const { data, error } = await supabase
    .from("custom_presets")
    .insert({
      user_id: user.id,
      base_preset_id: insert.base_preset_id,
      category: insert.category,
      name: insert.name,
      config: insert.config,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preset: data }, { status: 201 });
}
