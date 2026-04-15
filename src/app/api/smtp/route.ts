import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/*
  smtp_config table schema:

  CREATE TABLE smtp_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 587,
    username TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    from_email TEXT NOT NULL,
    from_name TEXT NOT NULL DEFAULT '',
    use_tls BOOLEAN NOT NULL DEFAULT true,
    provider TEXT,
    verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id)
  );

  CREATE INDEX idx_smtp_config_user ON smtp_config(user_id);

  -- RLS policies
  ALTER TABLE smtp_config ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can read own smtp config"   ON smtp_config FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Users can insert own smtp config" ON smtp_config FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "Users can update own smtp config" ON smtp_config FOR UPDATE USING (auth.uid() = user_id);
  CREATE POLICY "Users can delete own smtp config" ON smtp_config FOR DELETE USING (auth.uid() = user_id);
*/

/** GET — fetch saved SMTP config for the current user (password masked). */
export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("smtp_config")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data) return NextResponse.json({ config: null });

  // Mask the password before returning
  const masked = {
    ...data,
    password_encrypted: data.password_encrypted
      ? "••••••••"
      : "",
  };

  return NextResponse.json({ config: masked });
}

/** POST — save or update the SMTP config for the current user. */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { host, port, username, password, from_email, from_name, use_tls, provider } = body;

  if (!host || !port || !username || !from_email) {
    return NextResponse.json(
      { error: "Missing required fields: host, port, username, from_email" },
      { status: 400 }
    );
  }

  // Check if config already exists
  const { data: existing } = await supabase
    .from("smtp_config")
    .select("id, password_encrypted")
    .eq("user_id", user.id)
    .maybeSingle();

  // If the password is the mask placeholder or empty, keep the old one
  const resolvedPassword =
    password && password !== "••••••••"
      ? password
      : existing?.password_encrypted ?? "";

  const row = {
    user_id: user.id,
    host,
    port: Number(port),
    username,
    password_encrypted: resolvedPassword,
    from_email,
    from_name: from_name || "",
    use_tls: use_tls ?? true,
    provider: provider || null,
    verified: false,
    updated_at: new Date().toISOString(),
  };

  let result;

  if (existing) {
    result = await supabase
      .from("smtp_config")
      .update(row)
      .eq("id", existing.id)
      .select()
      .single();
  } else {
    result = await supabase.from("smtp_config").insert(row).select().single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, config: result.data });
}
