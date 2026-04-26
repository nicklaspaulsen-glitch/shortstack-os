// Shared OAuth helpers for Ads Manager — Meta Ads, Google Ads, TikTok Ads
// Used by /api/oauth/[platform]/{start,callback} and /api/ads/[platform]/*

import { NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";

export const AD_PLATFORMS = ["meta_ads", "google_ads", "tiktok_ads"] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number];

/**
 * Base URL for the app (used to build redirect URIs and UI redirects).
 */
export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
}

/**
 * Redirect URI for a platform's OAuth callback.
 */
export function getRedirectUri(platform: AdPlatform): string {
  return `${getBaseUrl()}/api/oauth/${platformSlug(platform)}/callback`;
}

export function platformSlug(platform: AdPlatform): string {
  // Meta maps to the existing meta route slug for Ads flow
  return platform.replace("_", "-");
}

/**
 * Env var lookup per platform. Returns array of missing required vars.
 */
export function missingEnvFor(platform: AdPlatform): string[] {
  if (platform === "meta_ads") {
    return [
      ["META_APP_ID", process.env.META_APP_ID],
      ["META_APP_SECRET", process.env.META_APP_SECRET],
    ].filter(([, v]) => !v).map(([k]) => k as string);
  }
  if (platform === "google_ads") {
    return [
      ["GOOGLE_CLIENT_ID", process.env.GOOGLE_CLIENT_ID],
      ["GOOGLE_CLIENT_SECRET", process.env.GOOGLE_CLIENT_SECRET],
    ].filter(([, v]) => !v).map(([k]) => k as string);
  }
  if (platform === "tiktok_ads") {
    return [
      ["TIKTOK_APP_ID", process.env.TIKTOK_APP_ID || process.env.TIKTOK_ADS_APP_ID || process.env.TIKTOK_CLIENT_KEY],
      ["TIKTOK_SECRET", process.env.TIKTOK_SECRET || process.env.TIKTOK_ADS_APP_SECRET || process.env.TIKTOK_CLIENT_SECRET],
    ].filter(([, v]) => !v).map(([k]) => k as string);
  }
  return [];
}

/**
 * Human-readable platform label.
 */
export function platformLabel(platform: AdPlatform): string {
  if (platform === "meta_ads") return "Meta Ads";
  if (platform === "google_ads") return "Google Ads";
  if (platform === "tiktok_ads") return "TikTok Ads";
  return platform;
}

/**
 * Respond with a structured error when OAuth env vars are missing.
 */
export function missingEnvResponse(platform: AdPlatform, missing: string[]): NextResponse {
  return NextResponse.json(
    {
      error: `${platformLabel(platform)} OAuth not configured. Add ${missing.join(" + ")} to .env.local`,
      platform,
      missing_env: missing,
    },
    { status: 400 }
  );
}

/**
 * Create a signed state token carrying the user id and the return path.
 * Uses HMAC with SUPABASE_SERVICE_ROLE_KEY as the signing secret so we don't
 * need to round-trip through the DB just for state.
 */
export function encodeState(payload: { user_id: string; return_to?: string; platform: AdPlatform }): string {
  const nonce = randomBytes(8).toString("hex");
  const body = Buffer.from(JSON.stringify({ ...payload, nonce, ts: Date.now() })).toString("base64url");
  const sig = signState(body);
  return `${body}.${sig}`;
}

export function decodeState(token: string): null | { user_id: string; return_to?: string; platform: AdPlatform; ts: number } {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (signState(body) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.user_id || !payload.platform) return null;
    // Expire after 15 minutes
    if (Date.now() - Number(payload.ts || 0) > 15 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

function signState(data: string): string {
  // Priority: OAUTH_STATE_SECRET → NEXTAUTH_SECRET (aligns with oauth-state.ts pattern).
  // SUPABASE_SERVICE_ROLE_KEY intentionally removed — that key bypasses RLS and
  // must not double as a state-signing secret. No literal fallback: a missing
  // signing secret means state tokens are forgeable, which is a hard failure.
  const secret = process.env.OAUTH_STATE_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("OAUTH_STATE_SECRET or NEXTAUTH_SECRET must be set for OAuth state signing");
  }
  return createHmac("sha256", secret).update(data).digest("base64url");
}

/**
 * UI redirect URL for a successful OAuth callback.
 */
export function uiRedirectOnSuccess(platform: AdPlatform, returnTo?: string): string {
  const path = returnTo || "/dashboard/ads-manager";
  const sep = path.includes("?") ? "&" : "?";
  return `${getBaseUrl()}${path}${sep}connected=${platform}`;
}

export function uiRedirectOnError(platform: AdPlatform, reason: string, returnTo?: string): string {
  const path = returnTo || "/dashboard/ads-manager";
  const sep = path.includes("?") ? "&" : "?";
  return `${getBaseUrl()}${path}${sep}error=${encodeURIComponent(reason)}&platform=${platform}`;
}
