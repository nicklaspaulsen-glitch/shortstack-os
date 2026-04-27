/**
 * POST /api/integrations/validate-email
 *
 * Body: { emails: string[] }
 *
 * Validates a list of email addresses through AbstractAPI (primary) /
 * Hunter (fallback). Caches results in `contact_validations` so the same
 * address isn't re-validated within 14 days. Returns a record map keyed by
 * the input email.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import {
  validateEmail,
  type EmailValidationResult,
} from "@/lib/integrations/email-validator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CACHE_DAYS = 14;

interface RequestBody {
  emails?: unknown;
}

interface CachedRow {
  target: string;
  status: EmailValidationResult["status"];
  raw_response: unknown;
  provider: string;
  validated_at: string;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isStringArray(body.emails) || body.emails.length === 0) {
    return NextResponse.json(
      { error: "emails must be a non-empty string array" },
      { status: 400 },
    );
  }

  // Cap to 100 per request to keep the route bounded.
  const requested = Array.from(
    new Set(
      body.emails
        .map((e) => (e || "").trim().toLowerCase())
        .filter((e): e is string => Boolean(e) && e.includes("@")),
    ),
  ).slice(0, 100);

  if (requested.length === 0) {
    return NextResponse.json({ results: {}, cached: 0, validated: 0 });
  }

  // 1. Look up cached rows < 14 days old.
  const cutoffIso = new Date(
    Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: cachedRows } = await supabase
    .from("contact_validations")
    .select("target, status, raw_response, provider, validated_at")
    .eq("agency_owner_id", ownerId)
    .eq("channel", "email")
    .in("target", requested)
    .gte("validated_at", cutoffIso);

  const cachedMap = new Map<string, CachedRow>();
  for (const row of (cachedRows ?? []) as CachedRow[]) {
    cachedMap.set(row.target, row);
  }

  const toValidate = requested.filter((e) => !cachedMap.has(e));

  // 2. Validate the misses.
  const fresh = new Map<string, EmailValidationResult>();
  for (const email of toValidate) {
    const r = await validateEmail(email);
    fresh.set(email, r);
  }

  // 3. Persist fresh results — upsert so we refresh validated_at.
  if (fresh.size > 0) {
    const upserts = Array.from(fresh.values()).map((r) => ({
      agency_owner_id: ownerId,
      channel: "email",
      target: r.email,
      status: r.status,
      raw_response: r as unknown as Record<string, unknown>,
      provider: r.provider,
      validated_at: new Date().toISOString(),
    }));
    const { error: upsertErr } = await supabase
      .from("contact_validations")
      .upsert(upserts, { onConflict: "agency_owner_id,channel,target" });
    if (upsertErr) {
      console.error(
        "[validate-email] upsert failed",
        upsertErr.message ?? String(upsertErr),
      );
      // Non-fatal: still return live results to caller.
    }
  }

  // 4. Build the response: cached rows shaped like fresh results.
  const results: Record<string, EmailValidationResult> = {};
  for (const email of requested) {
    const cached = cachedMap.get(email);
    if (cached) {
      const raw = cached.raw_response as EmailValidationResult | null;
      results[email] = {
        email,
        is_valid: cached.status === "valid",
        is_disposable: raw?.is_disposable ?? false,
        is_role_email: raw?.is_role_email ?? false,
        is_free_email: raw?.is_free_email ?? false,
        deliverability: raw?.deliverability ?? "unknown",
        raw_score: raw?.raw_score ?? 0,
        provider:
          (cached.provider as EmailValidationResult["provider"]) ?? "skipped",
        status: cached.status,
      };
    } else {
      const r = fresh.get(email);
      if (r) results[email] = r;
    }
  }

  return NextResponse.json({
    results,
    cached: cachedMap.size,
    validated: fresh.size,
  });
}
