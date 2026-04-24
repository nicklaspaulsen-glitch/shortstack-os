// Shared types for showcase / case-study feature.

export interface CaseStudyMetric {
  label: string;
  value: string;
  delta?: string | null;
}

export interface CaseStudy {
  id: string;
  org_id: string;
  project_id: string | null;
  title: string;
  subtitle: string | null;
  slug: string;
  hero_image_url: string | null;
  hero_video_url: string | null;
  summary: string | null;
  body_markdown: string | null;
  metrics: CaseStudyMetric[];
  testimonial: string | null;
  testimonial_author: string | null;
  testimonial_role: string | null;
  testimonial_avatar_url: string | null;
  client_name: string | null;
  client_logo_url: string | null;
  industry_tags: string[];
  service_tags: string[];
  published: boolean;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AssetType = "image" | "video" | "embed";

export interface CaseStudyAsset {
  id: string;
  case_study_id: string;
  asset_url: string;
  asset_type: AssetType;
  caption: string | null;
  position: number;
  created_at: string;
}

// Payload returned from /api/showcase/generate-from-project — not persisted.
export interface GeneratedCaseStudyDraft {
  title: string;
  subtitle: string;
  summary: string;
  body_markdown: string;
  metrics: CaseStudyMetric[];
  industry_tags: string[];
  service_tags: string[];
  seo_title: string;
  seo_description: string;
}
