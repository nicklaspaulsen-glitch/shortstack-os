import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/*
 * Table: white_label_config
 * ─────────────────────────
 * id              uuid        PRIMARY KEY DEFAULT gen_random_uuid()
 * user_id         uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE
 * company_name    text        NULL
 * logo_url        text        NULL
 * primary_color   text        NULL
 * accent_color    text        NULL
 * favicon_url     text        NULL
 * login_text      text        NULL
 * show_powered_by boolean     NOT NULL DEFAULT true
 * created_at      timestamptz NOT NULL DEFAULT now()
 * updated_at      timestamptz NOT NULL DEFAULT now()
 *
 * CREATE TABLE IF NOT EXISTS white_label_config (
 *   id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id         uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
 *   company_name    text,
 *   logo_url        text,
 *   primary_color   text,
 *   accent_color    text,
 *   favicon_url     text,
 *   login_text      text,
 *   show_powered_by boolean NOT NULL DEFAULT true,
 *   created_at      timestamptz NOT NULL DEFAULT now(),
 *   updated_at      timestamptz NOT NULL DEFAULT now()
 * );
 *
 * CREATE INDEX idx_white_label_user ON white_label_config(user_id);
 */

// GET — fetch white label config for the authenticated user
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: config } = await service
    .from("white_label_config")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // Return config or null (frontend falls back to defaults)
  return NextResponse.json({ config: config || null }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

// POST — save (upsert) white label config
export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (!user || authErr) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const allowedFields = [
      "company_name",
      "logo_url",
      "primary_color",
      "accent_color",
      "favicon_url",
      "login_text",
      "show_powered_by",
    ];

    const updates: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
    for (const key of allowedFields) {
      if (key in body) updates[key] = body[key];
    }

    const service = createServiceClient();
    const { data, error } = await service
      .from("white_label_config")
      .upsert(updates, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) {
      console.error("[white-label] upsert error:", error);
      return NextResponse.json({ error: "Failed to save white label config" }, { status: 500 });
    }

    return NextResponse.json({ config: data });
  } catch (err) {
    console.error("[white-label] POST error:", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
