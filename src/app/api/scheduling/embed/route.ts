/**
 * Embed code generator.
 *
 * Returns a paste-ready `<iframe>` snippet for any meeting type the caller
 * owns, plus a copy-friendly URL for direct linking. The booking embed page
 * lives at `/book/embed/[meetingTypeId]` (a public page that renders the
 * meeting type with the configured brand color + logo).
 *
 * Returns 404 if the meeting type doesn't belong to the requesting user
 * (or their parent agency, via getEffectiveOwnerId).
 *
 * GET /api/scheduling/embed?meeting_type_id={id}
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const meetingTypeId = request.nextUrl.searchParams.get("meeting_type_id");
  if (!meetingTypeId) {
    return NextResponse.json(
      { error: "meeting_type_id is required" },
      { status: 400 },
    );
  }

  const { data: meetingType, error } = await supabase
    .from("meeting_types")
    .select("id, name, duration, color, embed_brand_color, embed_logo_url")
    .eq("id", meetingTypeId)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!meetingType) return NextResponse.json({ error: "Meeting type not found" }, { status: 404 });

  const url = `${APP_URL}/book/embed/${meetingType.id}`;
  // Reasonable defaults — taller than wide, mobile-friendly. Authors can
  // tweak the height/width inline once they paste it.
  const iframeSnippet = `<iframe src="${url}" width="100%" height="720" frameborder="0" style="border:0;border-radius:12px;min-height:640px;max-width:560px;" loading="lazy" title="${escapeHtml(meetingType.name)} — Booking"></iframe>`;
  // Also a script-tag variant that auto-resizes (basic postMessage handshake
  // — the embed page emits a `bookingHeight` postMessage when it renders).
  const scriptSnippet = `<div data-shortstack-booking="${meetingType.id}" style="max-width:560px;margin:0 auto;"></div>
<script async src="${APP_URL}/embed/booking.js"></script>`;

  return NextResponse.json({
    meeting_type: {
      id: meetingType.id,
      name: meetingType.name,
      duration: meetingType.duration,
      color: meetingType.embed_brand_color || meetingType.color,
      logo_url: meetingType.embed_logo_url,
    },
    direct_url: url,
    iframe_snippet: iframeSnippet,
    script_snippet: scriptSnippet,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
