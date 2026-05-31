import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { runElevenAgentCalls } from "@/lib/services/eleven-agents";

// Apr 28: env reads moved into the handler per CLAUDE.md ban on
// module-level env reads.
const BASE = "https://api.elevenlabs.io/v1";

const AGENCY_MUTATE_ROLES = ["admin", "founder", "agency", "team_member"];

// GET /api/eleven-agents/calls  — list recent conversations (authed — can include transcripts)
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ELEVENLABS_API_KEY ?? "";
  if (!apiKey) {
    return NextResponse.json(
      { conversations: [], message: "ELEVENLABS_API_KEY is not configured" },
      { status: 200 },
    );
  }

  try {
    const res = await fetch(`${BASE}/convai/conversations`, {
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { conversations: [], error: `ElevenLabs API error ${res.status}: ${body}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json({
      conversations: data.conversations ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      { conversations: [], error: String(err) },
      { status: 500 },
    );
  }
}

// POST /api/eleven-agents/calls  — trigger a batch of outbound AI cold calls
// Body: { maxCalls?: number (1–50), clientId?: string }
// Auth: agency staff only (triggers real phone calls + billing)
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile?.role as string | null) ?? null;
  if (!role || !AGENCY_MUTATE_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Only agency staff can launch AI calls" },
      { status: 403 },
    );
  }

  const apiKey = process.env.ELEVENLABS_API_KEY ?? "";
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 503 });
  }

  let maxCalls = 10;
  let clientId: string | undefined;
  try {
    const body = await req.json();
    if (body.maxCalls != null) maxCalls = Math.min(50, Math.max(1, Number(body.maxCalls)));
    if (body.clientId) clientId = String(body.clientId);
  } catch {
    // use defaults — body may be empty
  }

  // Use service client for cross-table ops; ownerId scopes lead queries to this tenant.
  const service = createServiceClient();
  const result = await runElevenAgentCalls(service, maxCalls, clientId, user.id);
  return NextResponse.json(result);
}
