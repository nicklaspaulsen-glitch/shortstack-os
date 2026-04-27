/**
 * POST /api/meetings/from-url
 *
 * Body: { title, source_url, lead_id?, deal_id?, client_id? }
 *
 * Server-side downloads the recording (Zoom / Loom share link / pre-signed
 * Drive URL), uploads it into the `meetings` storage bucket, and creates a
 * meeting row in `processing`. Returns the new meeting id so the client can
 * poll `/api/meetings/[id]/status` while the worker transcribes.
 *
 * SSRF-hardened — `assertSafeFetchUrl` inside `fetchMeetingFromUrl` blocks
 * loopback / private / cloud-metadata IPs.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { fetchMeetingFromUrl } from "@/lib/meetings/url-fetcher";
import { SsrfBlockedError } from "@/lib/security/ssrf";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    title?: string;
    source_url?: string;
    lead_id?: string;
    deal_id?: string;
    client_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = String(body.title || "").trim();
  const sourceUrl = String(body.source_url || "").trim();
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!sourceUrl) return NextResponse.json({ error: "source_url is required" }, { status: 400 });

  // Validate any caller-provided CRM links belong to the caller's tenant.
  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  if (body.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id, user_id")
      .eq("id", body.lead_id)
      .maybeSingle();
    if (!lead || lead.user_id !== ownerId) {
      return NextResponse.json({ error: "lead_id not in workspace" }, { status: 404 });
    }
  }
  if (body.deal_id) {
    const { data: deal } = await supabase
      .from("deals")
      .select("id, user_id")
      .eq("id", body.deal_id)
      .maybeSingle();
    if (!deal || deal.user_id !== ownerId) {
      return NextResponse.json({ error: "deal_id not in workspace" }, { status: 404 });
    }
  }
  if (body.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("id, profile_id")
      .eq("id", body.client_id)
      .maybeSingle();
    if (!client || client.profile_id !== ownerId) {
      return NextResponse.json({ error: "client_id not in workspace" }, { status: 404 });
    }
  }

  // Download the file server-side. Throws SsrfBlockedError on bad host.
  let recording;
  try {
    recording = await fetchMeetingFromUrl(sourceUrl);
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[meetings/from-url] download error:", err);
    const msg = err instanceof Error ? err.message : "Download failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Create the meeting row first so we have an id for the storage path.
  const { data: meeting, error: insertErr } = await supabase
    .from("meetings")
    .insert({
      created_by: user.id,
      title,
      source_type: recording.sourceType,
      source_url: sourceUrl,
      lead_id: body.lead_id || null,
      deal_id: body.deal_id || null,
      client_id: body.client_id || null,
      status: "processing",
    })
    .select()
    .single();
  if (insertErr || !meeting) {
    console.error("[meetings/from-url] insert error:", insertErr);
    return NextResponse.json({ error: insertErr?.message || "Insert failed" }, { status: 500 });
  }

  // Upload the downloaded file into the meetings bucket.
  const path = `${user.id}/${meeting.id}/${Date.now()}_${recording.filename}`;
  const buffer = new Uint8Array(await recording.blob.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from("meetings")
    .upload(path, buffer, { contentType: recording.contentType, upsert: false });
  if (uploadErr) {
    console.error("[meetings/from-url] storage error:", uploadErr);
    // Mark the row as failed so the dashboard reflects the broken state.
    await supabase
      .from("meetings")
      .update({ status: "failed" })
      .eq("id", meeting.id);
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: signed } = await supabase.storage
    .from("meetings")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  const audioUrl = signed?.signedUrl || null;

  const { data: updated } = await supabase
    .from("meetings")
    .update({ audio_url: audioUrl, audio_r2_key: path })
    .eq("id", meeting.id)
    .select()
    .single();

  return NextResponse.json({ meeting: updated || meeting, audio_url: audioUrl });
}
