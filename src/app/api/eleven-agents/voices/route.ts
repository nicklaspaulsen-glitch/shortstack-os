import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const API_KEY = process.env.ELEVENLABS_API_KEY ?? "";
const BASE = "https://api.elevenlabs.io/v1";

// GET /api/eleven-agents/voices  — list available voices (authed only)
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!API_KEY) {
    return NextResponse.json(
      { voices: [], message: "ELEVENLABS_API_KEY is not configured" },
      { status: 200 },
    );
  }

  try {
    const res = await fetch(`${BASE}/voices`, {
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { voices: [], error: `ElevenLabs API error ${res.status}: ${body}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json({
      voices: data.voices ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      { voices: [], error: String(err) },
      { status: 500 },
    );
  }
}
