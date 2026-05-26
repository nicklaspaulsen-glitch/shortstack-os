import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { uploadToR2 } from "@/lib/server/r2-client";
import { trainClone } from "@/lib/voice/clone-router";
import { ensurePresetsSeeded } from "@/lib/voice/preset-library";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/voice/clones
 *
 * Returns the agency's clones (My Voices) plus the preset library. The preset
 * RLS policy (`voice_clones_preset_read`) opens up read access for every
 * authenticated caller so the same query naturally surfaces both.
 *
 * Response shape: { mine: VoiceCloneRow[], presets: VoiceCloneRow[] }
 */
export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();

  // Lazy preset seeding — first call from this owner populates the catalog.
  await ensurePresetsSeeded(service, ownerId).catch((err) => {
    console.error("[voice/clones GET] preset seed failed:", err);
  });

  // RLS-guarded read via authenticated supabase client (not service role).
  const { data: rows, error } = await supabase
    .from("voice_clones")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: `Failed to load clones: ${error.message}` },
      { status: 500 },
    );
  }

  const all = rows || [];
  const mine = all.filter((r) => r.owner_subject_kind !== "preset");
  const presets = all.filter((r) => r.owner_subject_kind === "preset");

  return NextResponse.json({ mine, presets });
}

const MAX_SAMPLE_BYTES = 10 * 1024 * 1024; // 10MB per sample
const MAX_TOTAL_BYTES = 30 * 1024 * 1024; // 30MB across all samples
const ALLOWED_MIME_PREFIXES = ["audio/"] as const;

/**
 * POST /api/voice/clones
 *
 * Multipart form-data:
 *   label              (required, string)
 *   description        (optional)
 *   consent_kind       (required: 'self' | 'client_signed' | 'team_member_signed')
 *   consent_evidence   (JSON string for non-self consent)
 *   owner_subject_kind (optional: 'user' | 'team_member' | 'client')
 *   owner_subject_id   (optional uuid)
 *   language           (optional default 'en')
 *   provider           (optional override)
 *   samples            (one or more File parts, audio/*)
 *
 * Returns: { clone_id, provider, status, provider_voice_id }
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const label = (form.get("label") as string | null)?.trim() || "";
  if (!label) {
    return NextResponse.json({ error: "Missing 'label'" }, { status: 400 });
  }
  if (label.length > 120) {
    return NextResponse.json({ error: "label exceeds 120 chars" }, { status: 400 });
  }

  const consentKindRaw = (form.get("consent_kind") as string | null) || "";
  if (!["self", "client_signed", "team_member_signed"].includes(consentKindRaw)) {
    return NextResponse.json(
      {
        error:
          "consent_kind must be 'self', 'client_signed', or 'team_member_signed'.",
      },
      { status: 400 },
    );
  }
  const consentKind = consentKindRaw as
    | "self"
    | "client_signed"
    | "team_member_signed";

  let consentEvidence: Record<string, unknown> = {};
  const consentEvidenceRaw = form.get("consent_evidence") as string | null;
  if (consentEvidenceRaw) {
    try {
      consentEvidence = JSON.parse(consentEvidenceRaw) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "consent_evidence must be valid JSON" },
        { status: 400 },
      );
    }
  }

  // Enforce signed-consent payload at the route boundary so the lib layer
  // doesn't need to second-guess.
  if (consentKind !== "self") {
    if (!consentEvidence || Object.keys(consentEvidence).length === 0) {
      return NextResponse.json(
        {
          error:
            "consent_kind=signed requires consent_evidence (signed_by, signed_at, ip).",
        },
        { status: 400 },
      );
    }
  }

  const language = (form.get("language") as string | null) || "en";
  const description = (form.get("description") as string | null) || undefined;

  const ownerSubjectKindRaw = (form.get("owner_subject_kind") as string | null) || "";
  const ownerSubjectId = (form.get("owner_subject_id") as string | null) || "";
  let ownerSubject:
    | { kind: "user" | "team_member" | "client"; id: string }
    | undefined;
  if (ownerSubjectKindRaw && ownerSubjectId) {
    if (
      ownerSubjectKindRaw !== "user" &&
      ownerSubjectKindRaw !== "team_member" &&
      ownerSubjectKindRaw !== "client"
    ) {
      return NextResponse.json(
        { error: "owner_subject_kind must be 'user' | 'team_member' | 'client'." },
        { status: 400 },
      );
    }
    ownerSubject = {
      kind: ownerSubjectKindRaw,
      id: ownerSubjectId,
    };
  }

  const providerRaw = (form.get("provider") as string | null) || "";
  const provider =
    providerRaw === "runpod_f5tts" ||
    providerRaw === "runpod_openvoice" ||
    providerRaw === "runpod_xtts" ||
    providerRaw === "elevenlabs"
      ? providerRaw
      : undefined;

  const samples = form.getAll("samples").filter((v): v is File => v instanceof File);
  if (samples.length === 0) {
    return NextResponse.json(
      { error: "At least one sample required (file part 'samples')." },
      { status: 400 },
    );
  }
  if (samples.length > 10) {
    return NextResponse.json(
      { error: "Max 10 sample files per upload." },
      { status: 400 },
    );
  }

  let totalBytes = 0;
  for (const f of samples) {
    if (!ALLOWED_MIME_PREFIXES.some((p) => (f.type || "").startsWith(p))) {
      return NextResponse.json(
        { error: `Sample '${f.name}' has unsupported MIME ${f.type || "?"}` },
        { status: 415 },
      );
    }
    if (f.size > MAX_SAMPLE_BYTES) {
      return NextResponse.json(
        { error: `Sample '${f.name}' exceeds 10MB.` },
        { status: 413 },
      );
    }
    totalBytes += f.size;
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: "Total sample bytes exceed 30MB cap." },
      { status: 413 },
    );
  }

  // Upload to R2.
  const ts = Date.now();
  const sampleR2Keys: string[] = [];
  const sampleBuffers: Array<{
    buffer: Buffer;
    filename: string;
    contentType: string;
  }> = [];

  for (let i = 0; i < samples.length; i += 1) {
    const file = samples[i];
    const arr = await file.arrayBuffer();
    const buffer = Buffer.from(arr);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const key = `voice-samples/${ownerId}/${ts}-${i}-${safeName}`;
    try {
      await uploadToR2(key, buffer, file.type || "audio/mpeg");
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown_error";
      return NextResponse.json(
        { error: `R2 upload failed: ${reason}` },
        { status: 502 },
      );
    }
    sampleR2Keys.push(key);
    sampleBuffers.push({
      buffer,
      filename: safeName,
      contentType: file.type || "audio/mpeg",
    });
  }

  try {
    const result = await trainClone({
      agencyOwnerId: ownerId,
      label,
      description,
      consentKind,
      consentEvidence,
      ownerSubject,
      language,
      sampleR2Keys,
      sampleBuffers,
      provider,
    });

    return NextResponse.json({
      clone_id: result.cloneId,
      provider: result.provider,
      status: result.status,
      provider_voice_id: result.providerVoiceId,
      failed_reason: result.failedReason || null,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
