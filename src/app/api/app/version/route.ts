import { NextResponse } from "next/server";

// Returns the latest app version + download URL
// Electron checks this on startup to show update notifications
export async function GET() {
  return NextResponse.json({
    version: "1.0.0",
    download_url: "https://shortstack-os.vercel.app/downloads/ShortStack-OS-Setup.exe",
    release_notes: "Initial release — UI redesign, license system, AI workflow agent",
    required: false,
    published_at: new Date().toISOString(),
  });
}
