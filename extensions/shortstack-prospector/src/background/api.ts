import { getSettings } from "../shared/config";
import { getAccessToken } from "./auth";
import type {
  LeadSummary,
  ResearchResult,
  SaveLeadPayload,
} from "../shared/types";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new ApiError(
      "Not signed in. Open ShortStack to sign in, then try again.",
      401,
    );
  }

  const { baseUrl } = await getSettings();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // ignore — non-JSON body
  }

  if (!res.ok) {
    let errMsg = `Request failed with status ${res.status}`;
    if (
      json &&
      typeof json === "object" &&
      "error" in json &&
      typeof (json as { error: unknown }).error === "string"
    ) {
      errMsg = (json as { error: string }).error;
    }
    throw new ApiError(errMsg, res.status);
  }

  return json as T;
}

export async function saveLead(
  payload: SaveLeadPayload,
): Promise<{ id: string }> {
  const result = await request<{ ok: boolean; lead: { id: string } }>(
    "/api/extension/lead",
    {
      method: "POST",
      body: JSON.stringify({
        // Map our payload onto the existing /api/extension/lead schema.
        business_name: payload.business_name,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        website: payload.website,
        industry: payload.industry,
        sourceUrl: payload.source_url,
        detectedFrom: payload.detected_from,
        // The lead route preserves unknown fields inside metadata.
        headline: payload.headline,
        role: payload.role,
        location: payload.location,
        profile_image_url: payload.profile_image_url,
      }),
    },
  );
  return { id: result.lead.id };
}

export async function researchProspect(payload: {
  linkedin_url: string;
  name: string;
  company: string;
}): Promise<ResearchResult> {
  return request<ResearchResult>("/api/ai/research-prospect", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function searchLeads(query: string): Promise<LeadSummary[]> {
  if (!query.trim()) return [];
  // The CRM exposes a typeahead endpoint — fall back gracefully if it
  // doesn't exist yet (returns empty array rather than throwing).
  try {
    const result = await request<{ leads: LeadSummary[] }>(
      `/api/extension/leads/search?q=${encodeURIComponent(query)}`,
      { method: "GET" },
    );
    return result.leads ?? [];
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return [];
    throw e;
  }
}
