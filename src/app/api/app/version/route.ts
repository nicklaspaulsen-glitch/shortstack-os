import { NextResponse } from "next/server";

// Returns the latest app version + download URL
// Electron checks this on startup to show update notifications
// Update the version here when you publish a new .exe
//
// For web-only deploys: the build_id changes automatically on every Vercel deploy.
// Electron can compare this to detect when a cache-clear refresh is needed.
export async function GET() {
  return NextResponse.json({
    version: "1.4.0",
    build_id: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || "dev",
    download_url: "",
    release_notes: "AI Lead Engine, multi-channel outreach (email/SMS/DM/call), Twilio phone provisioning, Zernio social connect, Chrome extension, subscription header badge, agency cancel handling, build fixes",
    required: false,
    published_at: new Date().toISOString(),
  });
}
