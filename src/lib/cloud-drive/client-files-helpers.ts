/**
 * Shared helpers for the client-files surface:
 *   - agency-owner resolution (for quota lookup)
 *   - quota checks
 *   - signed OAuth `state` tokens (HMAC over client_id + nonce + ts)
 *   - storage path builder
 */
import { createHmac, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const CLIENT_FILES_BUCKET = "client-files";

/**
 * Given a client row, return the agency-owner's profile id — this is the
 * owner of the org_file_quotas row used for quota accounting.
 *
 * Schema convention:
 *   - clients.profile_id is the owner of the client row.
 *   - If that profile is itself a child (role=client or nested),
 *     profiles.parent_agency_id points at the agency owner. Fall back
 *     to profile_id when no parent is set.
 */
export async function resolveOrgOwnerForClient(
  service: SupabaseClient,
  clientId: string,
): Promise<string | null> {
  const { data: client } = await service
    .from("clients")
    .select("profile_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client?.profile_id) return null;
  const { data: profile } = await service
    .from("profiles")
    .select("parent_agency_id")
    .eq("id", client.profile_id)
    .maybeSingle();
  return profile?.parent_agency_id || client.profile_id;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: "over_quota";
  bytesUsed: number;
  bytesLimit: number; // 0 = unlimited
  orgId: string | null;
}

/**
 * Ensure `bytesUsed + incomingBytes <= bytesLimit`. A limit of 0 means
 * unlimited (enterprise). If no quota row exists yet we seed a starter one
 * with a 1 GiB default so accounting starts working immediately.
 */
export async function checkAndReserveQuota(
  service: SupabaseClient,
  clientId: string,
  incomingBytes: number,
): Promise<QuotaCheckResult> {
  const orgId = await resolveOrgOwnerForClient(service, clientId);
  if (!orgId) {
    return { allowed: false, reason: "over_quota", bytesUsed: 0, bytesLimit: 0, orgId: null };
  }

  let { data: quota } = await service
    .from("org_file_quotas")
    .select("org_id, plan_tier, bytes_used, bytes_limit")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!quota) {
    const { data: seeded } = await service
      .from("org_file_quotas")
      .insert({
        org_id: orgId,
        plan_tier: "starter",
        bytes_used: 0,
        bytes_limit: 1073741824,
      })
      .select("org_id, plan_tier, bytes_used, bytes_limit")
      .single();
    quota = seeded;
  }
  if (!quota) {
    return { allowed: false, reason: "over_quota", bytesUsed: 0, bytesLimit: 0, orgId };
  }

  const bytesUsed = Number(quota.bytes_used || 0);
  const bytesLimit = Number(quota.bytes_limit || 0);

  // 0 = unlimited sentinel
  if (bytesLimit === 0) {
    return { allowed: true, bytesUsed, bytesLimit: 0, orgId };
  }
  if (bytesUsed + incomingBytes > bytesLimit) {
    return { allowed: false, reason: "over_quota", bytesUsed, bytesLimit, orgId };
  }
  return { allowed: true, bytesUsed, bytesLimit, orgId };
}

/** Increment bytes_used after a successful upload. Best-effort — logs on failure. */
export async function incrementQuotaUsage(
  service: SupabaseClient,
  orgId: string,
  bytes: number,
): Promise<void> {
  if (!orgId || bytes <= 0) return;
  const { data: current } = await service
    .from("org_file_quotas")
    .select("bytes_used")
    .eq("org_id", orgId)
    .maybeSingle();
  const newUsage = Number(current?.bytes_used || 0) + bytes;
  const { error } = await service
    .from("org_file_quotas")
    .update({ bytes_used: newUsage, updated_at: new Date().toISOString() })
    .eq("org_id", orgId);
  if (error) {
    console.warn("[client-files] quota increment failed:", error.message);
  }
}

/** Storage key for an uploaded file. Path layout is enforced by RLS (first segment = client_id). */
export function buildClientFileStorageKey(clientId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${clientId}/${ym}/${now.getTime()}-${safe}`;
}

// ─── Signed OAuth state ─────────────────────────────────────────────

const STATE_TTL_MS = 15 * 60 * 1000;

function stateSecret(): string {
  return (
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXTAUTH_SECRET ||
    "dev-state-secret"
  );
}

function stateSig(body: string): string {
  return createHmac("sha256", stateSecret()).update(body).digest("base64url");
}

export function encodeGDriveState(payload: {
  client_id: string;
  user_id: string;
  return_to?: string;
}): string {
  const nonce = randomBytes(8).toString("hex");
  const body = Buffer.from(
    JSON.stringify({ ...payload, nonce, ts: Date.now() }),
  ).toString("base64url");
  return `${body}.${stateSig(body)}`;
}

export function decodeGDriveState(
  token: string,
): null | { client_id: string; user_id: string; return_to?: string; ts: number } {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (stateSig(body) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.client_id || !payload.user_id) return null;
    if (Date.now() - Number(payload.ts || 0) > STATE_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}
