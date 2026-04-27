/**
 * GET  /api/getting-started        — Caller's getting-started doc (defaulted).
 * PUT  /api/getting-started        — Upsert.
 *
 * Body for PUT:
 *   {
 *     hero_title, hero_subtitle?, hero_video_url?,
 *     contact_email?, is_public?,
 *     sections: [{ title, body_md, icon, links: [{label, href}] }],
 *     faq: [{ q, a }]
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { loadGettingStartedDoc } from "@/lib/email-templates/getting-started";

const linkSchema = z.object({
  label: z.string().min(1).max(120),
  href: z.string().url().max(500),
});

const sectionSchema = z.object({
  title: z.string().min(1).max(120),
  body_md: z.string().max(5_000),
  icon: z.string().min(1).max(40).default("Sparkles"),
  links: z.array(linkSchema).max(10).default([]),
});

const faqSchema = z.object({
  q: z.string().min(1).max(240),
  a: z.string().min(1).max(2_000),
});

const docSchema = z.object({
  hero_title: z.string().min(1).max(200),
  hero_subtitle: z.string().max(300).nullable().optional(),
  hero_video_url: z.string().url().max(500).nullable().optional(),
  contact_email: z.string().email().max(200).nullable().optional(),
  is_public: z.boolean().optional(),
  sections: z.array(sectionSchema).max(20).default([]),
  faq: z.array(faqSchema).max(30).default([]),
});

export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const doc = await loadGettingStartedDoc(supabase, ownerId);
  return NextResponse.json({ doc, public_url: `/getting-started/${ownerId}` });
}

export async function PUT(req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = docSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const upsertRow = {
    agency_owner_id: ownerId,
    slug: "main",
    hero_title: parsed.data.hero_title,
    hero_subtitle: parsed.data.hero_subtitle ?? null,
    hero_video_url: parsed.data.hero_video_url ?? null,
    contact_email: parsed.data.contact_email ?? null,
    is_public: parsed.data.is_public ?? true,
    sections: parsed.data.sections,
    faq: parsed.data.faq,
  };

  const { data, error } = await supabase
    .from("getting_started_docs")
    .upsert(upsertRow, { onConflict: "agency_owner_id,slug" })
    .select()
    .single();

  if (error) {
    console.error("[getting-started] upsert failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ doc: data });
}
