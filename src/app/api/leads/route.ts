import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();

  // Auth check — only authenticated users can view leads
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
  const status = searchParams.get("status");
  const industry = searchParams.get("industry");
  const source = searchParams.get("source");
  // Sanitize search input — strip wildcard characters to prevent ilike abuse
  const rawSearch = searchParams.get("search");
  const search = rawSearch ? rawSearch.replace(/[%_\\]/g, "") : null;
  const today = searchParams.get("today");

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .order("scraped_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

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
