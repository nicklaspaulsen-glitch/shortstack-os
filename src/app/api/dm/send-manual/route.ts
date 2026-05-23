import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { sendDM as zernioDM } from "@/lib/services/zernio";

const VALID_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "twitter",
  "x",
  "tiktok",
] as const;

type Platform = (typeof VALID_PLATFORMS)[number];

interface DmRequest {
  platform: Platform;
  handle: string;
  message: string;
}

// POST /api/dm/send-manual
// Send a single direct message via Zernio. Zernio's actual DM endpoint
// signature varies per integration plan — this route normalises the
// request shape and returns a clean envelope so the dialer UI doesn't
// have to know provider details.
//
// Behaviour when ZERNIO_API_KEY is missing: queue the DM into outreach_log
// with status="queued" so the user still gets a record. The actual send
// can be replayed later when keys are configured. This matches the
// degraded-but-not-broken pattern used elsewhere in the repo.
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<DmRequest>;
  if (!body.platform || !VALID_PLATFORMS.includes(body.platform as Platform)) {
    return NextResponse.json(
      { error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!body.handle || !body.handle.trim()) {
    return NextResponse.json({ error: "Missing handle" }, { status: 400 });
  }
  const message = (body.message || "").trim();
  if (!message) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "Message exceeds 2000 chars" }, { status: 400 });
  }

  const platform = body.platform as Platform;
  const handle = body.handle.trim().replace(/^@/, ""); // strip leading @ for normalised storage
  // ownerId is the auth gate — keep it on the metadata so cross-tenant
  // outreach_log queries can still filter by it.
  const writerOwner = ownerId;
  const service = createServiceClient();
  const zernioKey = process.env.ZERNIO_API_KEY;

  // Degraded mode — queue without sending, record in outreach_log.
  if (!zernioKey) {
    await service.from("outreach_log").insert({
      platform,
      business_name: null,
      recipient_handle: handle,
      message_text: message,
      status: "queued",
      sent_at: null,
      metadata: {
        direction: "outbound",
        via: "dialer-dm",
        owner_id: writerOwner,
        queued_reason: "ZERNIO_API_KEY not configured",
      },
    });
    return NextResponse.json({
      success: false,
      queued: true,
      reason: "Zernio not configured — DM queued in outreach_log for retry.",
    });
  }

  // Live send via centralized Zernio DM client.
  const dmResult = await zernioDM({ platform, handle, message });

  if (!dmResult.ok) {
    await service.from("outreach_log").insert({
      platform,
      business_name: null,
      recipient_handle: handle,
      message_text: message,
      status: "failed",
      sent_at: null,
      metadata: {
        direction: "outbound",
        via: "dialer-dm",
        owner_id: writerOwner,
        error: dmResult.error,
      },
    });
    return NextResponse.json(
      { success: false, error: dmResult.error || "Zernio send failed" },
      { status: 502 },
    );
  }

  await service.from("outreach_log").insert({
    platform,
    business_name: null,
    recipient_handle: handle,
    message_text: message,
    status: "sent",
    sent_at: new Date().toISOString(),
    metadata: {
      direction: "outbound",
      via: "dialer-dm",
      owner_id: writerOwner,
      zernio_id: dmResult.messageId ?? null,
    },
  });

  return NextResponse.json({
    success: true,
    platform,
    handle,
    zernio_id: dmResult.messageId ?? null,
  });
}
