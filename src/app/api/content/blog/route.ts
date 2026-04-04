import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateBlogPost, generateBlogPDF } from "@/lib/services/blog-generator";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { client_id, topic, keywords, tone, word_count, generate_pdf } = body;

  let clientName = "ShortStack";
  let industry = "marketing";
  if (client_id) {
    const { data: client } = await supabase.from("clients").select("business_name, industry").eq("id", client_id).single();
    if (client) { clientName = client.business_name; industry = client.industry || "business"; }
  }

  const blog = await generateBlogPost({
    clientName,
    industry,
    topic,
    keywords,
    tone,
    wordCount: word_count,
  });

  // Save as content script
  await supabase.from("content_scripts").insert({
    client_id: client_id || null,
    title: blog.title,
    script_type: "long_form",
    script_body: blog.content,
    seo_title: blog.title,
    description: blog.metaDescription,
    keywords: blog.keywords,
    status: "scripted",
  });

  if (generate_pdf) {
    const pdfBuffer = await generateBlogPDF({
      title: blog.title,
      content: blog.content,
      clientName,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${blog.title.replace(/[^a-zA-Z0-9]/g, "_")}_blog.pdf"`,
      },
    });
  }

  return NextResponse.json({ success: true, blog });
}
