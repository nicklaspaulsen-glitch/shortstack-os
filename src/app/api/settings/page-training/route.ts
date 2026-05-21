/**
 * GET  /api/settings/page-training?page=social
 * POST /api/settings/page-training  { page, creator_style_id, custom_instructions, tone, example_outputs, focus_topics }
 *
 * Reads or writes the current user's AI training config for a feature page.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { savePageTrainingConfig } from "@/lib/ai/page-training";
import type { PageContext } from "@/lib/ai/creator-styles";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pageKey = request.nextUrl.searchParams.get("page");
  if (!pageKey) return NextResponse.json({ error: "Missing ?page= param" }, { status: 400 });

  const { data, error } = await supabase
    .from("page_training_configs")
    .select("creator_style_id, custom_instructions, tone, example_outputs, focus_topics, updated_at")
    .eq("owner_id", user.id)
    .eq("page_key", pageKey)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data ?? null });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    page?: string;
    creator_style_id?: string | null;
    custom_instructions?: string | null;
    tone?: string | null;
    example_outputs?: string[];
    focus_topics?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pageKey = body.page as PageContext | undefined;
  if (!pageKey) return NextResponse.json({ error: "Missing page field" }, { status: 400 });

  const { error } = await savePageTrainingConfig(supabase, user.id, pageKey, {
    creator_style_id: body.creator_style_id ?? undefined,
    custom_instructions: body.custom_instructions ?? undefined,
    tone: body.tone ?? undefined,
    example_outputs: body.example_outputs,
    focus_topics: body.focus_topics,
  });

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ success: true });
}
