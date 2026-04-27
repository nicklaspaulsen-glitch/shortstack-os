/**
 * Fetch meeting recordings from Zoom / Google Meet / Loom share URLs.
 *
 * v1 keeps this deliberately simple:
 *   - Zoom share links with `?pwd=...` and direct download URLs work if
 *     the link is publicly accessible (no SSO).
 *   - Loom share pages embed the MP4 in og:video metadata — we extract
 *     and fetch that.
 *   - Google Meet recordings live in the recorder's Google Drive. We
 *     only support pre-shared MP4 URLs in v1; Drive OAuth is v2.
 *
 * SSRF-hardened via `assertSafeFetchUrl` so callers can't redirect us
 * to internal IPs.
 */
import { assertSafeFetchUrl } from "@/lib/security/ssrf";

const MAX_BYTES = 250 * 1024 * 1024; // mirror upload route cap

export type MeetingUrlSource =
  | "zoom_url"
  | "meet_url"
  | "loom_url"
  | "manual";

export interface FetchedRecording {
  /** The actual blob with audio/video content. */
  blob: Blob;
  /** Inferred or original filename. */
  filename: string;
  /** MIME content-type as reported by the server. */
  contentType: string;
  /** Source classification — used to populate `meetings.source_type`. */
  sourceType: MeetingUrlSource;
}

/** Inspect a URL and classify which provider it points at. */
export function classifyMeetingUrl(url: string): MeetingUrlSource {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "manual";
  }
  const host = parsed.hostname.toLowerCase();
  if (host.endsWith("zoom.us") || host.endsWith("zoom.com")) return "zoom_url";
  if (host.endsWith("loom.com") || host === "www.loom.com") return "loom_url";
  if (
    host.endsWith("meet.google.com") ||
    host.endsWith("drive.google.com") ||
    host.endsWith("googleapis.com")
  ) {
    return "meet_url";
  }
  return "manual";
}

/**
 * Resolve a share URL to a direct media URL we can download. Different
 * providers obscure the actual file in different ways.
 */
async function resolveMediaUrl(input: string): Promise<string> {
  const source = classifyMeetingUrl(input);

  if (source === "loom_url") {
    // Loom share pages embed the mp4 in og:video metadata.
    const safe = assertSafeFetchUrl(input);
    const html = await fetch(safe, { redirect: "follow" }).then((r) => r.text());
    const match = html.match(/property=["']og:video["']\s+content=["']([^"']+)["']/);
    if (match) return match[1];
    // Fallback: try the v1 transcoded mp4 endpoint based on share-id pattern.
    const idMatch = input.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
    if (idMatch) {
      return `https://cdn.loom.com/sessions/thumbnails/${idMatch[1]}-with-play.mp4`;
    }
    throw new Error("Could not extract Loom video URL from share page");
  }

  // Zoom / Meet / manual: assume the URL is already direct.
  return input;
}

/**
 * Download a recording from a share URL. Caller is responsible for
 * uploading the returned blob to storage.
 */
export async function fetchMeetingFromUrl(input: string): Promise<FetchedRecording> {
  const sourceType = classifyMeetingUrl(input);
  const directUrl = await resolveMediaUrl(input);
  const safeUrl = assertSafeFetchUrl(directUrl);

  const res = await fetch(safeUrl, {
    redirect: "follow",
    // 5 min cap mirrors the route maxDuration. Vercel kills us at 5 min anyway.
    signal: AbortSignal.timeout(5 * 60 * 1000),
  });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch recording (${res.status} ${res.statusText})`,
    );
  }

  // Reject early if the upstream says the body is huge.
  const contentLength = Number(res.headers.get("content-length") || 0);
  if (contentLength && contentLength > MAX_BYTES) {
    throw new Error(
      `Recording exceeds 250 MB limit (got ${(contentLength / 1024 / 1024).toFixed(0)} MB)`,
    );
  }

  const blob = await res.blob();
  if (blob.size > MAX_BYTES) {
    throw new Error(
      `Recording exceeds 250 MB limit (got ${(blob.size / 1024 / 1024).toFixed(0)} MB)`,
    );
  }
  if (blob.size === 0) {
    throw new Error("Downloaded recording is empty");
  }

  const contentType = res.headers.get("content-type") || blob.type || "audio/mpeg";

  // Best-effort filename extraction.
  const cdMatch = (res.headers.get("content-disposition") || "").match(/filename="?([^";]+)"?/);
  const fromHeader = cdMatch?.[1];
  const fromUrl = (() => {
    try {
      const last = new URL(safeUrl).pathname.split("/").filter(Boolean).pop();
      return last ? decodeURIComponent(last) : null;
    } catch {
      return null;
    }
  })();
  const ext = guessExt(contentType);
  const filename = (fromHeader || fromUrl || `recording.${ext}`).replace(
    /[^a-zA-Z0-9._-]/g,
    "_",
  );

  return { blob, filename, contentType, sourceType };
}

function guessExt(contentType: string): string {
  const lower = contentType.toLowerCase();
  if (lower.includes("mp3") || lower.includes("mpeg")) return "mp3";
  if (lower.includes("mp4")) return "mp4";
  if (lower.includes("webm")) return "webm";
  if (lower.includes("m4a") || lower.includes("aac")) return "m4a";
  if (lower.includes("ogg")) return "ogg";
  if (lower.includes("wav")) return "wav";
  return "bin";
}
