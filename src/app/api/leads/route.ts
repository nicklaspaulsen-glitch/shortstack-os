import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireOwnedClient, getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();

  // Auth check — only authenticated users can view leads
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);

  const isExport = searchParams.get("export") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const maxLimit = isExport ? 10000 : 100;
  const limit = Math.min(maxLimit, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
  const status = searchParams.get("status");
  const industry = searchParams.get("industry");
  const source = searchParams.get("source");
  const clientId = searchParams.get("client_id");
  // Sanitize search input — strip wildcard characters to prevent ilike abuse
  const rawSearch = searchParams.get("search");
  const search = rawSearch ? rawSearch.replace(/[%_\\]/g, "") : null;
  const today = searchParams.get("today");

  // Resolve effective agency owner (team_members → parent agency)
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  // If a client_id is provided, verify ownership
  if (clientId) {
    const ctx = await requireOwnedClient(supabase, user.id, clientId);
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("user_id", ownerId)  // Scope all lead queries to the effective owner
    .order("scraped_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (clientId) query = query.eq("client_id", clientId);
  if (status) query = query.eq("status", status);
  if (industry) query = query.eq("industry", industry);
  if (source) query = query.eq("source", source);
  if (search) query = query.ilike("business_name", `%${search}%`);
  if (today === "true") {
    query = query.gte("scraped_at", new Date().toISOString().split("T")[0]);
  }

  const { data, count, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ leads: data, total: count, page, limit });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { business_name, email, phone, industry, city, state, source, status, website, notes } = body;

  if (!business_name || typeof business_name !== "string" || !business_name.trim()) {
    return NextResponse.json({ error: "business_name is required" }, { status: 400 });
  }

  // Set owner so new leads are scoped to the caller's agency
  const ownerId = await getEffectiveOwnerId(supabase, user.id);

  const { data, error } = await supabase.from("leads").insert({
    user_id: ownerId,
    business_name: business_name.trim(),
    email: email || null,
    phone: phone || null,
    industry: industry || null,
    city: city || null,
    state: state || null,
    source: source || "Manual",
    status: status || "new",
    website: website || null,
    notes: notes || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ lead: data });
}
