import { NextResponse } from "next/server";

// Returns the latest app version + download URL
// Electron checks this on startup to show update notifications
export async function GET() {
  return NextResponse.json({
    version: "1.1.0",
    download_url: "https://shortstack-os.vercel.app/downloads/ShortStack-OS-Setup.exe",
    release_notes: "AI Social Manager, Analytics, Proposals, DM Automations, Notifications, Reviews, Competitor Spy, 20+ new features",
    required: false,
    published_at: new Date().toISOString(),
  });
}
