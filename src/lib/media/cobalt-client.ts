/**
 * Cobalt media downloader client
 * Wraps the local cobalt API (http://localhost:9000) for downloading
 * social media content for client repurposing workflows.
 *
 * Requires cobalt Docker service running (C:\Claude\cobalt\docker-compose.yml)
 */

const COBALT_URL = process.env.COBALT_API_URL ?? "http://localhost:9000";

export interface CobaltRequest {
  url: string;
  videoQuality?: "max" | "2160" | "1440" | "1080" | "720" | "480" | "360" | "240" | "144";
  audioFormat?: "best" | "mp3" | "ogg" | "wav" | "opus";
  downloadMode?: "auto" | "audio" | "mute";
  filenameStyle?: "classic" | "pretty" | "basic" | "nerdy";
}

export interface CobaltResponse {
  status: "tunnel" | "redirect" | "stream" | "picker" | "error";
  url?: string;
  filename?: string;
  picker?: Array<{ type: string; url: string; thumb?: string }>;
  error?: { code: string };
}

export function isCobaltConfigured(): boolean {
  // Cobalt runs locally — assume configured if env not explicitly disabled
  return process.env.COBALT_DISABLED !== "1";
}

export async function downloadMedia(req: CobaltRequest): Promise<CobaltResponse> {
  const res = await fetch(COBALT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      url: req.url,
      videoQuality: req.videoQuality ?? "1080",
      audioFormat: req.audioFormat ?? "mp3",
      downloadMode: req.downloadMode ?? "auto",
      filenameStyle: req.filenameStyle ?? "pretty",
    }),
  });

  if (!res.ok) {
    throw new Error(`[cobalt] API error: ${res.status}`);
  }

  return res.json() as Promise<CobaltResponse>;
}

export async function downloadAudioOnly(url: string): Promise<CobaltResponse> {
  return downloadMedia({ url, downloadMode: "audio", audioFormat: "mp3" });
}

export async function downloadVideoMuted(url: string): Promise<CobaltResponse> {
  return downloadMedia({ url, downloadMode: "mute" });
}
