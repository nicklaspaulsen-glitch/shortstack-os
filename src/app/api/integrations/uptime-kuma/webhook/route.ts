/**
 * Uptime Kuma webhook receiver.
 *
 * Self-hosted Uptime Kuma posts to this endpoint when a monitor's status
 * changes (UP ↔ DOWN). We translate that into an `incidents` row so the
 * public /status/[ownerSlug] page shows the outage automatically without
 * the operator having to hand-author it.
 *
 * ## Auth
 *
 * - HMAC-SHA256 over the raw body keyed with `UPTIME_KUMA_WEBHOOK_SECRET`.
 *   Header: `X-Uptime-Signature: sha256=<hex>`.
 * - Tenant id passed in `X-Owner-Id` header (configured per-monitor in
 *   Kuma's Notification settings).
 *
 * Fail-closed in production when `UPTIME_KUMA_WEBHOOK_SECRET` is unset
 * (mirrors the rest of the inbound webhook stack — see
 * `/api/webhooks/elevenlabs/route.ts` and
 * `/api/billing/webhook/route.ts`).
 *
 * ## Event semantics
 *
 *   monitor.status === 0 → DOWN  → INSERT incident (severity=investigating)
 *   monitor.status === 1 → UP    → UPDATE existing open incident set
 *                                   resolved_at = now(), severity=resolved
 *
 * One open incident per (owner, monitor_name) at a time. If a flap
 * generates UP→DOWN→UP→DOWN, we only carry one row forward — the
 * resolution timestamp moves but we don't churn duplicate rows.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability/error-reporter";
import { structuredLog } from "@/lib/observability/structured-log";

interface KumaPayload {
  monitor?: {
    name?: string;
    status?: number; // 0 = down, 1 = up, 2 = pending
    type?: string;
    url?: string;
  };
  heartbeat?: {
    status?: number;
    msg?: string;
    time?: string;
    important?: boolean;
  };
  msg?: string; // Fallback Kuma "msg" field (older versions)
}

function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  // Accept either `sha256=<hex>` (preferred) or bare hex.
  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  // Buffer.from with length-mismatched hex gives different-length buffers
  // and timingSafeEqual would throw — guard explicitly.
  if (provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(provided, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Fail-closed in production. Mirrors the pattern documented in
  // CLAUDE.md and used by Resend/ElevenLabs/Stripe webhooks.
  const secret = process.env.UPTIME_KUMA_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[uptime-kuma/webhook] UPTIME_KUMA_WEBHOOK_SECRET is not set — rejecting request.",
      );
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 503 },
      );
    }
    // Dev: log and continue so local Kuma testing doesn't require the secret.
    console.warn(
      "[uptime-kuma/webhook] UPTIME_KUMA_WEBHOOK_SECRET unset — accepting unsigned in development only",
    );
  } else {
    const sig =
      request.headers.get("x-uptime-signature") ||
      request.headers.get("x-uptime-kuma-signature");
    if (!verifySignature(rawBody, sig, secret)) {
      reportError(new Error("Uptime Kuma signature verification failed"), {
        route: "/api/integrations/uptime-kuma/webhook",
        component: "kuma-signature",
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const ownerId = request.headers.get("x-owner-id");
  if (!ownerId || !UUID_RE.test(ownerId)) {
    return NextResponse.json(
      { error: "Missing or malformed X-Owner-Id" },
      { status: 400 },
    );
  }

  let payload: KumaPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const monitorName = payload.monitor?.name;
  // Status: 0 = DOWN, 1 = UP. We treat anything else as a no-op.
  const status =
    payload.heartbeat?.status ?? payload.monitor?.status ?? null;
  if (!monitorName || (status !== 0 && status !== 1)) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "no monitor name or non-actionable status",
    });
  }

  const supabase = createServiceClient();

  if (status === 0) {
    // DOWN — open an incident if one isn't already open for this monitor.
    const { data: existing } = await supabase
      .from("incidents")
      .select("id")
      .eq("owner_id", ownerId)
      .is("resolved_at", null)
      .contains("affected_components", [monitorName])
      .limit(1);

    if (existing && existing.length > 0) {
      structuredLog.info("[uptime-kuma-webhook]", "monitor still down, no new incident", {
        owner_id: ownerId,
        monitor: monitorName,
        existing_incident_id: existing[0].id,
      });
      return NextResponse.json({ ok: true, deduped: true });
    }

    const title = `${monitorName} is DOWN`;
    const body = payload.heartbeat?.msg || payload.msg || "Detected by Uptime Kuma";

    const { data: inserted, error: insertErr } = await supabase
      .from("incidents")
      .insert({
        owner_id: ownerId,
        title,
        body,
        severity: "investigating",
        affected_components: [monitorName],
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      reportError(insertErr, {
        route: "/api/integrations/uptime-kuma/webhook",
        component: "open-incident",
        owner_id: ownerId,
        monitor: monitorName,
      });
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    structuredLog.warn("[uptime-kuma-webhook]", "opened incident", {
      owner_id: ownerId,
      monitor: monitorName,
      incident_id: inserted?.id,
    });
    return NextResponse.json({ ok: true, action: "opened", incident: inserted });
  }

  // status === 1 — UP. Resolve any open incident for this monitor.
  const nowIso = new Date().toISOString();
  const { data: resolved, error: resolveErr } = await supabase
    .from("incidents")
    .update({
      severity: "resolved",
      resolved_at: nowIso,
    })
    .eq("owner_id", ownerId)
    .is("resolved_at", null)
    .contains("affected_components", [monitorName])
    .select();

  if (resolveErr) {
    reportError(resolveErr, {
      route: "/api/integrations/uptime-kuma/webhook",
      component: "resolve-incident",
      owner_id: ownerId,
      monitor: monitorName,
    });
    return NextResponse.json({ error: "Resolve failed" }, { status: 500 });
  }

  if (!resolved || resolved.length === 0) {
    // UP came in but we had no open incident. Common case on Kuma's first
    // heartbeat after monitor (re)creation — return 200 ok so Kuma stops
    // retrying, but flag it as a no-op.
    return NextResponse.json({ ok: true, action: "noop", reason: "no open incident" });
  }

  structuredLog.info("[uptime-kuma-webhook]", "resolved incidents", {
    owner_id: ownerId,
    monitor: monitorName,
    count: resolved.length,
  });
  return NextResponse.json({ ok: true, action: "resolved", count: resolved.length });
}
