/**
 * auto-edit-pipeline.ts — shared pipeline helpers used by the Trinity tools
 * and the `full-pass` route.
 *
 * We intentionally put the heavy lifting (Claude calls, scene synthesis,
 * query generation, Whisper formatting) in dedicated route files — see
 * `src/app/api/video/auto-edit/*`. This module exposes LIGHT-WEIGHT helpers
 * for calls that are useful to reuse from multiple places WITHOUT doing
 * an internal HTTP hop on Vercel.
 *
 * - `runFullPass` — sequence the 4 sub-calls via fetch to the same origin.
 *   Works anywhere we can form a URL; used by the full-pass route and the
 *   Trinity tools.
 */

export interface FullPassInput {
  video_url: string;
  project_id: string;
  creator_pack_id?: string;
  client_id?: string;
  auto_accept?: boolean;
  /** Forwarded cookie header so nested fetches are authenticated. */
  cookieHeader?: string;
  /** Absolute origin (protocol + host) the helpers will call against. */
  origin: string;
  /** Optional: caller already has scenes pre-computed — skip detect-scenes. */
  scenes?: unknown;
  /** Optional: pre-extracted frame samples forwarded to detect-scenes. */
  frame_samples?: Array<{ url: string; at_sec: number }>;
  /** Optional: total duration passed to detect-scenes for scene end_sec. */
  total_duration_sec?: number;
}

export interface FullPassResult {
  ok: boolean;
  steps: {
    detect_scenes?: unknown;
    suggest?: unknown;
    captions?: unknown;
    broll_candidates?: unknown;
    apply?: unknown;
  };
  errors: Array<{ step: string; error: string }>;
}

async function postJson(
  origin: string,
  path: string,
  body: Record<string, unknown>,
  cookieHeader?: string,
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  try {
    const res = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return {
      ok: res.ok,
      status: res.status,
      data,
      error: res.ok
        ? undefined
        : (data &&
            typeof data === "object" &&
            "error" in data &&
            typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : `HTTP ${res.status}`),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Sequence the four auto-edit stages as internal fetches on the same origin.
 * When `auto_accept` is true, we also call `apply` with every suggestion.
 */
export async function runFullPass(input: FullPassInput): Promise<FullPassResult> {
  const out: FullPassResult = {
    ok: true,
    steps: {},
    errors: [],
  };

  const {
    origin,
    cookieHeader,
    video_url,
    project_id,
    creator_pack_id,
    client_id,
    auto_accept,
  } = input;

  // 1. detect-scenes (unless caller provided scenes directly).
  let scenes: unknown[] = [];
  if (Array.isArray(input.scenes) && input.scenes.length > 0) {
    scenes = input.scenes;
    out.steps.detect_scenes = { ok: true, reused: true, scenes };
  } else {
    const detect = await postJson(
      origin,
      "/api/video/auto-edit/detect-scenes",
      {
        video_url,
        client_id,
        frame_samples: input.frame_samples,
        total_duration_sec: input.total_duration_sec,
      },
      cookieHeader,
    );
    out.steps.detect_scenes = detect.data;
    if (!detect.ok) {
      out.ok = false;
      out.errors.push({ step: "detect_scenes", error: detect.error || "failed" });
      return out;
    }
    const payload = detect.data as { scenes?: unknown[] } | null;
    scenes = Array.isArray(payload?.scenes) ? payload!.scenes : [];
  }

  // 2. suggest
  const suggest = await postJson(
    origin,
    "/api/video/auto-edit/suggest",
    { video_url, scenes, client_id, creator_pack_id },
    cookieHeader,
  );
  out.steps.suggest = suggest.data;
  if (!suggest.ok) {
    out.ok = false;
    out.errors.push({ step: "suggest", error: suggest.error || "failed" });
  }

  // 3. captions (best-effort — missing whisper env is not fatal)
  const captions = await postJson(
    origin,
    "/api/video/auto-edit/captions",
    {
      video_url,
      client_id,
      style_id:
        creator_pack_id === "creator_hormozi" || creator_pack_id === "creator_mrbeast"
          ? "hormozi-bounce"
          : "clean-sans",
    },
    cookieHeader,
  );
  out.steps.captions = captions.data;
  if (!captions.ok) {
    out.errors.push({ step: "captions", error: captions.error || "failed (non-fatal)" });
  }

  // 4. broll-candidates
  const broll = await postJson(
    origin,
    "/api/video/auto-edit/broll-candidates",
    { video_url, scenes, client_id },
    cookieHeader,
  );
  out.steps.broll_candidates = broll.data;
  if (!broll.ok) {
    out.errors.push({
      step: "broll_candidates",
      error: broll.error || "failed (non-fatal)",
    });
  }

  // 5. apply (optional)
  if (auto_accept && suggest.ok) {
    const suggestData = suggest.data as {
      suggestions?: Array<{ id?: string }>;
    } | null;
    const ids = Array.isArray(suggestData?.suggestions)
      ? suggestData!.suggestions
          .map((s) => (typeof s.id === "string" ? s.id : null))
          .filter((v): v is string => !!v)
      : [];
    if (ids.length > 0) {
      const apply = await postJson(
        origin,
        "/api/video/auto-edit/apply",
        {
          project_id,
          suggestion_ids: ids,
          suggestions: suggestData!.suggestions,
        },
        cookieHeader,
      );
      out.steps.apply = apply.data;
      if (!apply.ok) {
        out.ok = false;
        out.errors.push({ step: "apply", error: apply.error || "failed" });
      }
    }
  }

  return out;
}

/**
 * Compute the request origin from a Next.js request. Falls back to
 * process.env.NEXT_PUBLIC_APP_URL when header-based detection fails.
 */
export function resolveOrigin(headers: Headers): string {
  const proto = headers.get("x-forwarded-proto") || "https";
  const host = headers.get("x-forwarded-host") || headers.get("host");
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}
