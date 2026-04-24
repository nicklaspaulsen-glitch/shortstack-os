import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { resolveOrgId } from "@/lib/chat/server-helpers";
import type { ChannelType } from "@/lib/chat/types";

export const maxDuration = 10;

/**
 * GET /api/chat/channels
 * Returns channels the current user can see in their org (memberships + public channels),
 * annotated with unread_count + last_message_at.
 */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await resolveOrgId(supabase, user.id);
  const service = createServiceClient();

  // Channels the user is a member of
  const { data: memberRows } = await service
    .from("channel_members")
    .select("channel_id, last_read_at")
    .eq("user_id", user.id);
  const memberChannelIds = (memberRows || []).map((r) => r.channel_id as string);
  const lastReadMap = new Map<string, string>();
  for (const r of memberRows || []) lastReadMap.set(r.channel_id as string, r.last_read_at as string);

  // Public channels in the org (for browsing + auto-inclusion)
  const { data: orgPublic } = await service
    .from("channels")
    .select("*")
    .eq("org_id", orgId)
    .eq("channel_type", "public")
    .is("archived_at", null);

  // Member channels
  const { data: memberChans } = memberChannelIds.length > 0
    ? await service
        .from("channels")
        .select("*")
        .in("id", memberChannelIds)
        .is("archived_at", null)
    : { data: [] as Array<Record<string, unknown>> };

  // Merge + dedupe
  const byId = new Map<string, Record<string, unknown>>();
  for (const c of (orgPublic || [])) byId.set(c.id as string, c);
  for (const c of (memberChans || [])) byId.set(c.id as string, c);
  const channels = Array.from(byId.values());

  // Per-channel unread count + last_message_at
  const enriched = await Promise.all(channels.map(async (c) => {
    const cid = c.id as string;
    const since = lastReadMap.get(cid);
    const { count: unread } = since
      ? await service
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", cid)
          .is("deleted_at", null)
          .gt("created_at", since)
      : { count: 0 };

    const { data: latest } = await service
      .from("messages")
      .select("created_at")
      .eq("channel_id", cid)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      ...c,
      unread_count: unread || 0,
      last_message_at: latest?.created_at || null,
    };
  }));

  enriched.sort((a, b) => {
    const al = (a as { last_message_at: string | null }).last_message_at;
    const bl = (b as { last_message_at: string | null }).last_message_at;
    if (!al && !bl) return 0;
    if (!al) return 1;
    if (!bl) return -1;
    return bl.localeCompare(al);
  });

  return NextResponse.json({ channels: enriched });
}

/**
 * POST /api/chat/channels
 * Body: { name, description?, channel_type, project_id?, member_ids? }
 * Creates a channel and adds the creator + any member_ids as members.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name?: unknown;
    description?: unknown;
    channel_type?: unknown;
    project_id?: unknown;
    member_ids?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description : null;
  const type = typeof body.channel_type === "string" ? body.channel_type : "public";
  const projectId = typeof body.project_id === "string" ? body.project_id : null;
  const memberIds = Array.isArray(body.member_ids)
    ? (body.member_ids as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const validTypes: ChannelType[] = ["public", "private", "project", "dm"];
  if (!validTypes.includes(type as ChannelType)) {
    return NextResponse.json({ error: "invalid channel_type" }, { status: 400 });
  }

  const orgId = await resolveOrgId(supabase, user.id);
  const service = createServiceClient();

  const { data: chan, error } = await service
    .from("channels")
    .insert({
      org_id: orgId,
      name,
      description,
      channel_type: type,
      project_id: projectId,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error || !chan) {
    return NextResponse.json({ error: error?.message || "Failed to create channel" }, { status: 500 });
  }

  // Add creator + any invited members as channel_members
  const uniqueMembers = Array.from(new Set([user.id, ...memberIds]));
  const rows = uniqueMembers.map((uid) => ({
    channel_id: chan.id as string,
    user_id: uid,
  }));
  if (rows.length > 0) {
    await service.from("channel_members").insert(rows);
  }

  return NextResponse.json({ channel: chan });
}
