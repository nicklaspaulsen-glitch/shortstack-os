import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Public read uses the anon key (RLS allows public reads of active forms)
function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { formId: string } }
) {
  const supabase = anonClient();

  const { data, error } = await supabase
    .from("intake_forms")
    .select("id, name, welcome_message, fields, brand_color, ai_qualification")
    .eq("id", params.formId)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
