// Creative Review Tool — shared types

export type ReviewAssetType = "video" | "image" | "pdf" | "audio";
export type ReviewStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "revisions_requested"
  | "archived";

export interface ReviewSession {
  id: string;
  project_id: string | null;
  title: string;
  asset_url: string;
  asset_type: ReviewAssetType;
  version: number;
  status: ReviewStatus;
  magic_link_token: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by_name: string | null;
}

export interface ReviewVersion {
  id: string;
  session_id: string;
  version: number;
  asset_url: string;
  uploaded_at: string;
  uploaded_by: string | null;
  release_notes: string | null;
}

export interface ReviewRegion {
  x: number; // percent 0..100
  y: number;
  w: number;
  h: number;
}

export interface ReviewComment {
  id: string;
  session_id: string;
  version: number;
  author_id: string | null;
  author_name: string;
  author_email: string | null;
  content: string;
  timestamp_seconds: number | null;
  region: ReviewRegion | null;
  page_number: number | null;
  thread_parent_id: string | null;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

// Public (anonymous client) view — omits internal fields
export interface PublicReviewSession {
  id: string;
  title: string;
  asset_url: string;
  asset_type: ReviewAssetType;
  version: number;
  status: ReviewStatus;
  created_at: string;
  approved_at: string | null;
  approved_by_name: string | null;
  versions: Array<Pick<ReviewVersion, "version" | "asset_url" | "uploaded_at" | "release_notes">>;
}
