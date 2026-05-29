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

import {
  getCaptionStyleForEditingStyle,
  getStyleForCreatorPack,
} from "@/lib/video-presets/editing-styles";

export interface FullPassInput {
  video_url: string;
  project_id: string;
  creator_pack_id?: string;
  /** Genre-level editing style preset id (e.g. "style_gaming_montage"). */
  editing_style_id?: string;
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
    analyze?: unknown;
    suggest?: unknown;
    library?: unknown;
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
    editing_style_id,
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

  // 2. analyze — second-pass director intelligence (best-effort, non-fatal)
  const analyze = await postJson(
    origin,
    "/api/video/auto-edit/analyze",
    {
      scenes,
      client_id,
      frame_samples: input.frame_samples,
      total_duration_sec: input.total_duration_sec,
    },
    cookieHeader,
  );
  out.steps.analyze = analyze.data;
  if (analyze.ok) {
    // Replace scenes with enriched ones (they have director intelligence)
    const analyzePayload = analyze.data as { scenes?: unknown[] } | null;
    if (Array.isArray(analyzePayload?.scenes) && analyzePayload!.scenes.length > 0) {
      scenes = analyzePayload!.scenes;
    }
  } else {
    out.errors.push({ step: "analyze", error: analyze.error || "failed (non-fatal)" });
  }

  // 3. suggest
  const suggest = await postJson(
    origin,
    "/api/video/auto-edit/suggest",
    { video_url, scenes, client_id, creator_pack_id, editing_style_id },
    cookieHeader,
  );
  out.steps.suggest = suggest.data;
  if (!suggest.ok) {
    out.ok = false;
    out.errors.push({ step: "suggest", error: suggest.error || "failed" });
  }

  // 4. captions (best-effort — missing whisper env is not fatal)
  // Resolve caption style: explicit editing style > inferred from creator pack > fallback
  const resolvedCaptionStyle = editing_style_id
    ? getCaptionStyleForEditingStyle(editing_style_id)
    : creator_pack_id
      ? (getStyleForCreatorPack(creator_pack_id)?.captions.styleId ?? "clean-sans")
      : "clean-sans";

  const captions = await postJson(
    origin,
    "/api/video/auto-edit/captions",
    {
      video_url,
      client_id,
      style_id: resolvedCaptionStyle,
    },
    cookieHeader,
  );
  out.steps.captions = captions.data;
  if (!captions.ok) {
    out.errors.push({ step: "captions", error: captions.error || "failed (non-fatal)" });
  }

  // 5. broll-candidates
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

  // 6. library — organize suggestions into selectable edit decisions
  if (suggest.ok) {
    const suggestPayload = suggest.data as { suggestions?: unknown[] } | null;
    if (Array.isArray(suggestPayload?.suggestions)) {
      const libraryResult = await postJson(
        origin,
        "/api/video/auto-edit/library",
        {
          scenes,
          suggestions: suggestPayload!.suggestions,
          min_confidence: 0.5,
          max_alternatives: 3,
        },
        cookieHeader,
      );
      out.steps.library = libraryResult.data;
      if (!libraryResult.ok) {
        out.errors.push({ step: "library", error: libraryResult.error || "failed (non-fatal)" });
      }
    }
  }

  // 7. apply (optional)
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
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://app.shortstack.work";
}
