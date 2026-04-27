/**
 * Loader for the getting_started_docs row. Always returns a complete doc —
 * if the agency hasn't customized their doc, the default from `defaults.ts`
 * is returned so the public page never 404s for an active agency.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_GETTING_STARTED } from "./defaults";
import type { GettingStartedDoc, GettingStartedSection, GettingStartedFaq } from "./types";

interface GettingStartedRow {
  id: string;
  agency_owner_id: string;
  slug: string;
  hero_title: string;
  hero_subtitle: string | null;
  hero_video_url: string | null;
  sections: unknown;
  faq: unknown;
  contact_email: string | null;
  is_public: boolean;
  updated_at: string;
  created_at: string;
}

export async function loadGettingStartedDoc(
  supabase: SupabaseClient,
  agencyOwnerId: string,
  slug = "main",
): Promise<GettingStartedDoc> {
  const { data, error } = await supabase
    .from("getting_started_docs")
    .select("*")
    .eq("agency_owner_id", agencyOwnerId)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.warn("[getting-started] loader error, using default:", error.message);
    return { ...DEFAULT_GETTING_STARTED };
  }

  if (!data) {
    return { ...DEFAULT_GETTING_STARTED };
  }

  return rowToDoc(data as GettingStartedRow);
}

/**
 * Public-read variant. Uses the anon-readable RLS policy (is_public=true).
 * Returns null when no public doc exists for this slug — the page should
 * 404 in that case.
 */
export async function loadPublicGettingStartedDoc(
  supabase: SupabaseClient,
  agencyOwnerId: string,
  slug = "main",
): Promise<GettingStartedDoc | null> {
  const { data, error } = await supabase
    .from("getting_started_docs")
    .select("*")
    .eq("agency_owner_id", agencyOwnerId)
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (error || !data) return null;
  return rowToDoc(data as GettingStartedRow);
}

function rowToDoc(row: GettingStartedRow): GettingStartedDoc {
  return {
    id: row.id,
    agency_owner_id: row.agency_owner_id,
    slug: row.slug,
    hero_title: row.hero_title || DEFAULT_GETTING_STARTED.hero_title,
    hero_subtitle: row.hero_subtitle,
    hero_video_url: row.hero_video_url,
    sections: coerceSections(row.sections),
    faq: coerceFaq(row.faq),
    contact_email: row.contact_email,
    is_public: row.is_public,
    updated_at: row.updated_at,
    created_at: row.created_at,
  };
}

function coerceSections(raw: unknown): GettingStartedSection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s) => ({
      title: typeof s.title === "string" ? s.title : "",
      body_md: typeof s.body_md === "string" ? s.body_md : "",
      icon: typeof s.icon === "string" ? s.icon : "Sparkles",
      links: Array.isArray(s.links)
        ? (s.links as unknown[])
            .filter((l): l is Record<string, unknown> => typeof l === "object" && l !== null)
            .map((l) => ({
              label: typeof l.label === "string" ? l.label : "",
              href: typeof l.href === "string" ? l.href : "",
            }))
            .filter((l) => l.label && l.href)
        : [],
    }))
    .filter((s) => s.title || s.body_md);
}

function coerceFaq(raw: unknown): GettingStartedFaq[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
    .map((f) => ({
      q: typeof f.q === "string" ? f.q : "",
      a: typeof f.a === "string" ? f.a : "",
    }))
    .filter((f) => f.q && f.a);
}
