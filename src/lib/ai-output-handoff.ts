/*
  ai-output-handoff.ts
  ────────────────────
  Client helpers for the "Edit after AI" flow. Call `startHandoff` on the
  generator side to stash an AI output payload, then navigate to the editor
  with `?from=<id>`. On the editor side, call `loadHandoff` inside an effect
  to pull the payload back.

  For small payloads (<6KB after base64) we skip the round-trip and just
  stuff the JSON into `?data=<base64>` instead. The editor's `loadHandoff`
  reads whichever is present. This keeps the happy path fast and keeps the
  DB out of the loop for tiny things like plain caption text.
*/

type HandoffKind = "thumbnail" | "video" | "script" | "image" | "caption";

const SMALL_INLINE_LIMIT = 6000; // bytes of base64 — URL still fits most browsers

function encodeInline(payload: unknown): string {
  const json = JSON.stringify(payload);
  // btoa can't handle unicode directly — normalise via TextEncoder.
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decodeInline(b64: string): unknown {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

/**
 * Create a handoff and return the URL-query fragment to append to the
 * editor URL. Small payloads get inlined; large ones hit the DB.
 *
 * Example:
 *   const q = await startHandoff("thumbnail", { layers });
 *   router.push(`/dashboard/thumbnail-generator${q}`);
 */
export async function startHandoff(
  kind: HandoffKind,
  payload: unknown,
): Promise<string> {
  const inline = encodeInline(payload);
  if (inline.length <= SMALL_INLINE_LIMIT) {
    return `?data=${encodeURIComponent(inline)}&kind=${kind}`;
  }
  const res = await fetch("/api/ai-output-handoffs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed" }));
    throw new Error(err.error || `Handoff failed (HTTP ${res.status})`);
  }
  const { id } = await res.json();
  return `?from=${id}&kind=${kind}`;
}

/**
 * Pull a handoff back on the editor side. Returns null if nothing is present
 * in the URL. Throws on expired / malformed data so the caller can toast.
 */
export async function loadHandoff(
  searchParams: URLSearchParams,
): Promise<{ kind: HandoffKind; payload: unknown } | null> {
  const kindStr = searchParams.get("kind");
  const allowed = new Set(["thumbnail", "video", "script", "image", "caption"]);
  const kind: HandoffKind | null = kindStr && allowed.has(kindStr)
    ? (kindStr as HandoffKind)
    : null;

  const inline = searchParams.get("data");
  if (inline) {
    try {
      const payload = decodeInline(decodeURIComponent(inline));
      return { kind: kind ?? "image", payload };
    } catch {
      throw new Error("Invalid handoff data");
    }
  }

  const id = searchParams.get("from");
  if (!id) return null;

  const res = await fetch(`/api/ai-output-handoffs?id=${encodeURIComponent(id)}`);
  if (res.status === 410) throw new Error("This edit link has expired");
  if (res.status === 404) throw new Error("Edit handoff not found");
  if (!res.ok) throw new Error(`Failed to load handoff (HTTP ${res.status})`);
  const json = await res.json();
  return {
    kind: (json.handoff?.kind as HandoffKind) ?? (kind ?? "image"),
    payload: json.handoff?.payload,
  };
}
