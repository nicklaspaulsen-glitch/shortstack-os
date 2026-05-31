import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Apr 28: env reads moved inside getApiKey() per CLAUDE.md (no
// module-level env reads — same pattern that bricked Stripe builds).
// `headers()` accepts the resolved key as a param so callers stay
// pure functions of the env at request time.
const BASE = "https://api.elevenlabs.io/v1";

function getApiKey(): string {
  return process.env.ELEVENLABS_API_KEY ?? "";
}

function headers(apiKey: string) {
  return {
    "xi-api-key": apiKey,
    "Content-Type": "application/json",
  };
}

async function requireAuth() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user, supabase };
}

// Apr 28: agent CRUD acts on the SHARED ElevenLabs account, so a destructive
// call (delete_agent / create_agent) leaks across every tenant on the same
// API key. Restrict mutations to admin / founder / team_member with manage
// rights — clients NEVER touch account-level agent state. Reads are kept
// open to authed users since the UI lists agents on multiple surfaces.
const AGENCY_MUTATE_ROLES = ["admin", "founder", "agency", "team_member"];

async function requireAgencyMutator(
  supabase: ReturnType<typeof createServerSupabase>,
  userId: string,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  const role = (profile?.role as string | null) ?? null;
  if (!role || !AGENCY_MUTATE_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Only agency staff can manage ElevenLabs agents" },
      { status: 403 },
    );
  }
  return null;
}

// GET /api/eleven-agents  — list agents (authed only — exposes account-level agents)
export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth && auth.error) return auth.error;

  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { agents: [], message: "ELEVENLABS_API_KEY is not configured" },
      { status: 200 },
    );
  }

  try {
    const res = await fetch(`${BASE}/convai/agents`, {
      headers: headers(apiKey),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { agents: [], error: `ElevenLabs API error ${res.status}: ${body}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    // The API returns { agents: [...] }
    return NextResponse.json({ agents: data.agents ?? [] });
  } catch (err) {
    return NextResponse.json(
      { agents: [], error: String(err) },
      { status: 500 },
    );
  }
}

// POST /api/eleven-agents  — create or delete an agent (agency-staff only)
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth && auth.error) return auth.error;

  // Apr 28: gate destructive agent mutations behind agency-staff roles.
  // Previously any authed user (including portal clients) could delete
  // every agent on the shared ElevenLabs account.
  const denied = await requireAgencyMutator(auth.supabase, auth.user.id);
  if (denied) return denied;

  const apiKey = getApiKey();
  if (!apiKey) {
    // Apr 28: was 200 — destructive endpoints should fail-closed 503.
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY is not configured" },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const { action } = body;

    // ── Delete agent ──
    if (action === "delete_agent") {
      const { agentId } = body;
      if (!agentId) {
        return NextResponse.json({ error: "agentId is required" }, { status: 400 });
      }
      const res = await fetch(`${BASE}/convai/agents/${agentId}`, {
        method: "DELETE",
        headers: headers(apiKey),
      });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { error: `Delete failed ${res.status}: ${text}` },
          { status: res.status },
        );
      }
      return NextResponse.json({ success: true });
    }

    // ── Create agent (default action) ──
    const {
      name,
      firstMessage: rawFirstMessage,
      systemPrompt: rawSystemPrompt,
      voiceId,
      maxDuration = 300,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // LLM-injection guard: cap user-controlled text forwarded to ElevenLabs agent config
    const systemPrompt = rawSystemPrompt ? String(rawSystemPrompt).slice(0, 8000) : "You are a helpful AI voice agent.";
    const firstMessage = rawFirstMessage ? String(rawFirstMessage).slice(0, 500) : undefined;

    const payload: Record<string, unknown> = {
      name,
      conversation_config: {
        agent: {
          prompt: {
            prompt: systemPrompt,
          },
          first_message: firstMessage || undefined,
          language: "en",
        },
        tts: {
          voice_id: voiceId || "21m00Tcm4TlvDq8ikWAM", // Rachel default
        },
        max_duration_seconds: maxDuration,
      },
    };

    const res = await fetch(`${BASE}/convai/agents/create`, {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Create failed ${res.status}: ${text}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json({ agentId: data.agent_id ?? data.id, data });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
