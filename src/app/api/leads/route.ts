import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const status = searchParams.get("status");
  const industry = searchParams.get("industry");
  const source = searchParams.get("source");
  const search = searchParams.get("search");
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
