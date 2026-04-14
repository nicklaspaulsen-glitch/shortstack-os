import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";
import { getMaxStorageUpload } from "@/lib/plan-config";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the caller has access to this client_id
  const access = await verifyClientAccess(supabase, user.id, clientId);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Use service client for queries that may need cross-table access
  const service = createServiceClient();

  const { data: content } = await service
    .from("content_scripts")
    .select("id, title, script_type, status, drive_folder_url, target_platform, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  const { data: published } = await service
    .from("publish_queue")
    .select("id, video_title, description, platforms, status, published_urls, published_at, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  const { data: uploads } = await service
    .from("client_uploads")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    content: content || [],
    published: published || [],
    uploads: uploads || [],
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { client_id, file_name, file_type, file_size, file_url, category } = body;

  if (!client_id || !file_name) {
    return NextResponse.json({ error: "client_id and file_name required" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await verifyClientAccess(supabase, user.id, client_id);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Enforce plan-tier file size limits
  const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const maxSize = getMaxStorageUpload(profile?.plan_tier);
  if (maxSize !== -1 && file_size && file_size > maxSize) {
    return NextResponse.json({ error: "File too large for your plan" }, { status: 413 });
  }

  const service = createServiceClient();
  const { data, error } = await service.from("client_uploads").insert({
    client_id,
    file_name,
    file_type: file_type || "unknown",
    file_size: file_size || 0,
    file_url: file_url || null,
    category: category || "general",
    status: "uploaded",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, upload: data });
}
