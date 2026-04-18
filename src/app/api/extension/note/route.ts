import { NextRequest, NextResponse } from "next/server";
import { requireExtensionUser } from "@/lib/extension/auth";

/**
 * /api/extension/note — quick notes saved from the Chrome extension.
 *
 * Previously stored notes in a module-level array which was lost on every
 * serverless cold-start. Now writes to the `extension_notes` Supabase table
 * (see supabase/migrations/20260418_extension_notes.sql). RLS enforces
 * auth.uid() = user_id so each user only sees their own notes.
 */
export async function POST(req: NextRequest) {
  try {
    // SECURITY: real token validation replaces the previous prefix-only check.
    const auth = await requireExtensionUser(req);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    const body = await req.json();
    const { content, url, type, pageTitle, title, tags } = body ?? {};

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    // Tag list: caller may send tags[], or we default from the `type` hint
    // (e.g. "quick", "selection") so the UI can filter by source later.
    const tagList: string[] = Array.isArray(tags)
      ? tags.filter((t): t is string => typeof t === "string")
      : [];
    if (type && !tagList.includes(type)) tagList.push(type);

    const { data: note, error } = await supabase
      .from("extension_notes")
      .insert({
        user_id: user.id,
        content,
        url: url || null,
        page_title: pageTitle || title || null,
        tags: tagList,
      })
      .select()
      .single();

    if (error) {
      console.error("[Extension Note] Insert failed:", error);
      return NextResponse.json(
        { error: error.message || "Failed to save note" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, note });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireExtensionUser(req);
  if (auth.error) return auth.error;
  const { supabase } = auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  // RLS guarantees we only get the current user's notes — no explicit
  // .eq("user_id", ...) needed, but adding it as defense in depth.
  const { data: notes, error } = await supabase
    .from("extension_notes")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, notes: notes ?? [], limit, offset });
}
