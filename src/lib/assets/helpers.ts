import type { SupabaseClient } from "@supabase/supabase-js";

export const ASSET_TYPES = [
  "image",
  "video",
  "audio",
  "doc",
  "link",
  "3d",
  "other",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_SOURCES = [
  "ai_generated",
  "uploaded",
  "gdrive",
  "dropbox",
  "external",
  "from_review",
  "from_thumbnail_tool",
  "from_copywriter",
  "other",
] as const;

export type AssetSource = (typeof ASSET_SOURCES)[number];

export interface AssetRow {
  id: string;
  org_id: string;
  project_id: string | null;
  asset_type: AssetType;
  source: AssetSource;
  storage_url: string | null;
  thumbnail_url: string | null;
  filename: string | null;
  mime_type: string | null;
  size_bytes: number;
  tags: string[];
  description: string | null;
  ai_metadata: Record<string, unknown>;
  original_asset_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Resolve the effective "org" (owner profile id) for the caller.
 * Team members inherit their parent_agency_id; everyone else is their own org.
 */
export async function getEffectiveOrgId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("role, parent_agency_id")
    .eq("id", userId)
    .single();

  if (data?.role === "team_member" && data.parent_agency_id) {
    return data.parent_agency_id as string;
  }
  return userId;
}

/** Check whether the caller is the org admin (i.e. owner profile). */
export function isOrgAdmin(userId: string, orgId: string): boolean {
  return userId === orgId;
}
