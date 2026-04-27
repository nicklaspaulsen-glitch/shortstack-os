// Shared type contracts between content script, background SW, popup,
// and the ShortStack backend. Keep this file dependency-free so it can
// be imported from any context.

export interface ProspectData {
  fullName: string;
  firstName?: string;
  lastName?: string;
  headline: string;
  company: string;
  role: string;
  location: string;
  linkedinUrl: string;
  profileImageUrl?: string;
  pageTitle: string;
  detectedAt: number;
}

export interface SaveLeadPayload {
  business_name: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  source_url: string;
  detected_from: "linkedin_profile" | "manual" | "selection";
  // Anything extra goes into metadata server-side
  headline?: string;
  role?: string;
  location?: string;
  profile_image_url?: string;
}

export interface ResearchResult {
  company_data: {
    name: string;
    description?: string;
    industry?: string;
    size?: string;
    website?: string;
  } | null;
  recent_news: string[];
  suggested_opener: string;
  best_time: string;
  generated_at: number;
}

export type AuthState =
  | { connected: false; reason: "no_token" | "expired" | "unknown" }
  | { connected: true; userEmail?: string };

// ─── Message protocol ────────────────────────────────────────────────
// Discriminated unions keep the dispatch in background.ts type-safe.

export interface MsgGetProspect {
  type: "GET_PROSPECT";
}
export interface MsgSaveLead {
  type: "SAVE_LEAD";
  payload: SaveLeadPayload;
}
export interface MsgResearchProspect {
  type: "RESEARCH_PROSPECT";
  payload: {
    linkedin_url: string;
    name: string;
    company: string;
  };
}
export interface MsgCheckAuth {
  type: "CHECK_AUTH";
}
export interface MsgOpenLogin {
  type: "OPEN_LOGIN";
}
export interface MsgSearchLeads {
  type: "SEARCH_LEADS";
  payload: { query: string };
}

export type ExtensionMessage =
  | MsgGetProspect
  | MsgSaveLead
  | MsgResearchProspect
  | MsgCheckAuth
  | MsgOpenLogin
  | MsgSearchLeads;

// Discriminated success/failure envelope. Background returns these to
// the popup and content script callers via chrome.runtime.sendMessage.
export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: string };
export type ApiResult<T> = ApiOk<T> | ApiErr;

export interface LeadSummary {
  id: string;
  business_name: string;
  email: string | null;
}
