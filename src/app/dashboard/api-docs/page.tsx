"use client";

import { useState } from "react";
import {
  BookOpen, Code, Copy, Shield, ChevronDown, ChevronRight,
  Play, Terminal, Key, AlertTriangle, Download, Clock,
  CheckCircle, Search, FileText, Zap, Globe, Lock,
  Trash2, Eye, EyeOff, Activity, ToggleLeft, ToggleRight, RefreshCw
} from "lucide-react";

/* ── Types ── */
interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  body?: string;
  response?: string;
  auth?: boolean;
  rateLimit?: string;
}

interface Category {
  name: string;
  icon: React.ReactNode;
  endpoints: Endpoint[];
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: "read" | "read-write" | "full";
  created_at: string;
  last_used: string | null;
  is_active: boolean;
}

const PERMISSION_LABELS: Record<ApiKey["permissions"], { label: string; color: string; desc: string }> = {
  "read": { label: "Read Only", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", desc: "Can read data via GET endpoints" },
  "read-write": { label: "Read & Write", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", desc: "Can read and create/update data" },
  "full": { label: "Full Access", color: "bg-red-500/10 text-red-400 border-red-500/20", desc: "Complete access including delete operations" },
};

const RATE_LIMITS: Record<ApiKey["permissions"], string> = {
  "read": "1,000 req/hr",
  "read-write": "500 req/hr",
  "full": "200 req/hr",
};

function maskKey(key: string): string {
  if (key.length <= 8) return key;
  const last4 = key.slice(-4);
  const prefix = key.startsWith("sk_live_") ? "sk_live_" : key.startsWith("sk_test_") ? "sk_test_" : "sk_";
  return `${prefix}...${last4}`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return dateStr;
}

// TODO: fetch from API
const INITIAL_API_KEYS: ApiKey[] = [];

/* ── Mock Data ── */
const API_CATEGORIES: Category[] = [
  {
    name: "Auth",
    icon: <Shield size={13} className="text-yellow-400" />,
    endpoints: [
      { method: "POST", path: "/api/auth/login", description: "Authenticate user and return session token", body: '{ "email": "user@example.com", "password": "***" }', response: '{ "token": "eyJhbG...", "expires_in": 3600 }', auth: false, rateLimit: "10/min" },
      { method: "POST", path: "/api/auth/register", description: "Create a new user account", body: '{ "email": "...", "password": "...", "name": "..." }', response: '{ "user_id": "uuid", "message": "Verification email sent" }', auth: false, rateLimit: "5/min" },
      { method: "POST", path: "/api/auth/reset-password", description: "Send a password reset email", body: '{ "email": "user@example.com" }', response: '{ "message": "Password reset email sent" }', auth: false, rateLimit: "3/min" },
      { method: "POST", path: "/api/auth/refresh", description: "Refresh an expired token", body: '{ "refresh_token": "..." }', response: '{ "token": "eyJhbG...", "expires_in": 3600 }', auth: true, rateLimit: "30/min" },
    ],
  },
  {
    name: "Clients",
    icon: <Globe size={13} className="text-blue-400" />,
    endpoints: [
      { method: "GET", path: "/api/clients", description: "List all clients", response: '{ "clients": [{ "id": "...", "business_name": "..." }], "total": 42 }', auth: true, rateLimit: "60/min" },
      { method: "POST", path: "/api/clients", description: "Create a new client", body: '{ "business_name": "Acme", "email": "...", "industry": "..." }', response: '{ "client": { "id": "uuid", ... } }', auth: true, rateLimit: "30/min" },
      { method: "GET", path: "/api/clients/:id", description: "Get a single client by ID", response: '{ "client": { "id": "uuid", "business_name": "...", ... } }', auth: true, rateLimit: "60/min" },
      { method: "PUT", path: "/api/clients/:id", description: "Update client details", body: '{ "business_name": "New Name", ... }', response: '{ "client": { ... } }', auth: true, rateLimit: "30/min" },
      { method: "DELETE", path: "/api/clients/:id", description: "Delete a client (GDPR)", response: '{ "message": "Client deleted" }', auth: true, rateLimit: "5/min" },
    ],
  },
  {
    name: "Content",
    icon: <FileText size={13} className="text-purple-400" />,
    endpoints: [
      { method: "POST", path: "/api/content/generate", description: "Generate social media content with AI", body: '{ "topic": "...", "platform": "instagram", "tone": "professional" }', response: '{ "content": "...", "hashtags": [...] }', auth: true, rateLimit: "20/min" },
      { method: "POST", path: "/api/content/script", description: "Generate a video script with hooks and CTAs", body: '{ "topic": "...", "duration": 60, "style": "educational" }', response: '{ "script": "...", "hooks": [...], "cta": "..." }', auth: true, rateLimit: "10/min" },
      { method: "GET", path: "/api/content/calendar", description: "Get content calendar for a client", response: '{ "calendar": [{ "date": "...", "posts": [...] }] }', auth: true, rateLimit: "30/min" },
    ],
  },
  {
    name: "Agents",
    icon: <Zap size={13} className="text-gold" />,
    endpoints: [
      { method: "GET", path: "/api/agents", description: "List all available AI agents", response: '{ "agents": [{ "id": "...", "name": "...", "status": "active" }] }', auth: true, rateLimit: "30/min" },
      { method: "POST", path: "/api/agents/chief", description: "Chat with the Chief AI Agent", body: '{ "message": "...", "history": [] }', response: '{ "response": "...", "data": { ... } }', auth: true, rateLimit: "10/min" },
      { method: "POST", path: "/api/agents/spawn", description: "Spawn a custom sub-agent", body: '{ "task": "...", "spawned_by": "manual" }', response: '{ "agent": { "id": "...", "name": "..." } }', auth: true, rateLimit: "5/min" },
      { method: "POST", path: "/api/agents/:id/health", description: "Health check for a specific agent", response: '{ "status": "healthy", "latency_ms": 42 }', auth: true, rateLimit: "30/min" },
    ],
  },
  {
    name: "Webhooks",
    icon: <Zap size={13} className="text-orange-400" />,
    endpoints: [
      { method: "GET", path: "/api/webhooks", description: "List configured webhooks", response: '{ "webhooks": [{ "id": "...", "url": "...", "events": [...] }] }', auth: true, rateLimit: "30/min" },
      { method: "POST", path: "/api/webhooks", description: "Create a new webhook endpoint", body: '{ "url": "https://...", "events": ["lead.created", "client.updated"] }', response: '{ "webhook": { "id": "...", "secret": "whsec_..." } }', auth: true, rateLimit: "10/min" },
      { method: "DELETE", path: "/api/webhooks/:id", description: "Delete a webhook", response: '{ "message": "Webhook deleted" }', auth: true, rateLimit: "10/min" },
    ],
  },
];

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-green-500/15 text-green-400 border-green-500/20",
  POST: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  PUT: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/20",
};

const ERROR_CODES = [
  { code: 400, name: "Bad Request", description: "Invalid request body or parameters" },
  { code: 401, name: "Unauthorized", description: "Missing or invalid authentication token" },
  { code: 403, name: "Forbidden", description: "Insufficient permissions for this action" },
  { code: 404, name: "Not Found", description: "Requested resource does not exist" },
  { code: 409, name: "Conflict", description: "Resource already exists or version conflict" },
  { code: 422, name: "Unprocessable", description: "Validation failed on request body" },
  { code: 429, name: "Rate Limited", description: "Too many requests, retry after cooldown" },
  { code: 500, name: "Server Error", description: "Internal error, contact support" },
];

const CHANGELOG = [
  { version: "v2.4.0", date: "2026-04-10", changes: ["Added content calendar endpoint", "Agent spawn now returns full config", "Improved rate limit headers"] },
  { version: "v2.3.0", date: "2026-03-28", changes: ["Added webhook event filtering", "New PUT method for client updates", "Auth token refresh endpoint"] },
  { version: "v2.2.0", date: "2026-03-15", changes: ["Added GDPR client deletion", "Agent health check endpoint", "Improved error response format"] },
  { version: "v2.1.0", date: "2026-02-20", changes: ["Initial public API release", "Auth, Clients, Content, Agents endpoints", "Rate limiting enabled"] },
];

const SDK_DOWNLOADS = [
  { name: "JavaScript / TypeScript", version: "2.4.0", size: "42 KB", lang: "js" },
  { name: "Python", version: "2.4.0", size: "38 KB", lang: "py" },
  { name: "Go", version: "2.3.0", size: "56 KB", lang: "go" },
  { name: "Ruby", version: "2.2.0", size: "31 KB", lang: "rb" },
];

const TABS = ["Explorer", "Endpoints", "Auth Guide", "Rate Limits", "Code Examples", "Errors", "Webhooks", "Changelog", "SDKs", "API Keys"] as const;
type Tab = typeof TABS[number];

export default function ApiDocsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Explorer");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ Auth: true });
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [explorerMethod, setExplorerMethod] = useState<"GET" | "POST" | "PUT" | "DELETE">("GET");
  const [explorerPath, setExplorerPath] = useState("/api/clients");
  const [explorerBody, setExplorerBody] = useState('{\n  "business_name": "Acme Inc"\n}');
  const [explorerResponse, setExplorerResponse] = useState("");
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [explorerHeaders, setExplorerHeaders] = useState<Array<{ key: string; value: string }>>([
    { key: "Authorization", value: "Bearer sk_live_..." },
    { key: "Content-Type", value: "application/json" },
  ]);
  const [codeExampleLang, setCodeExampleLang] = useState<"curl" | "js" | "python">("curl");
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(INITIAL_API_KEYS);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermission, setNewKeyPermission] = useState<ApiKey["permissions"]>("read");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function toggleSection(name: string) {
    setExpandedSections(prev => ({ ...prev, [name]: !prev[name] }));
  }

  function toggleEndpoint(key: string) {
    setExpandedEndpoints(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function copyText(text: string, label?: string) {
    navigator.clipboard.writeText(text);
    if (label) {
      setCopiedKey(label);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  }

  function simulateRequest() {
    setExplorerLoading(true);
    setExplorerResponse("");
    setTimeout(() => {
      const mockResponses: Record<string, string> = {
        "GET /api/clients": JSON.stringify({ clients: [{ id: "c_1", business_name: "Acme Inc", industry: "dental", status: "active" }, { id: "c_2", business_name: "Beta Corp", industry: "legal", status: "active" }], total: 2, page: 1 }, null, 2),
        "POST /api/clients": JSON.stringify({ client: { id: "c_new", business_name: "Acme Inc", created_at: new Date().toISOString() } }, null, 2),
        "GET /api/agents": JSON.stringify({ agents: [{ id: "lead-engine", name: "Lead Engine", status: "active" }, { id: "outreach", name: "Outreach", status: "idle" }] }, null, 2),
      };
      const key = `${explorerMethod} ${explorerPath}`;
      setExplorerResponse(mockResponses[key] || JSON.stringify({ status: 200, message: "OK", data: { request: { method: explorerMethod, path: explorerPath } } }, null, 2));
      setExplorerLoading(false);
    }, 800);
  }

  function generateApiKey() {
    if (!newKeyName.trim()) return;
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const random = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const newId = String(Date.now());
    const fullKey = `sk_live_${random}`;
    setApiKeys(prev => [...prev, {
      id: newId,
      name: newKeyName,
      key: fullKey,
      permissions: newKeyPermission,
      created_at: new Date().toISOString().split("T")[0],
      last_used: null,
      is_active: true,
    }]);
    setJustCreatedKey(fullKey);
    setRevealedKeys(prev => ({ ...prev, [newId]: true }));
    setNewKeyName("");
    setNewKeyPermission("read");
    setShowNewKey(false);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function revokeKey(id: string) {
    setApiKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: false } : k));
    setRevealedKeys(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  function deleteKey(id: string) {
    setApiKeys(prev => prev.filter(k => k.id !== id));
    setConfirmDeleteId(null);
    setRevealedKeys(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  function toggleKeyActive(id: string) {
    setApiKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: !k.is_active } : k));
  }

  function toggleRevealKey(id: string) {
    setRevealedKeys(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const filteredCategories = searchQuery
    ? API_CATEGORIES.map(cat => ({
        ...cat,
        endpoints: cat.endpoints.filter(ep =>
          ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ep.description.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(cat => cat.endpoints.length > 0)
    : API_CATEGORIES;

  const totalEndpoints = API_CATEGORIES.reduce((sum, cat) => sum + cat.endpoints.length, 0);

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <BookOpen size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="text-lg font-bold">API Documentation</h1>
            <p className="text-xs text-muted">Complete reference for all ShortStack OS API endpoints</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted">
          <span className="px-2 py-1 bg-surface-light rounded border border-border">v2.4.0</span>
          <span>{totalEndpoints} endpoints</span>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Endpoints", value: totalEndpoints, color: "text-gold" },
          { label: "Categories", value: API_CATEGORIES.length, color: "text-blue-400" },
          { label: "Auth Methods", value: "2", color: "text-green-400" },
          { label: "SDKs", value: SDK_DOWNLOADS.length, color: "text-purple-400" },
          { label: "API Version", value: "v2.4", color: "text-cyan-400" },
        ].map((s, i) => (
          <div key={i} className="card p-3 text-center">
            <p className="text-[9px] text-muted uppercase tracking-wider">{s.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border overflow-x-auto pb-px">
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-all ${
              activeTab === t ? "text-gold border-b-2 border-gold" : "text-muted hover:text-foreground"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ═══ EXPLORER TAB ═══ */}
      {activeTab === "Explorer" && (
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Play size={14} className="text-gold" />
              <h2 className="text-sm font-semibold">Interactive API Explorer</h2>
            </div>

            {/* Method + Path */}
            <div className="flex gap-2">
              <select value={explorerMethod} onChange={e => setExplorerMethod(e.target.value as "GET" | "POST" | "PUT" | "DELETE")}
                className="input text-xs py-2 w-28 font-mono font-bold">
                {["GET", "POST", "PUT", "DELETE"].map(m => <option key={m}>{m}</option>)}
              </select>
              <input value={explorerPath} onChange={e => setExplorerPath(e.target.value)}
                className="input flex-1 text-xs py-2 font-mono" placeholder="/api/clients" />
              <button onClick={simulateRequest} disabled={explorerLoading}
                className="px-4 py-2 bg-gold/10 text-gold text-xs font-medium rounded-lg border border-gold/20 hover:bg-gold/20 transition-all disabled:opacity-50 flex items-center gap-1.5">
                {explorerLoading ? <div className="w-3 h-3 border-2 border-gold/20 border-t-gold rounded-full animate-spin" /> : <Play size={12} />}
                Send
              </button>
            </div>

            {/* Headers */}
            <div>
              <p className="text-[9px] text-muted uppercase tracking-wider mb-1.5">Headers</p>
              <div className="space-y-1.5">
                {explorerHeaders.map((h, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={h.key} onChange={e => { const upd = [...explorerHeaders]; upd[i].key = e.target.value; setExplorerHeaders(upd); }}
                      className="input text-[10px] py-1.5 w-40 font-mono" placeholder="Header name" />
                    <input value={h.value} onChange={e => { const upd = [...explorerHeaders]; upd[i].value = e.target.value; setExplorerHeaders(upd); }}
                      className="input text-[10px] py-1.5 flex-1 font-mono" placeholder="Value" />
                  </div>
                ))}
              </div>
            </div>

            {/* Request Body */}
            {(explorerMethod === "POST" || explorerMethod === "PUT") && (
              <div>
                <p className="text-[9px] text-muted uppercase tracking-wider mb-1.5">Request Body (JSON)</p>
                <textarea value={explorerBody} onChange={e => setExplorerBody(e.target.value)}
                  className="input w-full text-[10px] py-2 font-mono h-24 resize-y" />
              </div>
            )}

            {/* Response */}
            {explorerResponse && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[9px] text-muted uppercase tracking-wider">Response</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] px-2 py-0.5 bg-green-500/10 text-green-400 rounded border border-green-500/20">200 OK</span>
                    <button onClick={() => copyText(explorerResponse, "response")} className="text-[9px] text-muted hover:text-gold transition-colors flex items-center gap-1">
                      <Copy size={9} /> Copy
                    </button>
                  </div>
                </div>
                <pre className="bg-black/30 rounded-lg p-3 text-[10px] font-mono text-green-400 overflow-x-auto max-h-64 overflow-y-auto">
                  {explorerResponse}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ ENDPOINTS TAB ═══ */}
      {activeTab === "Endpoints" && (
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="input w-full text-xs py-2.5 pl-9" placeholder="Search endpoints by path or description..." />
          </div>

          {/* Method Legend */}
          <div className="flex items-center gap-3">
            {(["GET", "POST", "PUT", "DELETE"] as const).map(m => (
              <div key={m} className="flex items-center gap-1.5">
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${METHOD_STYLES[m]}`}>{m}</span>
                <span className="text-[9px] text-muted">{m === "GET" ? "Read" : m === "POST" ? "Create" : m === "PUT" ? "Update" : "Delete"}</span>
              </div>
            ))}
          </div>

          {/* Categories */}
          {filteredCategories.map(cat => {
            const isOpen = expandedSections[cat.name] !== false;
            return (
              <div key={cat.name} className="card overflow-hidden p-0">
                <button onClick={() => toggleSection(cat.name)}
                  className="w-full flex items-center gap-2.5 p-3 hover:bg-white/[0.02] transition-colors">
                  {isOpen ? <ChevronDown size={13} className="text-muted" /> : <ChevronRight size={13} className="text-muted" />}
                  {cat.icon}
                  <span className="text-xs font-semibold">{cat.name}</span>
                  <span className="text-[10px] text-muted ml-auto">{cat.endpoints.length} endpoint{cat.endpoints.length !== 1 ? "s" : ""}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-border">
                    {cat.endpoints.map((ep, i) => {
                      const epKey = `${cat.name}-${i}`;
                      const isExpanded = expandedEndpoints[epKey];
                      return (
                        <div key={epKey} className="border-b border-border last:border-b-0">
                          <button onClick={() => toggleEndpoint(epKey)}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/[0.02] transition-colors text-left">
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${METHOD_STYLES[ep.method]}`}>{ep.method}</span>
                            <span className="text-xs font-mono text-foreground truncate">{ep.path}</span>
                            {ep.auth && <Lock size={9} className="text-muted shrink-0" />}
                            <span className="text-[10px] text-muted ml-auto shrink-0 hidden sm:block">{ep.description}</span>
                            <Copy size={11} className="text-muted shrink-0 hover:text-gold transition-colors"
                              onClick={(e) => { e.stopPropagation(); copyText(ep.path, ep.path); }} />
                          </button>
                          {isExpanded && (
                            <div className="px-4 pb-3 space-y-2">
                              <p className="text-[10px] text-muted">{ep.description}</p>
                              <div className="flex items-center gap-3 text-[9px]">
                                {ep.auth && <span className="flex items-center gap-1 text-yellow-400"><Lock size={8} /> Requires auth</span>}
                                {ep.rateLimit && <span className="flex items-center gap-1 text-muted"><Clock size={8} /> {ep.rateLimit}</span>}
                              </div>
                              {ep.body && (
                                <div>
                                  <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Request Body</p>
                                  <pre className="bg-black/30 rounded-lg p-2.5 text-[10px] font-mono text-green-400 overflow-x-auto">{ep.body}</pre>
                                </div>
                              )}
                              {ep.response && (
                                <div>
                                  <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Response</p>
                                  <pre className="bg-black/30 rounded-lg p-2.5 text-[10px] font-mono text-blue-400 overflow-x-auto">{ep.response}</pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ AUTH GUIDE TAB ═══ */}
      {activeTab === "Auth Guide" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={14} className="text-gold" />
              <h2 className="text-sm font-semibold">Authentication Guide</h2>
            </div>
            <div className="space-y-4">
              <div className="p-3 rounded-lg border border-border">
                <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Key size={12} className="text-yellow-400" /> API Key Authentication</h3>
                <p className="text-[10px] text-muted mb-2">Include your API key in the Authorization header with every request.</p>
                <pre className="bg-black/30 rounded-lg p-2.5 text-[10px] font-mono text-green-400">Authorization: Bearer sk_live_your_api_key_here</pre>
              </div>
              <div className="p-3 rounded-lg border border-border">
                <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Lock size={12} className="text-blue-400" /> Session Cookie (Browser)</h3>
                <p className="text-[10px] text-muted mb-2">For browser-based apps, use Supabase session cookies. The cookie is automatically set after login.</p>
                <pre className="bg-black/30 rounded-lg p-2.5 text-[10px] font-mono text-green-400">Cookie: sb-access-token=eyJhbG...; sb-refresh-token=...</pre>
              </div>
              <div className="p-3 rounded-lg border border-border bg-yellow-500/5">
                <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><AlertTriangle size={12} className="text-yellow-400" /> Security Best Practices</h3>
                <ul className="space-y-1.5 text-[10px] text-muted">
                  <li className="flex items-start gap-1.5"><CheckCircle size={10} className="text-green-400 mt-0.5 shrink-0" /> Never expose API keys in client-side code</li>
                  <li className="flex items-start gap-1.5"><CheckCircle size={10} className="text-green-400 mt-0.5 shrink-0" /> Use environment variables for key storage</li>
                  <li className="flex items-start gap-1.5"><CheckCircle size={10} className="text-green-400 mt-0.5 shrink-0" /> Rotate keys every 90 days</li>
                  <li className="flex items-start gap-1.5"><CheckCircle size={10} className="text-green-400 mt-0.5 shrink-0" /> Use test keys for development</li>
                  <li className="flex items-start gap-1.5"><CheckCircle size={10} className="text-green-400 mt-0.5 shrink-0" /> Enable IP whitelisting for production keys</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ RATE LIMITS TAB ═══ */}
      {activeTab === "Rate Limits" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-gold" />
              <h2 className="text-sm font-semibold">Rate Limiting</h2>
            </div>
            <p className="text-[10px] text-muted mb-4">All API endpoints are rate-limited. Limits are returned in response headers.</p>

            <div className="p-3 rounded-lg border border-border mb-4">
              <p className="text-[9px] text-muted uppercase tracking-wider mb-1.5">Response Headers</p>
              <pre className="bg-black/30 rounded-lg p-2.5 text-[10px] font-mono text-cyan-400">{`X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1712000000
Retry-After: 30`}</pre>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-4 gap-2 px-4 py-2 border-b border-border text-[9px] text-muted uppercase tracking-wider">
                <div>Tier</div>
                <div>Requests/min</div>
                <div>Burst</div>
                <div>Daily Cap</div>
              </div>
              {[
                { tier: "Free", rpm: "10", burst: "15", daily: "500" },
                { tier: "Pro", rpm: "60", burst: "100", daily: "10,000" },
                { tier: "Business", rpm: "300", burst: "500", daily: "100,000" },
                { tier: "Enterprise", rpm: "Custom", burst: "Custom", daily: "Unlimited" },
              ].map((r, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 px-4 py-2.5 border-b border-border last:border-0 text-[11px]">
                  <div className="font-medium">{r.tier}</div>
                  <div className="text-muted">{r.rpm}</div>
                  <div className="text-muted">{r.burst}</div>
                  <div className="text-muted">{r.daily}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ CODE EXAMPLES TAB ═══ */}
      {activeTab === "Code Examples" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-gold" />
                <h2 className="text-sm font-semibold">Code Examples</h2>
              </div>
              <div className="flex gap-1">
                {(["curl", "js", "python"] as const).map(lang => (
                  <button key={lang} onClick={() => setCodeExampleLang(lang)}
                    className={`text-[10px] px-3 py-1 rounded-lg border transition-all ${
                      codeExampleLang === lang ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted"
                    }`}>
                    {lang === "curl" ? "cURL" : lang === "js" ? "JavaScript" : "Python"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {/* List clients example */}
              <div>
                <p className="text-xs font-medium mb-1.5">List all clients</p>
                <pre className="bg-black/30 rounded-lg p-3 text-[10px] font-mono text-green-400 overflow-x-auto">
                  {codeExampleLang === "curl" && `curl -X GET https://api.shortstack.io/api/clients \\
  -H "Authorization: Bearer sk_live_your_key" \\
  -H "Content-Type: application/json"`}
                  {codeExampleLang === "js" && `const response = await fetch('https://api.shortstack.io/api/clients', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer sk_live_your_key',
    'Content-Type': 'application/json',
  },
});
const data = await response.json();
console.log(data.clients);`}
                  {codeExampleLang === "python" && `import requests

response = requests.get(
    'https://api.shortstack.io/api/clients',
    headers={
        'Authorization': 'Bearer sk_live_your_key',
        'Content-Type': 'application/json',
    }
)
data = response.json()
print(data['clients'])`}
                </pre>
              </div>

              {/* Generate content example */}
              <div>
                <p className="text-xs font-medium mb-1.5">Generate content with AI</p>
                <pre className="bg-black/30 rounded-lg p-3 text-[10px] font-mono text-green-400 overflow-x-auto">
                  {codeExampleLang === "curl" && `curl -X POST https://api.shortstack.io/api/content/generate \\
  -H "Authorization: Bearer sk_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"topic": "dental tips", "platform": "instagram", "tone": "friendly"}'`}
                  {codeExampleLang === "js" && `const response = await fetch('https://api.shortstack.io/api/content/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_live_your_key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    topic: 'dental tips',
    platform: 'instagram',
    tone: 'friendly',
  }),
});
const data = await response.json();
console.log(data.content);`}
                  {codeExampleLang === "python" && `import requests

response = requests.post(
    'https://api.shortstack.io/api/content/generate',
    headers={
        'Authorization': 'Bearer sk_live_your_key',
        'Content-Type': 'application/json',
    },
    json={
        'topic': 'dental tips',
        'platform': 'instagram',
        'tone': 'friendly',
    }
)
data = response.json()
print(data['content'])`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ERRORS TAB ═══ */}
      {activeTab === "Errors" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-gold" />
              <h2 className="text-sm font-semibold">Error Code Reference</h2>
            </div>
            <p className="text-[10px] text-muted mb-3">All errors return a JSON body with an error message and optional details.</p>

            <pre className="bg-black/30 rounded-lg p-3 text-[10px] font-mono text-red-400 mb-4">{`{
  "error": "Validation failed",
  "code": 422,
  "details": {
    "field": "email",
    "message": "Invalid email format"
  }
}`}</pre>

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-4 gap-2 px-4 py-2 border-b border-border text-[9px] text-muted uppercase tracking-wider">
                <div>Code</div>
                <div>Name</div>
                <div className="col-span-2">Description</div>
              </div>
              {ERROR_CODES.map((err, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 px-4 py-2.5 border-b border-border last:border-0 text-[11px]">
                  <div className={`font-mono font-bold ${err.code >= 500 ? "text-red-400" : err.code >= 400 ? "text-yellow-400" : "text-green-400"}`}>{err.code}</div>
                  <div className="font-medium">{err.name}</div>
                  <div className="col-span-2 text-muted">{err.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ WEBHOOKS TAB ═══ */}
      {activeTab === "Webhooks" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-gold" />
              <h2 className="text-sm font-semibold">Webhook Documentation</h2>
            </div>
            <p className="text-[10px] text-muted mb-4">ShortStack sends webhook events to your configured URL when specific actions occur.</p>

            <div className="mb-4">
              <p className="text-xs font-medium mb-2">Available Events</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { event: "lead.created", desc: "New lead scraped" },
                  { event: "lead.qualified", desc: "Lead passed scoring" },
                  { event: "client.created", desc: "New client added" },
                  { event: "client.updated", desc: "Client details changed" },
                  { event: "outreach.sent", desc: "Email/DM sent" },
                  { event: "outreach.replied", desc: "Lead replied" },
                  { event: "content.generated", desc: "AI content created" },
                  { event: "content.published", desc: "Content posted" },
                  { event: "agent.error", desc: "Agent encountered error" },
                  { event: "invoice.paid", desc: "Invoice payment received" },
                  { event: "call.completed", desc: "AI call finished" },
                  { event: "ticket.created", desc: "Support ticket opened" },
                ].map((ev, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-border text-[10px]">
                    <code className="text-gold font-mono">{ev.event}</code>
                    <span className="text-muted">{ev.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium mb-2">Webhook Payload Format</p>
              <pre className="bg-black/30 rounded-lg p-3 text-[10px] font-mono text-green-400">{`{
  "event": "lead.created",
  "timestamp": "2026-04-14T10:30:00Z",
  "data": {
    "id": "lead_abc123",
    "business_name": "Acme Dental",
    "email": "info@acmedental.com",
    "score": 85
  },
  "webhook_id": "wh_xyz789"
}`}</pre>
            </div>

            <div className="mt-4 p-3 rounded-lg border border-border bg-yellow-500/5">
              <h3 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                <Shield size={11} className="text-yellow-400" /> Signature Verification
              </h3>
              <p className="text-[10px] text-muted mb-2">Verify webhook authenticity using the X-Webhook-Signature header.</p>
              <pre className="bg-black/30 rounded-lg p-2.5 text-[10px] font-mono text-cyan-400">{`const crypto = require('crypto');
const signature = req.headers['x-webhook-signature'];
const expected = crypto.createHmac('sha256', webhookSecret)
  .update(JSON.stringify(req.body))
  .digest('hex');
const valid = signature === expected;`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CHANGELOG TAB ═══ */}
      {activeTab === "Changelog" && (
        <div className="space-y-3">
          {CHANGELOG.map((entry, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold font-mono text-gold">{entry.version}</span>
                <span className="text-[10px] text-muted">{entry.date}</span>
                {i === 0 && <span className="text-[8px] px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded border border-green-500/20">Latest</span>}
              </div>
              <ul className="space-y-1">
                {entry.changes.map((change, j) => (
                  <li key={j} className="flex items-start gap-1.5 text-[10px] text-muted">
                    <CheckCircle size={10} className="text-green-400 mt-0.5 shrink-0" />
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* ═══ SDKs TAB ═══ */}
      {activeTab === "SDKs" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Download size={14} className="text-gold" />
              <h2 className="text-sm font-semibold">SDK Downloads</h2>
            </div>
            <p className="text-[10px] text-muted mb-4">Official client libraries for popular languages. Install via package manager or download.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SDK_DOWNLOADS.map((sdk, i) => (
                <div key={i} className="p-3 rounded-lg border border-border hover:border-gold/20 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Code size={14} className="text-gold" />
                      <span className="text-xs font-semibold">{sdk.name}</span>
                    </div>
                    <span className="text-[9px] text-muted">{sdk.size}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted">v{sdk.version}</span>
                    <div className="flex gap-1.5">
                      <button className="text-[9px] px-2 py-1 rounded border border-border text-muted hover:text-foreground transition-all">
                        Install Guide
                      </button>
                      <button className="text-[9px] px-2 py-1 rounded bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all flex items-center gap-1">
                        <Download size={9} /> Download
                      </button>
                    </div>
                  </div>
                  <pre className="bg-black/30 rounded-lg p-2 mt-2 text-[9px] font-mono text-cyan-400">
                    {sdk.lang === "js" && "npm install @shortstack/sdk"}
                    {sdk.lang === "py" && "pip install shortstack-sdk"}
                    {sdk.lang === "go" && "go get github.com/shortstack/sdk-go"}
                    {sdk.lang === "rb" && "gem install shortstack-sdk"}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ API KEYS TAB ═══ */}
      {activeTab === "API Keys" && (
        <div className="space-y-4">

          {/* Just-created key banner */}
          {justCreatedKey && (
            <div className="card p-4 border-green-500/30 bg-green-500/5">
              <div className="flex items-start gap-3">
                <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-green-400 mb-1">API key created successfully</p>
                  <p className="text-[10px] text-muted mb-2">Copy your key now -- you will not be able to see it again after closing this banner.</p>
                  <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 font-mono text-[11px] text-foreground">
                    <span className="truncate flex-1">{justCreatedKey}</span>
                    <button onClick={() => copyText(justCreatedKey, "new-key")}
                      className="text-muted hover:text-gold transition-colors flex-shrink-0">
                      {copiedKey === "new-key" ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
                <button onClick={() => setJustCreatedKey(null)} className="text-muted hover:text-foreground text-xs flex-shrink-0">x</button>
              </div>
            </div>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total Keys", value: apiKeys.length, color: "text-gold", icon: <Key size={13} className="text-gold" /> },
              { label: "Active", value: apiKeys.filter(k => k.is_active).length, color: "text-green-400", icon: <CheckCircle size={13} className="text-green-400" /> },
              { label: "Revoked", value: apiKeys.filter(k => !k.is_active).length, color: "text-red-400", icon: <Shield size={13} className="text-red-400" /> },
              { label: "Full Access", value: apiKeys.filter(k => k.permissions === "full" && k.is_active).length, color: "text-orange-400", icon: <AlertTriangle size={13} className="text-orange-400" /> },
            ].map((s, i) => (
              <div key={i} className="card p-3">
                <div className="flex items-center gap-2 mb-1">
                  {s.icon}
                  <p className="text-[9px] text-muted uppercase tracking-wider">{s.label}</p>
                </div>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Key Management Card */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key size={14} className="text-gold" />
                <h2 className="text-sm font-semibold">Private API Keys</h2>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-light text-muted border border-border">{apiKeys.length} keys</span>
              </div>
              <button onClick={() => setShowNewKey(!showNewKey)}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all flex items-center gap-1.5">
                <Key size={10} />
                Generate New Key
              </button>
            </div>

            {/* Create New Key Form */}
            {showNewKey && (
              <div className="p-4 rounded-lg border border-gold/20 bg-gold/5 mb-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-gold">
                  <Key size={12} />
                  New API Key
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Key Name</label>
                    <input
                      value={newKeyName}
                      onChange={e => setNewKeyName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && generateApiKey()}
                      className="input w-full text-xs py-1.5"
                      placeholder="e.g. Production, CI/CD, Analytics"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Permissions</label>
                    <div className="flex gap-1.5">
                      {(["read", "read-write", "full"] as const).map(perm => (
                        <button
                          key={perm}
                          onClick={() => setNewKeyPermission(perm)}
                          className={`flex-1 text-[10px] px-2 py-1.5 rounded-lg border transition-all ${
                            newKeyPermission === perm
                              ? PERMISSION_LABELS[perm].color + " border font-medium"
                              : "border-border text-muted hover:text-foreground hover:border-border"
                          }`}
                        >
                          {PERMISSION_LABELS[perm].label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted">
                    <Activity size={10} />
                    Rate limit: <span className="text-foreground font-medium">{RATE_LIMITS[newKeyPermission]}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowNewKey(false); setNewKeyName(""); setNewKeyPermission("read"); }}
                      className="text-[10px] px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground transition-all">
                      Cancel
                    </button>
                    <button onClick={generateApiKey}
                      disabled={!newKeyName.trim()}
                      className="text-[10px] px-4 py-1.5 rounded-lg bg-gold text-black font-medium hover:bg-gold/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      Generate Key
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Keys Table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-border text-[9px] text-muted uppercase tracking-wider bg-surface-light/50">
                <div className="col-span-2">Name</div>
                <div className="col-span-3">Key</div>
                <div className="col-span-2">Permissions</div>
                <div>Rate Limit</div>
                <div>Created</div>
                <div>Last Used</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              {apiKeys.length === 0 && (
                <div className="px-4 py-8 text-center text-muted text-xs">
                  <Key size={20} className="mx-auto mb-2 opacity-30" />
                  No API keys yet. Generate your first key above.
                </div>
              )}
              {apiKeys.map(k => (
                <div key={k.id} className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-border last:border-0 text-[11px] items-center ${!k.is_active ? "opacity-50" : ""}`}>
                  {/* Name + Status */}
                  <div className="col-span-2 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{k.name}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${k.is_active ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                        {k.is_active ? "Active" : "Revoked"}
                      </span>
                    </div>
                  </div>

                  {/* Key (masked/revealed) */}
                  <div className="col-span-3 font-mono text-[10px] flex items-center gap-1.5">
                    <span className="text-muted truncate">
                      {revealedKeys[k.id] ? k.key : maskKey(k.key)}
                    </span>
                    <button onClick={() => toggleRevealKey(k.id)} className="text-muted hover:text-foreground transition-colors flex-shrink-0" title={revealedKeys[k.id] ? "Hide" : "Reveal"}>
                      {revealedKeys[k.id] ? <EyeOff size={10} /> : <Eye size={10} />}
                    </button>
                    <button onClick={() => copyText(k.key, k.id)} className="text-muted hover:text-gold transition-colors flex-shrink-0" title="Copy key">
                      {copiedKey === k.id ? <CheckCircle size={10} className="text-green-400" /> : <Copy size={10} />}
                    </button>
                  </div>

                  {/* Permissions */}
                  <div className="col-span-2">
                    <span className={`text-[9px] px-2 py-0.5 rounded border font-medium ${PERMISSION_LABELS[k.permissions].color}`}>
                      {PERMISSION_LABELS[k.permissions].label}
                    </span>
                  </div>

                  {/* Rate Limit */}
                  <div className="text-[10px] text-muted flex items-center gap-1">
                    <Activity size={9} className="flex-shrink-0" />
                    {RATE_LIMITS[k.permissions]}
                  </div>

                  {/* Created */}
                  <div className="text-muted text-[10px]">{k.created_at}</div>

                  {/* Last Used */}
                  <div className="text-muted text-[10px] flex items-center gap-1">
                    <Clock size={9} className="flex-shrink-0" />
                    {timeAgo(k.last_used)}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-1.5">
                    {k.is_active ? (
                      <>
                        <button onClick={() => toggleKeyActive(k.id)}
                          className="text-[9px] px-2 py-1 rounded border border-orange-500/20 text-orange-400 hover:bg-orange-500/10 transition-all flex items-center gap-1" title="Revoke key">
                          <ToggleRight size={9} />
                          Revoke
                        </button>
                        {confirmDeleteId === k.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => deleteKey(k.id)}
                              className="text-[9px] px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all font-medium">
                              Confirm
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)}
                              className="text-[9px] px-1.5 py-1 rounded border border-border text-muted hover:text-foreground transition-all">
                              x
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(k.id)}
                            className="text-[9px] px-2 py-1 rounded border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-1" title="Delete key">
                            <Trash2 size={9} />
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button onClick={() => toggleKeyActive(k.id)}
                          className="text-[9px] px-2 py-1 rounded border border-green-500/20 text-green-400 hover:bg-green-500/10 transition-all flex items-center gap-1" title="Reactivate key">
                          <ToggleLeft size={9} />
                          Activate
                        </button>
                        {confirmDeleteId === k.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => deleteKey(k.id)}
                              className="text-[9px] px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all font-medium">
                              Confirm
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)}
                              className="text-[9px] px-1.5 py-1 rounded border border-border text-muted hover:text-foreground transition-all">
                              x
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(k.id)}
                            className="text-[9px] px-2 py-1 rounded border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-1" title="Delete key">
                            <Trash2 size={9} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security & Usage Info */}
          <div className="grid grid-cols-2 gap-4">
            {/* Security Best Practices */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={13} className="text-gold" />
                <h3 className="text-xs font-semibold">Security Best Practices</h3>
              </div>
              <div className="space-y-2">
                {[
                  { icon: <Lock size={10} />, text: "Never expose API keys in client-side code or public repos" },
                  { icon: <RefreshCw size={10} />, text: "Rotate keys regularly -- revoke and regenerate every 90 days" },
                  { icon: <Shield size={10} />, text: "Use minimum required permissions (prefer read-only)" },
                  { icon: <Eye size={10} />, text: "Monitor last-used timestamps for suspicious activity" },
                  { icon: <AlertTriangle size={10} />, text: "Revoke keys immediately if you suspect a compromise" },
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10px] text-muted">
                    <span className="text-gold mt-0.5 flex-shrink-0">{tip.icon}</span>
                    <span>{tip.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rate Limits by Permission */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={13} className="text-gold" />
                <h3 className="text-xs font-semibold">Rate Limits by Permission Level</h3>
              </div>
              <div className="space-y-2">
                {(["read", "read-write", "full"] as const).map(perm => (
                  <div key={perm} className="flex items-center justify-between p-2 rounded-lg bg-surface-light/50 border border-border">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] px-2 py-0.5 rounded border font-medium ${PERMISSION_LABELS[perm].color}`}>
                        {PERMISSION_LABELS[perm].label}
                      </span>
                      <span className="text-[10px] text-muted">{PERMISSION_LABELS[perm].desc}</span>
                    </div>
                    <span className="text-[10px] font-mono text-foreground font-medium">{RATE_LIMITS[perm]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-2 rounded-lg bg-yellow-500/5 border border-yellow-500/15">
                <p className="text-[9px] text-yellow-400 flex items-center gap-1.5">
                  <AlertTriangle size={10} className="flex-shrink-0" />
                  Exceeding rate limits returns HTTP 429. Implement exponential backoff in your integration.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Start Code */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Terminal size={13} className="text-gold" />
              <h3 className="text-xs font-semibold">Quick Start</h3>
            </div>
            <div className="bg-black/30 rounded-lg p-3 font-mono text-[10px] text-muted leading-relaxed overflow-x-auto">
              <div className="text-green-400/60"># Authenticate with your API key</div>
              <div><span className="text-cyan-400">curl</span> -X GET https://api.shortstack.os/v2/clients \</div>
              <div className="pl-4">-H <span className="text-yellow-400">&quot;Authorization: Bearer sk_live_your_key_here&quot;</span> \</div>
              <div className="pl-4">-H <span className="text-yellow-400">&quot;Content-Type: application/json&quot;</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
