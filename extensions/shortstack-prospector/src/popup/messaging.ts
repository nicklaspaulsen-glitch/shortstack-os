import type {
  ApiResult,
  AuthState,
  ExtensionMessage,
  LeadSummary,
  ProspectData,
  ResearchResult,
  SaveLeadPayload,
} from "../shared/types";

// Thin typed wrapper around chrome.runtime.sendMessage so the popup
// stays decoupled from the message protocol shape. Each helper returns
// the unwrapped data on success and throws on failure — matches the
// idiomatic React data-fetching shape.

async function send<T>(msg: ExtensionMessage): Promise<T> {
  const result = (await chrome.runtime.sendMessage(msg)) as ApiResult<T>;
  if (!result || typeof result !== "object" || !("ok" in result)) {
    throw new Error("No response from background worker.");
  }
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
}

export const checkAuth = (): Promise<AuthState> =>
  send<AuthState>({ type: "CHECK_AUTH" });

export const openLogin = (): Promise<null> =>
  send<null>({ type: "OPEN_LOGIN" });

export const getProspect = (): Promise<ProspectData | null> =>
  send<ProspectData | null>({ type: "GET_PROSPECT" });

export const saveLead = (payload: SaveLeadPayload): Promise<{ id: string }> =>
  send<{ id: string }>({ type: "SAVE_LEAD", payload });

export const researchProspect = (payload: {
  linkedin_url: string;
  name: string;
  company: string;
}): Promise<ResearchResult> =>
  send<ResearchResult>({ type: "RESEARCH_PROSPECT", payload });

export const searchLeads = (query: string): Promise<LeadSummary[]> =>
  send<LeadSummary[]>({ type: "SEARCH_LEADS", payload: { query } });
