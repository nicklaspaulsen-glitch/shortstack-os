import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { executeWorkflow } from "@/lib/services/workflows";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workflow, trigger_data, client_id } = await request.json();

  try {
    const serviceSupabase = createServiceClient();
    const result = await executeWorkflow(workflow, {
      supabase: serviceSupabase,
      clientId: client_id,
    }, trigger_data);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
