"use client";

import { useState } from "react";
import {
  Puzzle, CheckCircle, Search, Star,
  Key, Plus,
  Clock, Code, X, Loader
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  connected: boolean;
  url: string;
  rating: number;
  installs: number;
  featured?: boolean;
  apiKeys?: number;
  usageToday?: number;
  lastSync?: string;
  version?: string;
}

const INTEGRATIONS: Integration[] = [
  { id: "supabase", name: "Supabase", description: "Database, auth & storage", category: "Core", icon: "S", connected: true, url: "", rating: 4.9, installs: 12400, featured: true, apiKeys: 2, usageToday: 2180, lastSync: "Live", version: "2.x" },
  { id: "anthropic", name: "Claude AI", description: "AI generation & reasoning", category: "AI", icon: "C", connected: true, url: "", rating: 4.9, installs: 8900, featured: true, apiKeys: 1, usageToday: 3240, lastSync: "Live", version: "3.5" },
  { id: "stripe", name: "Stripe", description: "Payments & billing", category: "Payments", icon: "$", connected: true, url: "", rating: 4.8, installs: 15200, apiKeys: 2, usageToday: 210, lastSync: "2 min ago", version: "2024" },
  { id: "ghl", name: "GoHighLevel", description: "CRM, calls, SMS", category: "CRM", icon: "G", connected: true, url: "", rating: 4.5, installs: 6700, apiKeys: 1, usageToday: 720, lastSync: "5 min ago", version: "v2" },
  { id: "telegram", name: "Telegram Bot", description: "Remote control & alerts", category: "Communication", icon: "T", connected: true, url: "", rating: 4.7, installs: 4300, apiKeys: 1, usageToday: 89, lastSync: "1 min ago" },
  { id: "vercel", name: "Vercel", description: "Hosting & deployments", category: "Core", icon: "V", connected: true, url: "", rating: 4.8, installs: 11000, apiKeys: 1, usageToday: 45, lastSync: "Live" },
  { id: "n8n", name: "n8n", description: "Workflow automation", category: "Automation", icon: "n", connected: true, url: "", rating: 4.6, installs: 5400, apiKeys: 1, usageToday: 156, lastSync: "10 min ago" },
  { id: "elevenlabs", name: "ElevenLabs", description: "Voice synthesis & calls", category: "AI", icon: "E", connected: true, url: "", rating: 4.7, installs: 7200, featured: true, apiKeys: 1, usageToday: 890, lastSync: "3 min ago" },
  { id: "meta", name: "Meta (FB/IG)", description: "Social media OAuth", category: "Social", icon: "M", connected: true, url: "", rating: 4.3, installs: 9800, apiKeys: 1, usageToday: 560, lastSync: "8 min ago" },
  { id: "google", name: "Google (YT)", description: "YouTube, Ads & Drive", category: "Social", icon: "G", connected: true, url: "", rating: 4.6, installs: 10200, apiKeys: 2, usageToday: 440, lastSync: "4 min ago" },
  { id: "railway", name: "Railway", description: "Video rendering infra", category: "Infrastructure", icon: "R", connected: true, url: "", rating: 4.4, installs: 3200, apiKeys: 1, usageToday: 12, lastSync: "1h ago" },
  { id: "discord", name: "Discord Bot", description: "Team notifications", category: "Communication", icon: "D", connected: true, url: "", rating: 4.5, installs: 5100, apiKeys: 1, usageToday: 34, lastSync: "6 min ago" },
  { id: "slack", name: "Slack", description: "Team messaging & alerts", category: "Communication", icon: "S", connected: false, url: "https://slack.com", rating: 4.7, installs: 18500 },
  { id: "zapier", name: "Zapier", description: "Connect 7000+ apps", category: "Automation", icon: "Z", connected: false, url: "https://zapier.com", rating: 4.6, installs: 24000, featured: true },
  { id: "make", name: "Make (Integromat)", description: "Visual automation builder", category: "Automation", icon: "M", connected: false, url: "https://make.com", rating: 4.5, installs: 14200 },
  { id: "mailchimp", name: "Mailchimp", description: "Email marketing at scale", category: "Marketing", icon: "M", connected: false, url: "https://mailchimp.com", rating: 4.4, installs: 19800 },
  { id: "hubspot", name: "HubSpot", description: "CRM alternative", category: "CRM", icon: "H", connected: false, url: "https://hubspot.com", rating: 4.5, installs: 16700 },
  { id: "calendly", name: "Calendly", description: "Scheduling (built-in available)", category: "Scheduling", icon: "C", connected: false, url: "https://calendly.com", rating: 4.6, installs: 12300 },
  { id: "openai", name: "OpenAI", description: "GPT fallback & DALL-E", category: "AI", icon: "O", connected: false, url: "https://openai.com", rating: 4.7, installs: 21000, featured: true },
  { id: "twilio", name: "Twilio", description: "SMS & voice APIs", category: "Communication", icon: "T", connected: false, url: "https://twilio.com", rating: 4.5, installs: 17400 },
  { id: "resend", name: "Resend", description: "Transactional email", category: "Marketing", icon: "R", connected: false, url: "https://resend.com", rating: 4.7, installs: 14500 },
  { id: "canva", name: "Canva", description: "Design tool API", category: "Design", icon: "C", connected: false, url: "https://canva.com", rating: 4.6, installs: 8900 },
  { id: "instantly", name: "Instantly", description: "Cold email at scale", category: "Outreach", icon: "I", connected: false, url: "https://instantly.ai", rating: 4.5, installs: 7800 },
  { id: "lemlist", name: "Lemlist", description: "Cold outreach sequences", category: "Outreach", icon: "L", connected: false, url: "https://lemlist.com", rating: 4.3, installs: 6200 },
  { id: "semrush", name: "SEMrush", description: "SEO & keyword research", category: "Marketing", icon: "S", connected: false, url: "https://semrush.com", rating: 4.6, installs: 11500 },
  { id: "ahrefs", name: "Ahrefs", description: "Backlinks & SEO tools", category: "Marketing", icon: "A", connected: false, url: "https://ahrefs.com", rating: 4.7, installs: 10800 },
  { id: "notion", name: "Notion", description: "Docs & knowledge base", category: "Productivity", icon: "N", connected: false, url: "https://notion.so", rating: 4.6, installs: 15600 },
  { id: "github", name: "GitHub", description: "Code repos & CI/CD", category: "Infrastructure", icon: "G", connected: false, url: "https://github.com", rating: 4.8, installs: 20100 },
];

const UPCOMING = [
  { name: "X (Twitter)", desc: "Social posting & DMs", eta: "May 2026" },
  { name: "WhatsApp Business", desc: "Messaging automation", eta: "May 2026" },
  { name: "Shopify", desc: "E-commerce integration", eta: "Jun 2026" },
  { name: "QuickBooks", desc: "Accounting sync", eta: "Jul 2026" },
];

const TABS = ["All", "Connected", "Available", "Featured", "API Keys", "Custom Builder", "Upcoming"] as const;
type Tab = typeof TABS[number];

export default function IntegrationsMarketplacePage() {
  const [tab, setTab] = useState<Tab>("All");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customKey, setCustomKey] = useState("");

  const categories = ["all", ...Array.from(new Set(INTEGRATIONS.map(i => i.category)))];
  const connected = INTEGRATIONS.filter(i => i.connected);
  const available = INTEGRATIONS.filter(i => !i.connected);
  const featured = INTEGRATIONS.filter(i => i.featured);

  const getFiltered = () => {
    let list = INTEGRATIONS;
    if (tab === "Connected") list = connected;
    else if (tab === "Available") list = available;
    else if (tab === "Featured") list = featured;

    if (categoryFilter !== "all") list = list.filter(i => i.category === categoryFilter);
    if (search) list = list.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase()));
    return list;
  };

  const filtered = getFiltered();

  function simulateInstall(id: string) {
    setInstalling(id);
    setTimeout(() => setInstalling(null), 2000);
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Puzzle size={18} className="text-gold" /> Integrations Marketplace
          </h1>
          <p className="text-xs text-muted mt-0.5">{connected.length} connected &middot; {available.length} available &middot; {UPCOMING.length} coming soon</p>
        </div>
      </div>

      {/* Search + Categories */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input w-full text-xs pl-8" placeholder="Search integrations..." />
        </div>
        <div className="flex gap-1 flex-wrap">
          {categories.slice(0, 8).map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              className={`text-[9px] px-2.5 py-1.5 rounded-lg capitalize transition-all ${
                categoryFilter === c ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-transparent hover:text-foreground"
              }`}>{c}</button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
              tab === t ? "bg-gold/15 text-gold border border-gold/20" : "text-muted border border-transparent hover:text-foreground"
            }`}>{t}</button>
        ))}
      </div>

      {/* ═══ INTEGRATION GRID (All / Connected / Available / Featured) ═══ */}
      {(tab === "All" || tab === "Connected" || tab === "Available" || tab === "Featured") && (
        <div className="space-y-4">
          {/* Integration Detail Panel */}
          {selectedIntegration && (
            <div className="card border-gold/10">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center text-lg font-bold text-gold">
                    {selectedIntegration.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">{selectedIntegration.name}</h3>
                    <p className="text-[10px] text-muted">{selectedIntegration.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-[9px] text-muted">
                      <span className="flex items-center gap-0.5"><Star size={9} className="text-gold" /> {selectedIntegration.rating}</span>
                      <span>{selectedIntegration.installs?.toLocaleString()} installs</span>
                      <span className="capitalize">{selectedIntegration.category}</span>
                      {selectedIntegration.version && <span>v{selectedIntegration.version}</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedIntegration(null)} className="text-muted hover:text-foreground"><X size={14} /></button>
              </div>
              {selectedIntegration.connected && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="bg-surface-light rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-gold">{selectedIntegration.usageToday?.toLocaleString()}</p>
                    <p className="text-[9px] text-muted">API Calls Today</p>
                  </div>
                  <div className="bg-surface-light rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-emerald-400">{selectedIntegration.apiKeys}</p>
                    <p className="text-[9px] text-muted">API Keys</p>
                  </div>
                  <div className="bg-surface-light rounded-lg p-2.5 text-center">
                    <p className="text-sm font-bold text-foreground">{selectedIntegration.lastSync}</p>
                    <p className="text-[9px] text-muted">Last Sync</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {filtered.map(int => (
              <div key={int.id}
                onClick={() => setSelectedIntegration(int)}
                className={`p-3 rounded-xl cursor-pointer transition-all hover:shadow-md ${
                  int.connected
                    ? "border border-emerald-500/10 bg-emerald-500/[0.02] hover:border-emerald-500/20"
                    : "border border-border bg-surface-light hover:border-gold/15"
                } ${selectedIntegration?.id === int.id ? "ring-1 ring-gold/30" : ""}`}>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${
                    int.connected ? "bg-emerald-500/10 text-emerald-400" : "bg-surface text-muted"
                  }`}>{int.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{int.name}</p>
                    <p className="text-[9px] text-muted truncate">{int.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[8px] text-muted">
                    <span className="flex items-center gap-0.5"><Star size={8} className="text-gold" /> {int.rating}</span>
                    <span>{int.installs?.toLocaleString()}</span>
                  </div>
                  {int.connected ? (
                    <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <CheckCircle size={8} /> Connected
                    </span>
                  ) : installing === int.id ? (
                    <span className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Loader size={8} className="animate-spin" /> Installing...
                    </span>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); simulateInstall(int.id); }}
                      className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded-full hover:bg-gold/20">
                      Install
                    </button>
                  )}
                </div>
                {int.featured && (
                  <div className="mt-1.5">
                    <span className="text-[7px] bg-gold/10 text-gold px-1.5 py-0.5 rounded-full font-semibold">FEATURED</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ API KEYS TAB ═══ */}
      {tab === "API Keys" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Key size={14} className="text-gold" /> API Key Management
          </h2>
          <div className="space-y-2">
            {connected.filter(c => c.apiKeys).map(int => (
              <div key={int.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-light border border-border">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-sm font-bold text-gold">{int.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{int.name}</p>
                  <p className="text-[9px] text-muted">{int.apiKeys} key{(int.apiKeys || 0) > 1 ? "s" : ""} configured</p>
                </div>
                <code className="text-[9px] font-mono text-muted bg-surface px-2 py-1 rounded">sk-...{Math.random().toString(36).slice(2, 6)}</code>
                <div className="flex gap-1">
                  <button className="text-[9px] px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">Rotate</button>
                  <button className="text-[9px] px-2 py-0.5 rounded border border-border text-muted">View</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ CUSTOM BUILDER TAB ═══ */}
      {tab === "Custom Builder" && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Code size={14} className="text-gold" /> Custom Integration Builder
          </h2>
          <p className="text-[10px] text-muted mb-3">Connect any REST API as a custom integration.</p>
          <div className="space-y-3">
            <div>
              <label className="text-[9px] text-muted uppercase mb-1 block">Integration Name</label>
              <input value={customName} onChange={e => setCustomName(e.target.value)}
                className="input w-full text-xs" placeholder="My Custom API" />
            </div>
            <div>
              <label className="text-[9px] text-muted uppercase mb-1 block">Base URL</label>
              <input value={customUrl} onChange={e => setCustomUrl(e.target.value)}
                className="input w-full text-xs" placeholder="https://api.example.com/v1" />
            </div>
            <div>
              <label className="text-[9px] text-muted uppercase mb-1 block">API Key</label>
              <input type="password" value={customKey} onChange={e => setCustomKey(e.target.value)}
                className="input w-full text-xs" placeholder="Bearer token or API key" />
            </div>
            <div>
              <label className="text-[9px] text-muted uppercase mb-1 block">Authentication Method</label>
              <select className="input w-full text-xs">
                <option>Bearer Token</option>
                <option>API Key (Header)</option>
                <option>API Key (Query)</option>
                <option>Basic Auth</option>
                <option>OAuth 2.0</option>
              </select>
            </div>
            <button disabled={!customName || !customUrl}
              className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40">
              <Plus size={12} /> Create Custom Integration
            </button>
          </div>
        </div>
      )}

      {/* ═══ UPCOMING TAB ═══ */}
      {tab === "Upcoming" && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Clock size={14} className="text-gold" /> Upcoming Integrations
          </h2>
          <p className="text-[10px] text-muted">These integrations are in development and coming soon.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {UPCOMING.map((u, i) => (
              <div key={i} className="card p-3 border-dashed">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold">{u.name}</p>
                  <span className="text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded-full">{u.eta}</span>
                </div>
                <p className="text-[10px] text-muted">{u.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
