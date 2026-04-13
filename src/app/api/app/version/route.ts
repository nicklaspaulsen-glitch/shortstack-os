import { NextResponse } from "next/server";

// Returns the latest app version + download URL
// Electron checks this on startup to show update notifications
// Update the version here when you publish a new .exe
//
// IMPORTANT: Only set `version` when `download_url` points to an actual
// installer (.exe). The old packaged Electron build checks:
//   if (data.version && data.version !== APP_VERSION)
// If version is set but download_url is empty, the update dialog appears
// but can never complete — causing an infinite loop of prompts.
//
// For web-only deploys: the build_id changes automatically on every Vercel
// deploy. Electron's web deploy checker compares build_id to show a subtle
// refresh banner (no blocking dialog).
export async function GET() {
  const download_url = ""; // Set to GitHub Release .exe URL when publishing
  return NextResponse.json({
    // Only advertise a version when there's an actual installer to download.
    // Empty string → Electron skips the update dialog entirely.
    version: download_url ? "1.4.0" : "",
    build_id: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || "dev",
    download_url,
    release_notes: "AI Lead Engine, multi-channel outreach (email/SMS/DM/call), Twilio phone provisioning, Zernio social connect, Chrome extension, subscription header badge, agency cancel handling, build fixes",
    required: false,
    published_at: new Date().toISOString(),
  });
}
