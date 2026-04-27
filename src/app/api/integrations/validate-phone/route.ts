/**
 * POST /api/integrations/validate-phone
 *
 * Body: { phones: string[] }
 *
 * Validates a list of phone numbers via AbstractAPI Phone (primary) /
 * NumVerify (fallback). Caches results in `contact_validations` with a
 * 14-day TTL. Numbers are normalised to E.164 before lookup.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import {
  validatePhone,
  toE164,
  type PhoneValidationResult,
} from "@/lib/integrations/phone-validator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CACHE_DAYS = 14;

interface RequestBody {
  phones?: unknown;
}

interface CachedRow {
  target: string;
  status: PhoneValidationResult["status"];
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
  if (!isStringArray(body.phones) || body.phones.length === 0) {
    return NextResponse.json(
      { error: "phones must be a non-empty string array" },
      { status: 400 },
    );
  }

  const requested = Array.from(
    new Set(
      body.phones
        .map((p) => toE164(p))
        .filter((p): p is string => Boolean(p)),
    ),
  ).slice(0, 100);

  if (requested.length === 0) {
    return NextResponse.json({ results: {}, cached: 0, validated: 0 });
  }

  const cutoffIso = new Date(
    Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: cachedRows } = await supabase
    .from("contact_validations")
    .select("target, status, raw_response, provider, validated_at")
    .eq("agency_owner_id", ownerId)
    .eq("channel", "phone")
    .in("target", requested)
    .gte("validated_at", cutoffIso);

  const cachedMap = new Map<string, CachedRow>();
  for (const row of (cachedRows ?? []) as CachedRow[]) {
    cachedMap.set(row.target, row);
  }

  const toValidate = requested.filter((p) => !cachedMap.has(p));

  const fresh = new Map<string, PhoneValidationResult>();
  for (const phone of toValidate) {
    const r = await validatePhone(phone);
    fresh.set(phone, r);
  }

  if (fresh.size > 0) {
    const upserts = Array.from(fresh.values()).map((r) => ({
      agency_owner_id: ownerId,
      channel: "phone",
      target: r.phone,
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
        "[validate-phone] upsert failed",
        upsertErr.message ?? String(upsertErr),
      );
    }
  }

  const results: Record<string, PhoneValidationResult> = {};
  for (const phone of requested) {
    const cached = cachedMap.get(phone);
    if (cached) {
      const raw = cached.raw_response as PhoneValidationResult | null;
      results[phone] = {
        phone,
        is_valid: cached.status === "valid",
        country_code: raw?.country_code ?? null,
        country_name: raw?.country_name ?? null,
        line_type: raw?.line_type ?? "unknown",
        carrier: raw?.carrier ?? null,
        provider:
          (cached.provider as PhoneValidationResult["provider"]) ?? "skipped",
        status: cached.status,
      };
    } else {
      const r = fresh.get(phone);
      if (r) results[phone] = r;
    }
  }

  return NextResponse.json({
    results,
    cached: cachedMap.size,
    validated: fresh.size,
  });
}
