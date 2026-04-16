/* ShortStack OS — Shared API helper */
const DEFAULT_BASE = "http://localhost:3000";

async function getConfig() {
  const data = await chrome.storage.sync.get(["apiKey", "baseUrl"]);
  return {
    apiKey: data.apiKey || "",
    baseUrl: (data.baseUrl || DEFAULT_BASE).replace(/\/+$/, ""),
  };
}

async function apiCall(endpoint, method = "GET", body = null) {
  const { apiKey, baseUrl } = await getConfig();
  if (!apiKey) throw new Error("No API key configured");
  const opts = {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${endpoint}`, opts);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
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
