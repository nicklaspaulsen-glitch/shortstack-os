import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { executeWorkflow } from "@/lib/services/workflows";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workflow, trigger_data, client_id } = await request.json();

  // If a client_id is supplied, verify the caller actually owns that client
  // before executing the workflow with a service-role client. Otherwise any
  // authed user could run automations scoped to another agency's client.
  if (client_id) {
    const { data: owned } = await supabase
      .from("clients")
      .select("id")
      .eq("id", client_id)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!owned) {
      return NextResponse.json({ error: "Forbidden — not your client" }, { status: 403 });
    }
  }

  // Basic shape validation so we don't hand arbitrary JSON to the engine.
  if (!workflow || typeof workflow !== "object" || !Array.isArray(workflow.steps)) {
    return NextResponse.json({ error: "Invalid workflow shape" }, { status: 400 });
  }

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
