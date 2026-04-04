import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateContentScript } from "@/lib/services/content-ai";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { client_id, script_type, topic, brand_voice, platform } = body;

  try {
    // Get client name if client_id provided
    let clientName = "ShortStack";
    if (client_id) {
      const { data: client } = await supabase.from("clients").select("business_name").eq("id", client_id).single();
      if (client) clientName = client.business_name;
    }

    const result = await generateContentScript({
      clientName,
      brandVoice: brand_voice || "professional and engaging",
      scriptType: script_type,
      topic,
      platform,
    });

    const { data, error } = await supabase.from("content_scripts").insert({
      client_id: client_id || null,
      title: result.title,
      script_type,
      brand_voice,
      script_body: result.script_body,
      hook: result.hook,
      outline: result.outline,
      seo_title: result.seo_title,
      description: result.description,
      hashtags: result.hashtags,
      keywords: result.keywords,
      chapters: result.chapters,
      thumbnail_idea: result.thumbnail_idea,
      target_platform: platform || null,
      status: "scripted",
    }).select().single();

    if (error) throw error;

    return NextResponse.json({ success: true, script: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
