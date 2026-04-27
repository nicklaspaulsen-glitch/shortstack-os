/**
 * Internal API key management — dashboard CRUD.
 *
 * Auth: Supabase session (cookies). The Public API surface lives at /api/v1/*
 * and uses Bearer tokens; this route is for the dashboard to mint and list
 * those tokens.
 *
 *   GET  /api/api-keys          - list keys (no plaintext)
 *   POST /api/api-keys          - create new key (returns plaintext ONCE)
 *
 *   See /api/api-keys/[id]/route.ts for revoke/delete.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/api/auth";

const VALID_SCOPES = new Set(["read", "write", "admin"]);

interface CreateKeyBody {
  name?: unknown;
  scopes?: unknown;
  rate_limit_per_minute?: unknown;
  expires_at?: unknown;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("api_keys")
    .select(
      "id, name, key_prefix, scopes, rate_limit_per_minute, last_used_at, expires_at, revoked_at, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: CreateKeyBody;
  try {
    body = (await request.json()) as CreateKeyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = asString(body.name);
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const rawScopes = Array.isArray(body.scopes) ? body.scopes : ["read"];
  const scopes = rawScopes.filter(
    (s): s is string => typeof s === "string" && VALID_SCOPES.has(s),
  );
  if (scopes.length === 0) {
    return NextResponse.json(
      { error: "scopes must include at least one of: read, write, admin" },
      { status: 400 },
    );
  }

  const rateLimitRaw = body.rate_limit_per_minute;
  const rateLimit =
    typeof rateLimitRaw === "number" && rateLimitRaw > 0 && rateLimitRaw <= 600
      ? Math.floor(rateLimitRaw)
      : 60;

  const expiresAt = asString(body.expires_at);
  // Validate ISO timestamp if provided
  if (expiresAt && Number.isNaN(Date.parse(expiresAt))) {
    return NextResponse.json(
      { error: "expires_at must be a valid ISO timestamp" },
      { status: 400 },
    );
  }

  const { plaintext, hash, prefix } = generateApiKey();

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: user.id,
      key_hash: hash,
      key_prefix: prefix,
      name,
      scopes,
      rate_limit_per_minute: rateLimit,
      expires_at: expiresAt,
    })
    .select(
      "id, name, key_prefix, scopes, rate_limit_per_minute, expires_at, created_at",
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    {
      key: data,
      // Only returned at creation time — never again.
      plaintext_key: plaintext,
      warning: "Store this key now. We never show it again.",
    },
    { status: 201 },
  );
}
