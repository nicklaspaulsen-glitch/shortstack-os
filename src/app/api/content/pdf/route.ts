import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateScriptPDF } from "@/lib/services/content-ai";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scriptId = request.nextUrl.searchParams.get("id");
  if (!scriptId) return NextResponse.json({ error: "Script ID required" }, { status: 400 });

  const { data: script } = await supabase
    .from("content_scripts")
    .select("*, clients(business_name)")
    .eq("id", scriptId)
    .single();

  if (!script) return NextResponse.json({ error: "Script not found" }, { status: 404 });

  const pdfBuffer = await generateScriptPDF({
    title: script.title,
    client_name: script.clients?.business_name,
    script_type: script.script_type,
    hook: script.hook,
    script_body: script.script_body,
    outline: script.outline,
    seo_title: script.seo_title,
    description: script.description,
    hashtags: script.hashtags,
    keywords: script.keywords,
    thumbnail_idea: script.thumbnail_idea,
  });

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${script.title.replace(/[^a-zA-Z0-9]/g, "_")}_script.pdf"`,
    },
  });
}
