import { NextResponse } from "next/server";

// Returns the latest app version + download URL
// Electron checks this on startup to show update notifications
// Update the version here when you publish a new .exe
export async function GET() {
  return NextResponse.json({
    version: "1.2.0",
    download_url: "https://github.com/nicklaspaulsen-glitch/shortstack-os/releases/latest/download/ShortStack-OS-Setup.exe",
    release_notes: "Outreach Logs, AI Insights, Compact UI, Soothing SFX, Social Manager, ElevenLabs Voice",
    required: false,
    published_at: "2026-04-06T12:00:00Z",
  });
}
