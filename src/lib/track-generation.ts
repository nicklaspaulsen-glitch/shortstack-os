// Client-side helper to log a generation
export async function trackGeneration(data: {
  category: string; // "video" | "ad_copy" | "thumbnail" | "email" | "script" | "social_post" | "landing_page"
  title: string;
  source_tool: string; // Which page/tool created it, e.g. "Video Editor"
  content_preview?: string; // First 200 chars of content
  metadata?: Record<string, unknown>;
}) {
  try {
    await fetch("/api/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    /* silent — don't break the main flow */
  }
}
