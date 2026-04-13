"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Puzzle, CheckCircle, ExternalLink, Search
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  connected: boolean;
  url: string;
}

const INTEGRATIONS: Integration[] = [
  // Connected
  { id: "supabase", name: "Supabase", description: "Database & auth", category: "Core", icon: "🗄️", connected: true, url: "" },
  { id: "anthropic", name: "Claude AI", description: "AI generation", category: "Core", icon: "🤖", connected: true, url: "" },
  { id: "stripe", name: "Stripe", description: "Payments & billing", category: "Payments", icon: "💳", connected: true, url: "" },
  { id: "ghl", name: "GoHighLevel", description: "CRM, calls, SMS", category: "CRM", icon: "📞", connected: true, url: "" },
  { id: "telegram", name: "Telegram Bot", description: "Remote control", category: "Communication", icon: "✈️", connected: true, url: "" },
  { id: "vercel", name: "Vercel", description: "Hosting & deploy", category: "Core", icon: "▲", connected: true, url: "" },
  { id: "n8n", name: "n8n", description: "Workflow automation", category: "Automation", icon: "⚡", connected: true, url: "" },
  { id: "elevenlabs", name: "ElevenLabs", description: "Voice synthesis", category: "AI", icon: "🎙️", connected: true, url: "" },
  { id: "meta", name: "Meta (FB/IG)", description: "Social media OAuth", category: "Social", icon: "📱", connected: true, url: "" },
  { id: "google", name: "Google (YT)", description: "YouTube & Ads", category: "Social", icon: "🔴", connected: true, url: "" },
  { id: "railway", name: "Railway", description: "Video rendering", category: "Infrastructure", icon: "🚂", connected: true, url: "" },
  { id: "discord", name: "Discord Bot", description: "Team notifications", category: "Communication", icon: "💬", connected: true, url: "" },

  // Available to connect
  { id: "slack", name: "Slack", description: "Team messaging", category: "Communication", icon: "💬", connected: false, url: "https://slack.com" },
  { id: "zapier", name: "Zapier", description: "Connect 5000+ apps", category: "Automation", icon: "⚡", connected: false, url: "https://zapier.com" },
  { id: "make", name: "Make (Integromat)", description: "Visual automation", category: "Automation", icon: "🔄", connected: false, url: "https://make.com" },
  { id: "mailchimp", name: "Mailchimp", description: "Email marketing", category: "Marketing", icon: "📧", connected: false, url: "https://mailchimp.com" },
  { id: "hubspot", name: "HubSpot", description: "CRM alternative", category: "CRM", icon: "🟠", connected: false, url: "https://hubspot.com" },
  { id: "calendly", name: "Calendly", description: "Scheduling (we have built-in!)", category: "Scheduling", icon: "📅", connected: false, url: "https://calendly.com" },
  { id: "openai", name: "OpenAI", description: "GPT fallback", category: "AI", icon: "🧠", connected: false, url: "https://openai.com" },
  { id: "twilio", name: "Twilio", description: "SMS & voice", category: "Communication", icon: "📱", connected: false, url: "https://twilio.com" },
  { id: "sendgrid", name: "SendGrid", description: "Transactional email", category: "Marketing", icon: "📩", connected: false, url: "https://sendgrid.com" },
  { id: "canva", name: "Canva", description: "Design tool", category: "Design", icon: "🎨", connected: false, url: "https://canva.com" },
  { id: "pikzels", name: "Pikzels", description: "AI thumbnails", category: "Design", icon: "🖼️", connected: false, url: "https://pikzels.com" },
  { id: "higgsfield", name: "Higgsfield", description: "AI video (self-hosted)", category: "Video", icon: "🎬", connected: true, url: "https://github.com/higgsfield-ai/higgsfield" },
  { id: "instantly", name: "Instantly", description: "Cold email at scale", category: "Outreach", icon: "📬", connected: false, url: "https://instantly.ai" },
  { id: "lemlist", name: "Lemlist", description: "Cold outreach", category: "Outreach", icon: "🍋", connected: false, url: "https://lemlist.com" },
  { id: "semrush", name: "SEMrush", description: "SEO & keywords", category: "Marketing", icon: "🔍", connected: false, url: "https://semrush.com" },
  { id: "ahrefs", name: "Ahrefs", description: "Backlinks & SEO", category: "Marketing", icon: "🔗", connected: false, url: "https://ahrefs.com" },
];

export default function IntegrationsMarketplacePage() {
  useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const categories = ["all", ...Array.from(new Set(INTEGRATIONS.map(i => i.category)))];
  const connected = INTEGRATIONS.filter(i => i.connected);
  const available = INTEGRATIONS.filter(i => !i.connected);

  const filtered = (filter === "all" ? INTEGRATIONS : INTEGRATIONS.filter(i => i.category === filter))
    .filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Puzzle size={18} className="text-gold" /> Integrations
          </h1>
          <p className="text-xs text-muted mt-0.5">{connected.length} connected · {available.length} available</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input w-full text-xs pl-8" placeholder="Search integrations..." />
        </div>
        <div className="flex gap-1 flex-wrap">
          {categories.slice(0, 6).map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`text-[9px] px-2.5 py-1.5 rounded-lg capitalize transition-all ${
                filter === c ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.05]"
              }`}>{c}</button>
          ))}
        </div>
      </div>

      {/* Connected */}
      <div>
        <h2 className="section-header flex items-center gap-2">
          <CheckCircle size={12} className="text-success" /> Connected ({filtered.filter(i => i.connected).length})
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {filtered.filter(i => i.connected).map(int => (
            <div key={int.id} className="p-3 rounded-xl flex items-center gap-3"
              style={{ background: "rgba(16,185,129,0.03)", border: "1px solid rgba(16,185,129,0.08)" }}>
              <span className="text-xl">{int.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold">{int.name}</p>
                <p className="text-[9px] text-success">Connected</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Available */}
      <div>
        <h2 className="section-header">Available ({filtered.filter(i => !i.connected).length})</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {filtered.filter(i => !i.connected).map(int => (
            <a key={int.id} href={int.url} target="_blank" rel="noopener noreferrer"
              className="p-3 rounded-xl flex items-center gap-3 group transition-all hover:border-gold/10 bg-surface-light border border-border">
              <span className="text-xl">{int.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold group-hover:text-foreground transition-colors">{int.name}</p>
                <p className="text-[9px] text-muted truncate">{int.description}</p>
              </div>
              <ExternalLink size={10} className="text-muted/30 group-hover:text-gold transition-colors shrink-0" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
