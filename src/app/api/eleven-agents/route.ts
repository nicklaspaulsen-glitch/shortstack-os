import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.ELEVENLABS_API_KEY ?? "";
const BASE = "https://api.elevenlabs.io/v1";

function headers() {
  return {
    "xi-api-key": API_KEY,
    "Content-Type": "application/json",
  };
}

// GET /api/eleven-agents  — list agents
export async function GET() {
  if (!API_KEY) {
    return NextResponse.json(
      { agents: [], message: "ELEVENLABS_API_KEY is not configured" },
      { status: 200 },
    );
  }

  try {
    const res = await fetch(`${BASE}/convai/agents`, {
      headers: headers(),
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

// POST /api/eleven-agents  — create or delete an agent
export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY is not configured" },
      { status: 200 },
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
        headers: headers(),
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
      firstMessage,
      systemPrompt,
      voiceId,
      maxDuration = 300,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      name,
      conversation_config: {
        agent: {
          prompt: {
            prompt: systemPrompt || "You are a helpful AI voice agent.",
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
      headers: headers(),
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
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
