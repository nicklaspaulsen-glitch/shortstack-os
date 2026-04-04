import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { designWorkflow } from "@/lib/services/workflows";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt, client_id, client_name } = await request.json();

  try {
    const workflow = await designWorkflow(prompt, client_name);

    // Save to trinity_log
    await supabase.from("trinity_log").insert({
      action_type: "automation",
      description: `Workflow designed: ${workflow.name}`,
      command: prompt,
      client_id: client_id || null,
      status: "completed",
      result: workflow,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, workflow });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
