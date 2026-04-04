import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateImageViaAPI, generateClientImageBatch } from "@/lib/services/midjourney";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { prompt, image_type, client_name, style, batch_concepts, industry } = body;

  // Batch generation
  if (batch_concepts && Array.isArray(batch_concepts)) {
    const results = await generateClientImageBatch({
      clientName: client_name || "ShortStack",
      industry: industry || "marketing",
      concepts: batch_concepts,
      imageType: image_type || "ad_creative",
      style,
    });

    return NextResponse.json({ success: true, results });
  }

  // Single image generation
  const result = await generateImageViaAPI({
    prompt: prompt || "professional marketing image",
    clientName: client_name,
    imageType: image_type || "ad_creative",
    style,
    aspectRatio: body.aspect_ratio,
  });

  // Log in trinity
  await supabase.from("trinity_log").insert({
    action_type: "custom",
    description: `Image generated: ${prompt?.substring(0, 50)}...`,
    status: result.success ? "completed" : "failed",
    result: { ...result },
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json(result);
}
