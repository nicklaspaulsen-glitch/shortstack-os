"use client";

import { useState } from "react";
import {
  MessageSquare, Mail, Phone, Camera, Music, Briefcase,
  Globe, Search, Download, CheckCircle, XCircle,
  Send, Eye, BarChart3, Calendar,
  ThumbsUp, ThumbsDown, Minus, MousePointerClick,
  RefreshCw, Users, Activity
} from "lucide-react";

type MainTab = "timeline" | "analytics" | "tracking" | "sentiment" | "daily" | "contacts";

interface OutreachEntry {
  id: string;
  platform: string;
  business_name: string;
  recipient_handle: string;
  message_text: string;
  status: string;
  reply_text: string | null;
  sent_at: string;
  source: string;
  ai_generated: boolean;
  sentiment: "positive" | "negative" | "neutral" | null;
  opened: boolean;
  clicked: boolean;
  type: string;
}

const MOCK_ENTRIES: OutreachEntry[] = [
  { id: "1", platform: "email", business_name: "Bright Smile Dental", recipient_handle: "info@brightsmile.com", message_text: "Hey Dr. Smith, I came across Bright Smile Dental and love what you're doing. We help dental practices get 2-3x more patients...", status: "replied", reply_text: "Yes, I'd love to learn more about your services. Can we set up a call this week?", sent_at: "2026-04-14T08:30:00Z", source: "sequence", ai_generated: true, sentiment: "positive", opened: true, clicked: true, type: "cold_email" },
  { id: "2", platform: "instagram", business_name: "Peak Fitness Gym", recipient_handle: "@peakfitness", message_text: "Hey! I came across Peak Fitness and love what you're doing. We help gyms get more members through social media...", status: "replied", reply_text: "Not interested at this time, thanks.", sent_at: "2026-04-14T09:15:00Z", source: "manual", ai_generated: false, sentiment: "negative", opened: true, clicked: false, type: "cold_dm" },
  { id: "3", platform: "email", business_name: "Atlas Legal Group", recipient_handle: "info@atlaslegal.com", message_text: "Following up on my last email about helping Atlas Legal Group attract more clients through digital marketing...", status: "delivered", reply_text: null, sent_at: "2026-04-14T10:00:00Z", source: "sequence", ai_generated: true, sentiment: null, opened: true, clicked: false, type: "follow_up" },
  { id: "4", platform: "linkedin", business_name: "CloudNine HVAC", recipient_handle: "Tom Johnson", message_text: "Hey Tom, noticed CloudNine HVAC is crushing it. We help HVAC companies get more service calls through targeted ads...", status: "sent", reply_text: null, sent_at: "2026-04-14T11:30:00Z", source: "manual", ai_generated: false, sentiment: null, opened: false, clicked: false, type: "cold_dm" },
  { id: "5", platform: "call", business_name: "Swift Plumbing Co", recipient_handle: "+1 (555) 456-7890", message_text: "Cold call - discussed marketing services, owner interested in ads. Scheduled follow-up for next week.", status: "completed", reply_text: "Interested, send proposal", sent_at: "2026-04-14T13:00:00Z", source: "manual", ai_generated: false, sentiment: "positive", opened: false, clicked: false, type: "cold_call" },
  { id: "6", platform: "email", business_name: "Green Lawn Masters", recipient_handle: "contact@greenlawn.com", message_text: "I put together a free marketing audit for Green Lawn Masters - no strings attached. Want me to send it over?", status: "bounced", reply_text: null, sent_at: "2026-04-13T14:30:00Z", source: "sequence", ai_generated: true, sentiment: null, opened: false, clicked: false, type: "cold_email" },
  { id: "7", platform: "facebook", business_name: "Sunrise Bakery", recipient_handle: "Sunrise Bakery", message_text: "Love your pastries! We help local bakeries get more foot traffic through Instagram and Facebook ads...", status: "replied", reply_text: "Interesting! Let me think about it and get back to you.", sent_at: "2026-04-13T10:00:00Z", source: "manual", ai_generated: false, sentiment: "neutral", opened: true, clicked: false, type: "cold_dm" },
  { id: "8", platform: "email", business_name: "Elite Auto Detailing", recipient_handle: "elite@autodetail.com", message_text: "Great talking today! As discussed, here's the proposal for Elite Auto Detailing's marketing...", status: "replied", reply_text: "Looks great, let's move forward with the Growth Package!", sent_at: "2026-04-12T16:00:00Z", source: "manual", ai_generated: false, sentiment: "positive", opened: true, clicked: true, type: "follow_up" },
  { id: "9", platform: "tiktok", business_name: "Zen Yoga Studio", recipient_handle: "@zenyoga", message_text: "Your content is amazing! We help yoga studios grow their online presence and get more class bookings...", status: "sent", reply_text: null, sent_at: "2026-04-12T11:00:00Z", source: "sequence", ai_generated: true, sentiment: null, opened: false, clicked: false, type: "cold_dm" },
  { id: "10", platform: "email", business_name: "TrueNorth Roofing", recipient_handle: "info@truenorthroofing.com", message_text: "Last try - I created a free marketing audit for TrueNorth Roofing showing 3 quick wins...", status: "delivered", reply_text: null, sent_at: "2026-04-11T09:00:00Z", source: "sequence", ai_generated: true, sentiment: null, opened: true, clicked: false, type: "cold_email" },
];

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Camera size={14} className="text-pink-400" />,
  facebook: <MessageSquare size={14} className="text-blue-400" />,
  tiktok: <Music size={14} className="text-white" />,
  linkedin: <Briefcase size={14} className="text-blue-400" />,
  email: <Mail size={14} className="text-gold" />,
  call: <Phone size={14} className="text-green-400" />,
};

const SENTIMENT_CONFIG = {
  positive: { icon: <ThumbsUp size={10} />, color: "text-green-400", bg: "bg-green-400/10" },
  negative: { icon: <ThumbsDown size={10} />, color: "text-red-400", bg: "bg-red-400/10" },
  neutral: { icon: <Minus size={10} />, color: "text-yellow-400", bg: "bg-yellow-400/10" },
};

export default function OutreachLogsPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("timeline");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = MOCK_ENTRIES.filter(e =>
    (platformFilter === "all" || e.platform === platformFilter) &&
    (statusFilter === "all" || e.status === statusFilter) &&
    (typeFilter === "all" || e.type === typeFilter) &&
    (!search || e.business_name.toLowerCase().includes(search.toLowerCase()) || e.recipient_handle.toLowerCase().includes(search.toLowerCase()) || e.message_text.toLowerCase().includes(search.toLowerCase())) &&
    (!dateFilter || e.sent_at.startsWith(dateFilter))
  );

  const totalSent = MOCK_ENTRIES.length;
  const replied = MOCK_ENTRIES.filter(e => e.status === "replied" || e.status === "completed").length;
  const bounced = MOCK_ENTRIES.filter(e => e.status === "bounced").length;
  const opened = MOCK_ENTRIES.filter(e => e.opened).length;
  const clicked = MOCK_ENTRIES.filter(e => e.clicked).length;
  const replyRate = totalSent > 0 ? ((replied / totalSent) * 100).toFixed(1) : "0";
  const openRate = totalSent > 0 ? ((opened / totalSent) * 100).toFixed(1) : "0";
  const clickRate = opened > 0 ? ((clicked / opened) * 100).toFixed(1) : "0";

  const positiveReplies = MOCK_ENTRIES.filter(e => e.sentiment === "positive").length;
  const negativeReplies = MOCK_ENTRIES.filter(e => e.sentiment === "negative").length;
  const neutralReplies = MOCK_ENTRIES.filter(e => e.sentiment === "neutral").length;

  function exportCSV() {
    const csv = "Business,Platform,Handle,Type,Status,Sentiment,Message,Reply,Sent At\n" +
      filtered.map(e => `"${e.business_name}","${e.platform}","${e.recipient_handle}","${e.type}","${e.status}","${e.sentiment || ""}","${(e.message_text || "").replace(/"/g, '""').substring(0, 200)}","${(e.reply_text || "").replace(/"/g, '""')}","${e.sent_at}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "outreach_logs.csv"; a.click();
  }

  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "timeline", label: "Activity Timeline", icon: <Activity size={14} /> },
    { key: "analytics", label: "Response Analytics", icon: <BarChart3 size={14} /> },
    { key: "tracking", label: "Open & Click Tracking", icon: <Eye size={14} /> },
    { key: "sentiment", label: "Sentiment Analysis", icon: <ThumbsUp size={14} /> },
    { key: "daily", label: "Daily Summary", icon: <Calendar size={14} /> },
    { key: "contacts", label: "Contact Drill-down", icon: <Users size={14} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Send size={18} className="text-gold" /> Outreach Logs
          </h1>
          <p className="text-xs text-muted mt-0.5">Every DM, email, and call with sentiment analysis and tracking</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-xs flex items-center gap-1.5"><RefreshCw size={12} /> Refresh</button>
          <button onClick={exportCSV} className="btn-secondary text-xs flex items-center gap-1.5"><Download size={12} /> Export</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
        {[
          { label: "Total Sent", value: totalSent, icon: <Send size={12} />, color: "text-gold" },
          { label: "Open Rate", value: `${openRate}%`, icon: <Eye size={12} />, color: "text-blue-400" },
          { label: "Reply Rate", value: `${replyRate}%`, icon: <MessageSquare size={12} />, color: "text-green-400" },
          { label: "Click Rate", value: `${clickRate}%`, icon: <MousePointerClick size={12} />, color: "text-purple-400" },
          { label: "Bounced", value: bounced, icon: <XCircle size={12} />, color: "text-red-400" },
          { label: "Positive", value: positiveReplies, icon: <ThumbsUp size={12} />, color: "text-green-400" },
        ].map((stat, i) => (
          <div key={i} className="card text-center p-3">
            <div className={`w-7 h-7 rounded-lg mx-auto mb-1 flex items-center justify-center bg-white/5 ${stat.color}`}>{stat.icon}</div>
            <p className="text-lg font-bold">{stat.value}</p>
            <p className="text-[9px] text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-xs rounded-md flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"
            }`}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* ===== ACTIVITY TIMELINE ===== */}
      {activeTab === "timeline" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="input w-full pl-8 text-xs" />
            </div>
            <div className="flex gap-1">
              {["all", "instagram", "facebook", "linkedin", "tiktok", "email", "call"].map(p => (
                <button key={p} onClick={() => setPlatformFilter(p)}
                  className={`text-[10px] px-2 py-1.5 rounded-lg capitalize flex items-center gap-1 ${
                    platformFilter === p ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.05]"
                  }`}>
                  {p !== "all" && PLATFORM_ICONS[p]}
                  {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input text-xs py-1.5">
              <option value="all">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="replied">Replied</option>
              <option value="bounced">Bounced</option>
              <option value="completed">Completed</option>
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input text-xs py-1.5">
              <option value="all">All Types</option>
              <option value="cold_email">Cold Email</option>
              <option value="cold_dm">Cold DM</option>
              <option value="cold_call">Cold Call</option>
              <option value="follow_up">Follow Up</option>
            </select>
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input text-xs py-1.5" />
          </div>

          {/* Visual Timeline */}
          <div className="space-y-0">
            {filtered.map((entry, idx) => {
              const isExpanded = expandedId === entry.id;
              const sentDate = new Date(entry.sent_at);
              const timeStr = sentDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
              const dateStr = sentDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              return (
                <div key={entry.id} className="flex gap-3">
                  {/* Timeline rail */}
                  <div className="flex flex-col items-center w-6 flex-shrink-0">
                    <div className={`w-3 h-3 rounded-full border-2 ${
                      entry.status === "replied" || entry.status === "completed" ? "border-green-400 bg-green-400/30" :
                      entry.status === "bounced" ? "border-red-400 bg-red-400/30" :
                      entry.status === "delivered" ? "border-blue-400 bg-blue-400/30" :
                      "border-muted bg-surface-light"
                    }`} />
                    {idx < filtered.length - 1 && <div className="w-px flex-1 bg-border min-h-[20px]" />}
                  </div>

                  {/* Entry card */}
                  <div className={`flex-1 mb-2 p-3 rounded-xl transition-all cursor-pointer ${
                    entry.status === "replied" || entry.status === "completed" ? "bg-green-400/[0.03] border border-green-400/10" :
                    entry.status === "bounced" ? "bg-red-400/[0.03] border border-red-400/10" :
                    "bg-surface-light border border-border"
                  }`} onClick={() => setExpandedId(isExpanded ? null : entry.id)}>
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">{PLATFORM_ICONS[entry.platform] || <Globe size={14} className="text-muted" />}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium truncate">{entry.business_name}</p>
                          {entry.ai_generated && <span className="text-[8px] bg-gold/10 text-gold px-1 py-0.5 rounded">AI</span>}
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-muted capitalize">{entry.type.replace("_", " ")}</span>
                          {entry.sentiment && (
                            <span className={`text-[8px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${SENTIMENT_CONFIG[entry.sentiment].bg} ${SENTIMENT_CONFIG[entry.sentiment].color}`}>
                              {SENTIMENT_CONFIG[entry.sentiment].icon} {entry.sentiment}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted truncate">{entry.message_text}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {entry.opened && <Eye size={9} className="text-blue-400" />}
                        {entry.clicked && <MousePointerClick size={9} className="text-purple-400" />}
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                          entry.status === "replied" || entry.status === "completed" ? "bg-green-400/10 text-green-400" :
                          entry.status === "bounced" ? "bg-red-400/10 text-red-400" :
                          entry.status === "delivered" ? "bg-blue-400/10 text-blue-400" :
                          "bg-white/5 text-muted"
                        }`}>{entry.status}</span>
                        <div className="text-right">
                          <p className="text-[8px] text-muted">{dateStr}</p>
                          <p className="text-[8px] text-muted">{timeStr}</p>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        <div>
                          <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Message Sent</p>
                          <div className="bg-gold/[0.03] border border-gold/10 rounded-lg p-2.5">
                            <p className="text-[11px] whitespace-pre-wrap leading-relaxed">{entry.message_text}</p>
                          </div>
                        </div>
                        {entry.reply_text && (
                          <div>
                            <p className="text-[9px] text-green-400 uppercase tracking-wider mb-1">Reply</p>
                            <div className="bg-green-400/[0.03] border border-green-400/10 rounded-lg p-2.5">
                              <p className="text-[11px] whitespace-pre-wrap leading-relaxed">{entry.reply_text}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-[9px] text-muted">
                          <span>Platform: {entry.platform}</span>
                          <span>Handle: {entry.recipient_handle}</span>
                          <span>Source: {entry.source}</span>
                          {entry.opened && <span className="text-blue-400">Opened</span>}
                          {entry.clicked && <span className="text-purple-400">Clicked</span>}
                          {entry.ai_generated && <span className="text-gold">AI Generated</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== RESPONSE ANALYTICS ===== */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Response Rate Chart */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Response Rate by Platform</h3>
              <div className="space-y-3">
                {["email", "instagram", "linkedin", "facebook", "tiktok", "call"].map(platform => {
                  const platformEntries = MOCK_ENTRIES.filter(e => e.platform === platform);
                  const platformReplied = platformEntries.filter(e => e.status === "replied" || e.status === "completed").length;
                  const rate = platformEntries.length > 0 ? ((platformReplied / platformEntries.length) * 100) : 0;
                  return (
                    <div key={platform}>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="flex items-center gap-1.5 capitalize">{PLATFORM_ICONS[platform]} {platform}</span>
                        <span className="font-bold">{rate.toFixed(0)}% ({platformReplied}/{platformEntries.length})</span>
                      </div>
                      <div className="w-full bg-surface-light rounded-full h-2">
                        <div className="bg-gold rounded-full h-2" style={{ width: `${Math.max(rate, 2)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Response Rate by Type */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Response Rate by Outreach Type</h3>
              <div className="space-y-3">
                {["cold_email", "cold_dm", "cold_call", "follow_up"].map(type => {
                  const typeEntries = MOCK_ENTRIES.filter(e => e.type === type);
                  const typeReplied = typeEntries.filter(e => e.status === "replied" || e.status === "completed").length;
                  const rate = typeEntries.length > 0 ? ((typeReplied / typeEntries.length) * 100) : 0;
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="capitalize">{type.replace("_", " ")}</span>
                        <span className="font-bold">{rate.toFixed(0)}% ({typeReplied}/{typeEntries.length})</span>
                      </div>
                      <div className="w-full bg-surface-light rounded-full h-2">
                        <div className="bg-blue-400 rounded-full h-2" style={{ width: `${Math.max(rate, 2)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {/* Bounce log */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <XCircle size={14} className="text-red-400" /> Bounce Log
            </h3>
            <div className="space-y-1.5">
              {MOCK_ENTRIES.filter(e => e.status === "bounced").map(e => (
                <div key={e.id} className="flex items-center justify-between p-2.5 rounded bg-red-400/5 border border-red-400/10 text-[10px]">
                  <div className="flex items-center gap-2">
                    <XCircle size={10} className="text-red-400" />
                    <span className="font-medium">{e.business_name}</span>
                    <span className="text-muted font-mono">{e.recipient_handle}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted">{e.platform}</span>
                    <span className="text-red-400">Bounced</span>
                    <span className="text-muted">{new Date(e.sent_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {MOCK_ENTRIES.filter(e => e.status === "bounced").length === 0 && (
                <p className="text-[10px] text-muted text-center py-4">No bounced messages</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== OPEN & CLICK TRACKING ===== */}
      {activeTab === "tracking" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Emails Opened", value: opened, total: totalSent, color: "text-blue-400" },
              { label: "Links Clicked", value: clicked, total: opened, color: "text-purple-400" },
              { label: "Open Rate", value: `${openRate}%`, total: null, color: "text-blue-400" },
              { label: "Click-to-Open", value: `${clickRate}%`, total: null, color: "text-purple-400" },
            ].map((stat, i) => (
              <div key={i} className="card text-center p-3">
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-[9px] text-muted">{stat.label}</p>
                {stat.total !== null && <p className="text-[8px] text-muted">of {stat.total}</p>}
              </div>
            ))}
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold mb-3">Email Open & Click Tracking</h3>
            <div className="space-y-1.5">
              <div className="grid grid-cols-6 text-[9px] text-muted uppercase tracking-wider font-semibold py-1.5 px-2">
                <span className="col-span-2">Recipient</span><span>Platform</span><span className="text-center">Opened</span><span className="text-center">Clicked</span><span className="text-center">Status</span>
              </div>
              {MOCK_ENTRIES.map(e => (
                <div key={e.id} className="grid grid-cols-6 items-center text-[10px] py-2 px-2 rounded bg-surface-light">
                  <div className="col-span-2">
                    <p className="font-medium">{e.business_name}</p>
                    <p className="text-[9px] text-muted">{e.recipient_handle}</p>
                  </div>
                  <span className="capitalize flex items-center gap-1">{PLATFORM_ICONS[e.platform]} {e.platform}</span>
                  <div className="text-center">
                    {e.opened ? <CheckCircle size={12} className="text-blue-400 mx-auto" /> : <Minus size={12} className="text-muted mx-auto" />}
                  </div>
                  <div className="text-center">
                    {e.clicked ? <CheckCircle size={12} className="text-purple-400 mx-auto" /> : <Minus size={12} className="text-muted mx-auto" />}
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full mx-auto ${
                    e.status === "replied" || e.status === "completed" ? "bg-green-400/10 text-green-400" :
                    e.status === "bounced" ? "bg-red-400/10 text-red-400" :
                    "bg-white/5 text-muted"
                  }`}>{e.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== SENTIMENT ANALYSIS ===== */}
      {activeTab === "sentiment" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center p-5 border-green-400/10">
              <ThumbsUp size={24} className="mx-auto mb-2 text-green-400" />
              <p className="text-2xl font-bold text-green-400">{positiveReplies}</p>
              <p className="text-[10px] text-muted">Positive Replies</p>
              <p className="text-[9px] text-green-400 mt-1">{replied > 0 ? Math.round((positiveReplies / replied) * 100) : 0}% of replies</p>
            </div>
            <div className="card text-center p-5 border-yellow-400/10">
              <Minus size={24} className="mx-auto mb-2 text-yellow-400" />
              <p className="text-2xl font-bold text-yellow-400">{neutralReplies}</p>
              <p className="text-[10px] text-muted">Neutral Replies</p>
              <p className="text-[9px] text-yellow-400 mt-1">{replied > 0 ? Math.round((neutralReplies / replied) * 100) : 0}% of replies</p>
            </div>
            <div className="card text-center p-5 border-red-400/10">
              <ThumbsDown size={24} className="mx-auto mb-2 text-red-400" />
              <p className="text-2xl font-bold text-red-400">{negativeReplies}</p>
              <p className="text-[10px] text-muted">Negative Replies</p>
              <p className="text-[9px] text-red-400 mt-1">{replied > 0 ? Math.round((negativeReplies / replied) * 100) : 0}% of replies</p>
            </div>
          </div>

          {/* Reply Categorization */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3">Reply Categorization</h3>
            <div className="space-y-2">
              {MOCK_ENTRIES.filter(e => e.reply_text).map(e => (
                <div key={e.id} className={`p-3 rounded-lg border ${
                  e.sentiment === "positive" ? "bg-green-400/[0.03] border-green-400/10" :
                  e.sentiment === "negative" ? "bg-red-400/[0.03] border-red-400/10" :
                  "bg-yellow-400/[0.03] border-yellow-400/10"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{e.business_name}</span>
                      {e.sentiment && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${SENTIMENT_CONFIG[e.sentiment].bg} ${SENTIMENT_CONFIG[e.sentiment].color}`}>
                          {SENTIMENT_CONFIG[e.sentiment].icon} {e.sentiment}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-muted">{new Date(e.sent_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[10px] text-muted italic">&quot;{e.reply_text}&quot;</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== DAILY SUMMARY ===== */}
      {activeTab === "daily" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Calendar size={14} className="text-gold" /> Daily Activity Summary
          </h3>
          <div className="space-y-3">
            {[
              { date: "Apr 14, 2026", emails: 4, dms: 1, calls: 1, replies: 2, positive: 1, opens: 3 },
              { date: "Apr 13, 2026", emails: 1, dms: 1, calls: 0, replies: 1, positive: 0, opens: 1 },
              { date: "Apr 12, 2026", emails: 1, dms: 1, calls: 0, replies: 1, positive: 1, opens: 1 },
              { date: "Apr 11, 2026", emails: 1, dms: 0, calls: 0, replies: 0, positive: 0, opens: 1 },
            ].map((day, i) => (
              <div key={i} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold">{day.date}</p>
                  <span className="text-[9px] text-muted">{day.emails + day.dms + day.calls} total actions</span>
                </div>
                <div className="grid grid-cols-6 gap-3 text-center">
                  <div className="bg-surface-light rounded-lg p-2">
                    <p className="text-sm font-bold text-gold">{day.emails}</p>
                    <p className="text-[8px] text-muted">Emails</p>
                  </div>
                  <div className="bg-surface-light rounded-lg p-2">
                    <p className="text-sm font-bold text-pink-400">{day.dms}</p>
                    <p className="text-[8px] text-muted">DMs</p>
                  </div>
                  <div className="bg-surface-light rounded-lg p-2">
                    <p className="text-sm font-bold text-green-400">{day.calls}</p>
                    <p className="text-[8px] text-muted">Calls</p>
                  </div>
                  <div className="bg-surface-light rounded-lg p-2">
                    <p className="text-sm font-bold text-blue-400">{day.opens}</p>
                    <p className="text-[8px] text-muted">Opens</p>
                  </div>
                  <div className="bg-surface-light rounded-lg p-2">
                    <p className="text-sm font-bold text-purple-400">{day.replies}</p>
                    <p className="text-[8px] text-muted">Replies</p>
                  </div>
                  <div className="bg-surface-light rounded-lg p-2">
                    <p className="text-sm font-bold text-green-400">{day.positive}</p>
                    <p className="text-[8px] text-muted">Positive</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== CONTACT DRILL-DOWN ===== */}
      {activeTab === "contacts" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users size={14} className="text-gold" /> Contact Activity Drill-down
          </h3>
          <div className="space-y-3">
            {Array.from(new Set(MOCK_ENTRIES.map(e => e.business_name))).map(business => {
              const entries = MOCK_ENTRIES.filter(e => e.business_name === business);
              const latestSentiment = entries.find(e => e.sentiment)?.sentiment;
              return (
                <div key={business} className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold">{business}</p>
                      {latestSentiment && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${SENTIMENT_CONFIG[latestSentiment].bg} ${SENTIMENT_CONFIG[latestSentiment].color}`}>
                          {SENTIMENT_CONFIG[latestSentiment].icon} {latestSentiment}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-muted">{entries.length} touchpoints</span>
                  </div>
                  <div className="space-y-1">
                    {entries.map(e => (
                      <div key={e.id} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-surface-light">
                        <div className="w-4">{PLATFORM_ICONS[e.platform]}</div>
                        <span className="capitalize text-muted w-16">{e.type.replace("_", " ")}</span>
                        <span className={`text-[9px] px-1 py-0.5 rounded ${
                          e.status === "replied" || e.status === "completed" ? "bg-green-400/10 text-green-400" :
                          e.status === "bounced" ? "bg-red-400/10 text-red-400" :
                          "bg-white/5 text-muted"
                        }`}>{e.status}</span>
                        {e.opened && <Eye size={8} className="text-blue-400" />}
                        {e.clicked && <MousePointerClick size={8} className="text-purple-400" />}
                        <span className="text-muted ml-auto">{new Date(e.sent_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
