import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET /api/conversations
// Query: channel, status, unread_only, search, limit, offset
// Returns list of conversations scoped to the effective owner (team_member → parent agency).
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const url = new URL(request.url);
  const channel = url.searchParams.get("channel");
  const status = url.searchParams.get("status");
  const unreadOnly = url.searchParams.get("unread_only") === "1";
  const search = url.searchParams.get("search")?.trim();
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 200);
  const offset = Number(url.searchParams.get("offset") || "0");

  let query = supabase
    .from("conversations")
    .select(
      "id, channel, external_thread_id, subject, last_message_at, last_message_preview, unread_count, status, assigned_to_user_id, tags, contact_id, created_at",
    )
    .eq("user_id", ownerId)
    .order("last_message_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (channel) query = query.eq("channel", channel);
  if (status) query = query.eq("status", status);
  if (unreadOnly) query = query.gt("unread_count", 0);
  if (search) {
    query = query.or(
      `last_message_preview.ilike.%${search}%,subject.ilike.%${search}%,external_thread_id.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with contact name where available.
  const contactIds = Array.from(
    new Set((data ?? []).map((c) => c.contact_id).filter((v): v is string => !!v)),
  );
  let contactsById: Record<string, { business_name: string; contact_name: string | null; email: string | null; phone: string | null }> = {};
  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from("clients")
      .select("id, business_name, contact_name, email, phone")
      .in("id", contactIds);
    contactsById = Object.fromEntries(
      (contacts ?? []).map((c) => [c.id, {
        business_name: c.business_name,
        contact_name: c.contact_name,
        email: c.email,
        phone: c.phone,
      }]),
    );
  }

  return NextResponse.json({
    conversations: (data ?? []).map((c) => ({
      ...c,
      contact: c.contact_id ? contactsById[c.contact_id] ?? null : null,
    })),
  });
}
