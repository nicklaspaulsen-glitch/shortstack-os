/**
 * Voice Studio preset library — 10 curated voices keyed to ElevenLabs'
 * publicly-available pre-built voices. These ship with the API (no consent
 * issues — ElevenLabs has the rights), so we expose them as system presets
 * every agency can use without uploading their own samples.
 *
 * IDs are the canonical ElevenLabs voice IDs — these are stable across the
 * Eleven v2/v3 API surfaces and have been the same for ~2 years. If they
 * ever rotate, /api/voice/presets/seed re-syncs the table with whatever IDs
 * we declare here.
 *
 * Reference: https://elevenlabs.io/docs/api-reference/voices/get-shared
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface VoicePreset {
  /** Stable preset slug used as `voice_clones.provider_voice_id` row key. */
  slug: string;
  /** Human label shown in the UI. */
  label: string;
  /** Marketing description — explains when to pick this voice. */
  description: string;
  /** Category chip on the preset card. */
  category:
    | "warm"
    | "authoritative"
    | "youthful"
    | "narrator"
    | "casual"
    | "british";
  /** Gender for filtering — derived from the ElevenLabs voice metadata. */
  gender: "female" | "male";
  /** ElevenLabs canonical voice_id. */
  elevenLabsVoiceId: string;
  /** Default language hint. ElevenLabs auto-detects but we surface it. */
  language: string;
  /** Specific use-case tags for this voice (data-driven, not category-derived). */
  useCases: string[];
  /** Category-appropriate example text used for pre-warm preview generation. */
  defaultExampleText: string;
  /** 3-4 scripts relevant to this voice's strengths — powers the Shuffle button in edit mode. */
  suggestedScripts: string[];
}

export const PRESETS: ReadonlyArray<VoicePreset> = [
  {
    slug: "preset_warm_friendly",
    label: "Preset: Warm & friendly (Aria)",
    description:
      "Calm, approachable American female. Ideal for nurture sequences and check-in voicemails.",
    category: "warm",
    gender: "female",
    elevenLabsVoiceId: "9BWtsMINqrJLrRacOk9x",
    language: "en",
    useCases: ["Follow-ups", "Voicemails", "Nurture sequences"],
    defaultExampleText:
      "Hey, just wanted to follow up on our conversation from last week. I had a few ideas I think you'll love — give me a call when you have a moment.",
    suggestedScripts: [
      "Hey, just wanted to follow up on our conversation from last week. I had a few ideas I think you'll love — give me a call when you have a moment.",
      "Hi there, thanks so much for your time today. I'll send over the details we discussed, and feel free to reach out if anything comes up.",
      "Good morning! Just a quick check-in to see how everything is going on your end. Let me know if there's anything I can help with.",
      "Hey, it's been a little while since we last connected. I'd love to catch up and hear how things are going — no rush, whenever works for you.",
    ],
  },
  {
    slug: "preset_authoritative",
    label: "Preset: Authoritative (Roger)",
    description:
      "Confident, executive American male. Best for closing calls and decision-maker outreach.",
    category: "authoritative",
    gender: "male",
    elevenLabsVoiceId: "CwhRBWXzGAHq8TQ4Fs17",
    language: "en",
    useCases: ["Sales pitches", "Decision-maker outreach", "Closing calls"],
    defaultExampleText:
      "I've reviewed your current setup, and there are three areas where we can cut costs by at least twenty percent. I'd like to walk you through the numbers this week.",
    suggestedScripts: [
      "I've reviewed your current setup, and there are three areas where we can cut costs by at least twenty percent. I'd like to walk you through the numbers this week.",
      "Based on our analysis, your team is leaving significant revenue on the table. Let's schedule thirty minutes to discuss the solution.",
      "This is a high-priority follow-up regarding the proposal we submitted. The deadline for the early commitment rate is this Friday.",
      "I want to make sure you have everything you need to present this to your board. I'll have the executive summary on your desk by tomorrow morning.",
    ],
  },
  {
    slug: "preset_youthful_energetic",
    label: "Preset: Youthful & energetic (Elli)",
    description:
      "High-energy young American female. Top-of-funnel cold calls and Gen Z DMs.",
    category: "youthful",
    gender: "female",
    elevenLabsVoiceId: "MF3mGyEYCl7XYWbV9V6O",
    language: "en",
    useCases: ["Cold calls", "Social media", "Ads", "Gen Z outreach"],
    defaultExampleText:
      "Hey! So I just saw your post and honestly, I think we'd be a perfect fit to work together. Drop me a message and let's make it happen!",
    suggestedScripts: [
      "Hey! So I just saw your post and honestly, I think we'd be a perfect fit to work together. Drop me a message and let's make it happen!",
      "Oh my gosh, you're going to love this. We just launched something brand new and I had to tell you about it right away.",
      "Quick heads up — we're running a flash deal this weekend only. If you've been thinking about it, now's the time!",
      "Hey, thanks for following us! Just wanted to personally say hi and let you know we've got some exciting stuff coming your way.",
    ],
  },
  {
    slug: "preset_narrator_deep",
    label: "Preset: Narrator (Adam)",
    description:
      "Deep, smooth American male — documentary narrator energy. Use for explainer voicemails.",
    category: "narrator",
    gender: "male",
    elevenLabsVoiceId: "pNInz6obpgDQGcFmaJgB",
    language: "en",
    useCases: ["Video narration", "Explainers", "Training modules"],
    defaultExampleText:
      "In a world where every second counts, the right tools make all the difference. Today, we'll walk you through the three features that will transform your workflow.",
    suggestedScripts: [
      "In a world where every second counts, the right tools make all the difference. Today, we'll walk you through the three features that will transform your workflow.",
      "Welcome to this week's training module. By the end of this session, you'll have a clear understanding of the new client onboarding process.",
      "The results speak for themselves. Over the last quarter, teams using this approach saw a forty percent increase in productivity.",
      "Let's take a closer look at how this works behind the scenes. The process is simpler than you might expect.",
    ],
  },
  {
    slug: "preset_natural_male",
    label: "Preset: Natural male (Antoni)",
    description:
      "Approachable American male. Sounds like a friend leaving a quick voice note.",
    category: "casual",
    gender: "male",
    elevenLabsVoiceId: "ErXwobaYiN019PkySvjV",
    language: "en",
    useCases: ["Voice notes", "DMs", "Podcasts", "Casual check-ins"],
    defaultExampleText:
      "Hey man, just leaving you a quick note. Wanted to chat about that project we were talking about — hit me back when you get a chance.",
    suggestedScripts: [
      "Hey man, just leaving you a quick note. Wanted to chat about that project we were talking about — hit me back when you get a chance.",
      "So here's what I was thinking — we keep it simple, get the basics right first, and then we can talk about scaling up later.",
      "Hey, hope you're having a good week. Just wanted to share a quick update on where things stand with the launch.",
      "Real talk, this is one of the easiest tools I've used in a while. Took me maybe five minutes to get set up.",
    ],
  },
  {
    slug: "preset_british_female",
    label: "Preset: British female (Charlotte)",
    description:
      "Composed British female. Professional, premium feel for high-ticket service offers.",
    category: "british",
    gender: "female",
    elevenLabsVoiceId: "XB0fDUnXU5powFXDhCwa",
    language: "en",
    useCases: ["Premium content", "Corporate", "High-ticket offers"],
    defaultExampleText:
      "Good afternoon. I'm reaching out regarding the proposal we discussed last Tuesday. I've prepared a revised timeline that I believe addresses your team's concerns.",
    suggestedScripts: [
      "Good afternoon. I'm reaching out regarding the proposal we discussed last Tuesday. I've prepared a revised timeline that I believe addresses your team's concerns.",
      "Thank you for considering our services. We take pride in delivering exceptional results, and I'm confident we can exceed your expectations.",
      "I wanted to personally follow up and ensure you received the materials from our last meeting. Please don't hesitate to reach out with any questions.",
      "It's been a pleasure working with your team. I've compiled a summary of our progress and next steps for your review.",
    ],
  },
  {
    slug: "preset_british_male",
    label: "Preset: British male (Daniel)",
    description:
      "Authoritative British male — newsreader energy. Use for premium B2B outreach.",
    category: "british",
    gender: "male",
    elevenLabsVoiceId: "onwK4e9ZLuTAKqWW03F9",
    language: "en",
    useCases: ["B2B outreach", "Premium branding", "Announcements"],
    defaultExampleText:
      "I'm pleased to inform you that your application has been approved. Our team will be in touch shortly to discuss the next steps in the onboarding process.",
    suggestedScripts: [
      "I'm pleased to inform you that your application has been approved. Our team will be in touch shortly to discuss the next steps in the onboarding process.",
      "Good morning. This is a brief update on the strategic initiative we outlined at last month's quarterly review.",
      "We've conducted a thorough analysis of your requirements and have prepared a comprehensive solution that I believe warrants your attention.",
      "On behalf of the leadership team, I'd like to extend an invitation to our annual strategy summit taking place next month.",
    ],
  },
  {
    slug: "preset_warm_male",
    label: "Preset: Warm male (Josh)",
    description:
      "Calm American male. Solid default for check-ins and friendly follow-ups.",
    category: "warm",
    gender: "male",
    elevenLabsVoiceId: "TxGEqnHWrfWFTfGW9XjX",
    language: "en",
    useCases: ["Check-ins", "Follow-ups", "Reminders"],
    defaultExampleText:
      "Hey, just checking in to see how things went with the meeting yesterday. Let me know if there's anything else you need from my end.",
    suggestedScripts: [
      "Hey, just checking in to see how things went with the meeting yesterday. Let me know if there's anything else you need from my end.",
      "Good morning, just a friendly reminder about our call tomorrow at ten. Looking forward to catching up with you.",
      "Hi there, I know things have been busy, so I just wanted to send a quick note to say I'm here if you need anything.",
      "Thanks for getting back to me so quickly. I really appreciate it — let's keep the momentum going this week.",
    ],
  },
  {
    slug: "preset_youthful_female",
    label: "Preset: Youthful female (Bella)",
    description:
      "Lively American female. Great for SMS voice notes and consumer-facing brands.",
    category: "youthful",
    gender: "female",
    elevenLabsVoiceId: "EXAVITQu4vr4xnSDxMaL",
    language: "en",
    useCases: ["SMS voice notes", "Consumer brands", "Event invites"],
    defaultExampleText:
      "Hi! Just wanted to let you know about something really cool we have coming up. You're definitely going to want to be there!",
    suggestedScripts: [
      "Hi! Just wanted to let you know about something really cool we have coming up. You're definitely going to want to be there!",
      "Hey, thanks for signing up! I'm so excited to have you on board. Here's a quick rundown of what to expect next.",
      "Okay, so this is literally the easiest thing ever. Just tap the link I sent you and you're all set — takes like two seconds.",
      "Happy Friday! Just popping in to say thanks for being awesome. We've got a little surprise coming your way soon.",
    ],
  },
  {
    slug: "preset_narrator_clear",
    label: "Preset: Narrator clear (Rachel)",
    description:
      "Crisp American female. Reads numbers and proper nouns cleanly — best for stat-heavy voicemails.",
    category: "narrator",
    gender: "female",
    elevenLabsVoiceId: "21m00Tcm4TlvDq8ikWAM",
    language: "en",
    useCases: ["Data-heavy scripts", "Reports", "Stat voicemails"],
    defaultExampleText:
      "Your monthly report is ready. Revenue increased twelve percent over last quarter, with the strongest growth in the enterprise segment at twenty-three percent.",
    suggestedScripts: [
      "Your monthly report is ready. Revenue increased twelve percent over last quarter, with the strongest growth in the enterprise segment at twenty-three percent.",
      "Here's your weekly performance summary. Total leads generated: one hundred forty-seven. Conversion rate: eight point three percent. Pipeline value: four hundred twelve thousand dollars.",
      "This quarter, your team completed ninety-six percent of deliverables on schedule. Three items remain in progress with expected completion by Friday.",
      "The system update was deployed successfully at two fifteen PM Eastern. All services are operational. Response times have improved by thirty-one percent.",
    ],
  },
];

/**
 * Fetch ElevenLabs preview URLs for all presets in a single parallel batch.
 * Returns a map of elevenLabsVoiceId → preview_url. Soft-fails: if the API
 * key is absent or any request fails, that entry is simply absent from the
 * map and the caller falls back gracefully.
 */
async function fetchElevenLabsPreviewUrls(
  voiceIds: string[],
): Promise<Record<string, string>> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return {};

  const out: Record<string, string> = {};

  await Promise.allSettled(
    voiceIds.map(async (id) => {
      try {
        const res = await fetch(`https://api.elevenlabs.io/v1/voices/${id}`, {
          headers: { "xi-api-key": apiKey },
          signal: AbortSignal.timeout(5_000),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { preview_url?: string };
        if (data.preview_url) out[id] = data.preview_url;
      } catch {
        // Soft-fail — missing preview_url is not blocking.
      }
    }),
  );

  return out;
}

/**
 * Idempotent preset seeder. Called from `/api/voice/presets/seed` (admin) and
 * lazily from the dashboard mount when no preset rows exist yet for the
 * current agency owner.
 *
 * Presets are stored as voice_clones rows with owner_subject_kind='preset'.
 * Every agency owner gets their own copy of the preset row so RLS keeps
 * SELECT/UPDATE policies straightforward — the read-everyone RLS policy
 * surfaces them all to other tenants without leaking ownership semantics.
 *
 * Re-runs are safe: we look up by (agency_owner_id, provider_voice_id) and
 * skip rows that already exist. Existing rows that are missing preview_url in
 * consent_evidence are back-filled in the same pass.
 */
export async function ensurePresetsSeeded(
  service: SupabaseClient,
  agencyOwnerId: string,
): Promise<{ inserted: number; existing: number; backfilled: number }> {
  let inserted = 0;
  let existing = 0;
  let backfilled = 0;

  // Fetch ElevenLabs preview URLs once for all voice IDs in the library.
  const uniqueVoiceIds = Array.from(new Set(PRESETS.map((p) => p.elevenLabsVoiceId)));
  const previewUrls = await fetchElevenLabsPreviewUrls(uniqueVoiceIds);

  for (const preset of PRESETS) {
    const { data: row } = await service
      .from("voice_clones")
      .select("id, consent_evidence")
      .eq("agency_owner_id", agencyOwnerId)
      .eq("owner_subject_kind", "preset")
      .eq("provider_voice_id", preset.slug)
      .maybeSingle();

    if (row) {
      existing += 1;

      // Back-fill missing fields into consent_evidence.
      const evidence = (row.consent_evidence ?? {}) as Record<string, unknown>;
      const storedUrl = evidence.preview_url as string | undefined;
      const fetchedUrl = previewUrls[preset.elevenLabsVoiceId];

      const needsPreviewUrl = !storedUrl && fetchedUrl;
      const needsUseCases = !evidence.use_cases;
      const needsDefaultText = !evidence.default_example_text;
      const needsScripts = !evidence.suggested_scripts;

      if (needsPreviewUrl || needsUseCases || needsDefaultText || needsScripts) {
        const patch: Record<string, unknown> = { ...evidence };
        if (needsPreviewUrl) patch.preview_url = fetchedUrl;
        if (needsUseCases) patch.use_cases = preset.useCases;
        if (needsDefaultText) patch.default_example_text = preset.defaultExampleText;
        if (needsScripts) patch.suggested_scripts = preset.suggestedScripts;

        const { error: updateErr } = await service
          .from("voice_clones")
          .update({ consent_evidence: patch })
          .eq("id", row.id);

        if (!updateErr) {
          backfilled += 1;
        } else {
          console.error(
            `[voice/preset-library] back-fill failed for ${preset.slug}:`,
            updateErr.message,
          );
        }
      }

      continue;
    }

    const previewUrl = previewUrls[preset.elevenLabsVoiceId];

    const { error } = await service.from("voice_clones").insert({
      agency_owner_id: agencyOwnerId,
      owner_subject_kind: "preset",
      owner_subject_id: null,
      label: preset.label,
      description: preset.description,
      provider: "preset",
      provider_voice_id: preset.slug,
      status: "ready",
      language: preset.language,
      consent_kind: "preset",
      consent_evidence: {
        source: "elevenlabs_public_voice",
        elevenlabs_voice_id: preset.elevenLabsVoiceId,
        category: preset.category,
        gender: preset.gender,
        use_cases: preset.useCases,
        default_example_text: preset.defaultExampleText,
        suggested_scripts: preset.suggestedScripts,
        ...(previewUrl ? { preview_url: previewUrl } : {}),
      },
      ready_at: new Date().toISOString(),
    });

    if (!error) {
      inserted += 1;
    } else {
      // Log + continue — one preset failing should not block the others.
      console.error(
        `[voice/preset-library] seed failed for ${preset.slug}:`,
        error.message,
      );
    }
  }

  return { inserted, existing, backfilled };
}

/**
 * Resolve the underlying ElevenLabs voice id for a preset slug. Returns null
 * if the slug isn't in the curated list (caller should fall back gracefully).
 */
export function elevenLabsVoiceIdFromPresetSlug(slug: string): string | null {
  const preset = PRESETS.find((p) => p.slug === slug);
  return preset?.elevenLabsVoiceId ?? null;
}

/**
 * Look up the full preset definition by slug. Used by the UI to get
 * use-case tags, suggested scripts, and default example text without
 * needing an extra DB round-trip (these values are embedded in the
 * consent_evidence JSONB, but the canonical source is this file).
 */
export function presetBySlug(slug: string): VoicePreset | null {
  return PRESETS.find((p) => p.slug === slug) ?? null;
}
