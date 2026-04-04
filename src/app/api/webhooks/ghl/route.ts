import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { handleGHLCallWebhook } from "@/lib/services/cold-calling";

// GHL sends call outcome webhooks here
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const payload = await request.json();

  // Handle different GHL webhook types
  const type = payload.type || payload.event;

  if (type === "CallCompleted" || type === "call.completed") {
    await handleGHLCallWebhook(supabase, payload);
  }

  return NextResponse.json({ ok: true });
}
