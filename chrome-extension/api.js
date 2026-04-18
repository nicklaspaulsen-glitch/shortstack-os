/* ShortStack OS — Shared API helper
 *
 * Auth is handled via the /extension-auth handshake page (opened from the
 * popup login button). The handshake sends us a Supabase access token
 * which we store in chrome.storage.local (NOT sync — tokens must not
 * propagate across devices).
 *
 * We keep a legacy `apiKey` code path so existing users aren't broken, but
 * the new flow is handshake-based.
 */
const DEFAULT_BASE = "https://app.shortstack.work";

async function getConfig() {
  // Token from the login handshake lives in local; base URL may still be
  // customized from settings (kept in sync).
  const localData = await chrome.storage.local.get(["ss_access_token", "ss_refresh_token", "ss_user"]);
  const syncData = await chrome.storage.sync.get(["apiKey", "baseUrl"]);
  return {
    accessToken: localData.ss_access_token || "",
    refreshToken: localData.ss_refresh_token || "",
    user: localData.ss_user || null,
    // apiKey preserved for backward compat — falls through if no handshake token
    apiKey: syncData.apiKey || "",
    baseUrl: (syncData.baseUrl || DEFAULT_BASE).replace(/\/+$/, ""),
  };
}

async function apiCall(endpoint, method = "GET", body = null) {
  const { accessToken, apiKey, baseUrl } = await getConfig();
  const token = accessToken || apiKey;
  if (!token) throw new Error("Not connected. Click 'Connect to ShortStack' in the popup.");
  const opts = {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${endpoint}`, opts);
  if (!res.ok) {
    let errMsg = `API ${res.status}: ${res.statusText}`;
    try {
      const j = await res.json();
      if (j?.error) errMsg = j.error;
    } catch { /* body wasn't JSON */ }
    throw new Error(errMsg);
  }
  return res.json();
}

async function addLead(data) {
  return apiCall("/api/extension/lead", "POST", data);
}

async function createPost(data) {
  return apiCall("/api/extension/post", "POST", data);
}

async function summarizePage(url) {
  return apiCall("/api/extension/summarize", "POST", { url });
}

async function saveNote(data) {
  return apiCall("/api/extension/note", "POST", data);
}

async function trackCompetitor(url) {
  return apiCall("/api/extension/competitor", "POST", { url });
}

async function chatWithAI(message, url, pageContext) {
  return apiCall("/api/extension/chat", "POST", { message, url, pageContext });
}

if (typeof module !== "undefined") {
  module.exports = { getConfig, apiCall, addLead, createPost, summarizePage, saveNote, trackCompetitor, chatWithAI };
}
