import { NextResponse } from "next/server";

const API_KEY = process.env.ELEVENLABS_API_KEY ?? "";
const BASE = "https://api.elevenlabs.io/v1";

// GET /api/eleven-agents/calls  — list recent conversations
export async function GET() {
  if (!API_KEY) {
    return NextResponse.json(
      { conversations: [], message: "ELEVENLABS_API_KEY is not configured" },
      { status: 200 },
    );
  }

  try {
    const res = await fetch(`${BASE}/convai/conversations`, {
      headers: {
        "xi-api-key": API_KEY,
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
