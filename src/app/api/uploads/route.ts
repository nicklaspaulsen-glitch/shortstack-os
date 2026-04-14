import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  const supabase = createServiceClient();

  // Get content with media (published or with drive links)
  const { data: content } = await supabase
    .from("content_scripts")
    .select("id, title, script_type, status, drive_folder_url, target_platform, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  // Get publish queue items (published content with URLs)
  const { data: published } = await supabase
    .from("publish_queue")
    .select("id, video_title, description, platforms, status, published_urls, published_at, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  // Get client uploads from storage bucket metadata
  const { data: uploads } = await supabase
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

  const supabase = createServiceClient();

  const { data, error } = await supabase.from("client_uploads").insert({
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
