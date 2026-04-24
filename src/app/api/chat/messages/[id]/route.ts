import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { parseMentions, resolveOrgId } from "@/lib/chat/server-helpers";
import { EDIT_WINDOW_MS } from "@/lib/chat/types";

export const maxDuration = 10;

type Ctx = { params: { id: string } };

/**
 * PATCH /api/chat/messages/:id — edit content within 5-minute window.
 * Body: { content: string }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = params.id;
  let body: { content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const content = typeof body.content === "string" ? body.content : "";
  if (!content.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });
  if (content.length > 8000) return NextResponse.json({ error: "Message too long" }, { status: 400 });

  const service = createServiceClient();
  const { data: msg } = await service
    .from("messages")
    .select("id, sender_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (msg.sender_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const age = Date.now() - new Date(msg.created_at as string).getTime();
  if (age > EDIT_WINDOW_MS) {
    return NextResponse.json({ error: "Edit window expired" }, { status: 403 });
  }

  const orgId = await resolveOrgId(supabase, user.id);
  const mentions = await parseMentions(supabase, orgId, content);

  const { data: updated, error } = await service
    .from("messages")
    .update({ content, mentions, edited_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !updated) {
    return NextResponse.json({ error: error?.message || "Failed to edit" }, { status: 500 });
  }
  return NextResponse.json({ message: updated });
}

/**
 * DELETE /api/chat/messages/:id — soft-delete within 5-minute window.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = params.id;
  const service = createServiceClient();
  const { data: msg } = await service
    .from("messages")
    .select("id, sender_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (msg.sender_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const age = Date.now() - new Date(msg.created_at as string).getTime();
  if (age > EDIT_WINDOW_MS) {
    return NextResponse.json({ error: "Delete window expired" }, { status: 403 });
  }

  const { error } = await service
    .from("messages")
    .update({ deleted_at: new Date().toISOString(), content: "" })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
