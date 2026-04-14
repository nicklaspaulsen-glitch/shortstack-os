"use client";

import { useState } from "react";
import {
  Tag, Plus, Trash2, Search, Users,
  BarChart3, Merge, Download, Upload,
  Zap, X, Edit3, FolderTree, Clock, Filter
} from "lucide-react";

type TagTab = "manager" | "rules" | "analytics" | "hierarchy";

interface TagItem {
  id: string;
  name: string;
  color: string;
  count: number;
  category: string;
  parent: string | null;
  autoRule: string | null;
  lastUsed: string;
}

interface AutoRule {
  id: string;
  name: string;
  condition: string;
  tag: string;
  active: boolean;
  triggered: number;
}

const TAG_COLORS = [
  "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#14b8a6",
];

const CATEGORIES = ["Lead Status", "Priority", "Source", "Industry", "Custom"];

const MOCK_TAGS: TagItem[] = [
  { id: "t1", name: "hot-lead", color: "#ef4444", count: 24, category: "Lead Status", parent: null, autoRule: "Score > 80", lastUsed: "2026-04-14" },
  { id: "t2", name: "warm-lead", color: "#f59e0b", count: 42, category: "Lead Status", parent: null, autoRule: "Score 50-80", lastUsed: "2026-04-14" },
  { id: "t3", name: "cold-lead", color: "#3b82f6", count: 67, category: "Lead Status", parent: null, autoRule: "Score < 50", lastUsed: "2026-04-13" },
  { id: "t4", name: "booked-call", color: "#10b981", count: 18, category: "Lead Status", parent: null, autoRule: "Appointment created", lastUsed: "2026-04-14" },
  { id: "t5", name: "sent-proposal", color: "#8b5cf6", count: 12, category: "Lead Status", parent: null, autoRule: null, lastUsed: "2026-04-12" },
  { id: "t6", name: "closed-won", color: "#c8a855", count: 8, category: "Lead Status", parent: null, autoRule: "Deal status = won", lastUsed: "2026-04-10" },
  { id: "t7", name: "closed-lost", color: "#6b7280", count: 5, category: "Lead Status", parent: null, autoRule: "Deal status = lost", lastUsed: "2026-04-09" },
  { id: "t8", name: "needs-followup", color: "#f97316", count: 31, category: "Priority", parent: null, autoRule: "No contact in 7d", lastUsed: "2026-04-14" },
  { id: "t9", name: "cold-outreach", color: "#06b6d4", count: 56, category: "Source", parent: null, autoRule: null, lastUsed: "2026-04-13" },
  { id: "t10", name: "referral", color: "#ec4899", count: 9, category: "Source", parent: null, autoRule: null, lastUsed: "2026-04-11" },
  { id: "t11", name: "vip-client", color: "#c8a855", count: 5, category: "Priority", parent: null, autoRule: "MRR > $3000", lastUsed: "2026-04-14" },
  { id: "t12", name: "high-budget", color: "#10b981", count: 7, category: "Priority", parent: null, autoRule: null, lastUsed: "2026-04-12" },
  { id: "t13", name: "dental", color: "#3b82f6", count: 15, category: "Industry", parent: null, autoRule: null, lastUsed: "2026-04-13" },
  { id: "t14", name: "fitness", color: "#ef4444", count: 11, category: "Industry", parent: null, autoRule: null, lastUsed: "2026-04-11" },
  { id: "t15", name: "real-estate", color: "#8b5cf6", count: 8, category: "Industry", parent: null, autoRule: null, lastUsed: "2026-04-10" },
];

const MOCK_RULES: AutoRule[] = [
  { id: "r1", name: "Hot Lead Auto-tag", condition: "Lead score > 80", tag: "hot-lead", active: true, triggered: 24 },
  { id: "r2", name: "Warm Lead Auto-tag", condition: "Lead score 50-80", tag: "warm-lead", active: true, triggered: 42 },
  { id: "r3", name: "Needs Follow-up", condition: "No contact in 7 days", tag: "needs-followup", active: true, triggered: 31 },
  { id: "r4", name: "VIP Auto-tag", condition: "MRR > $3,000", tag: "vip-client", active: true, triggered: 5 },
  { id: "r5", name: "Won Deal Tag", condition: "Deal status changes to won", tag: "closed-won", active: true, triggered: 8 },
  { id: "r6", name: "Booked Appointment", condition: "Calendar event created", tag: "booked-call", active: false, triggered: 0 },
];

export default function TagsPage() {
  const [tab, setTab] = useState<TagTab>("manager");
  const [tags, setTags] = useState<TagItem[]>(MOCK_TAGS);
  const [rules, setRules] = useState(MOCK_RULES);
  const [search, setSearch] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [newCategory, setNewCategory] = useState("Custom");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showMerge, setShowMerge] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);

  const totalLeads = tags.reduce((s, t) => s + t.count, 0);
  const autoTagged = tags.filter(t => t.autoRule).length;

  function addTag() {
    if (!newTag.trim()) return;
    const slug = newTag.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (tags.find(t => t.name === slug)) return;
    setTags(prev => [...prev, {
      id: `t_${Date.now()}`, name: slug, color: newColor, count: 0,
      category: newCategory, parent: null, autoRule: null, lastUsed: "2026-04-14",
    }]);
    setNewTag("");
  }

  function removeTag(id: string) {
    setTags(prev => prev.filter(t => t.id !== id));
    setSelectedTags(prev => prev.filter(t => t !== id));
  }

  function toggleSelect(id: string) {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }

  function mergeTags() {
    if (selectedTags.length < 2) return;
    const keep = tags.find(t => t.id === selectedTags[0]);
    if (!keep) return;
    const mergedCount = tags.filter(t => selectedTags.includes(t.id)).reduce((s, t) => s + t.count, 0);
    setTags(prev => prev.filter(t => !selectedTags.includes(t.id) || t.id === selectedTags[0]).map(t => t.id === selectedTags[0] ? { ...t, count: mergedCount } : t));
    setSelectedTags([]);
    setShowMerge(false);
  }

  const filtered = tags
    .filter(t => t.name.includes(search.toLowerCase()))
    .filter(t => categoryFilter === "All" || t.category === categoryFilter);

  const recentTags = [...tags].sort((a, b) => b.lastUsed.localeCompare(a.lastUsed)).slice(0, 5);

  const TABS: { id: TagTab; label: string; icon: React.ReactNode }[] = [
    { id: "manager", label: "Tag Manager", icon: <Tag size={13} /> },
    { id: "rules", label: "Auto Rules", icon: <Zap size={13} /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 size={13} /> },
    { id: "hierarchy", label: "Hierarchy", icon: <FolderTree size={13} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2"><Tag size={18} className="text-gold" /> Tags</h1>
          <p className="text-xs text-muted mt-0.5">{tags.length} tags - {totalLeads} total uses</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedTags.length >= 2 && (
            <button onClick={() => setShowMerge(true)} className="btn-secondary text-xs flex items-center gap-1.5"><Merge size={12} /> Merge ({selectedTags.length})</button>
          )}
          <button className="btn-secondary text-xs flex items-center gap-1.5"><Download size={12} /> Export</button>
          <button className="btn-secondary text-xs flex items-center gap-1.5"><Upload size={12} /> Import</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{tags.length}</p>
          <p className="text-[10px] text-muted">Total Tags</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-gold">{autoTagged}</p>
          <p className="text-[10px] text-muted">Auto-tagged</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-blue-400">{CATEGORIES.length}</p>
          <p className="text-[10px] text-muted">Categories</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-emerald-400">{rules.filter(r => r.active).length}</p>
          <p className="text-[10px] text-muted">Active Rules</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
              tab === t.id ? "bg-gold/10 text-gold font-medium" : "text-muted hover:text-foreground"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tag Manager */}
      {tab === "manager" && (
        <div className="space-y-4">
          {/* Add tag */}
          <div className="card">
            <h2 className="section-header">Create Tag</h2>
            <div className="flex gap-2 flex-wrap">
              <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag()}
                className="input flex-1 text-xs min-w-[200px]" placeholder="New tag name..." />
              <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="input text-xs w-32">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex gap-1">
                {TAG_COLORS.map(c => (
                  <button key={c} onClick={() => setNewColor(c)}
                    className={`w-6 h-6 rounded-md transition-all ${newColor === c ? "ring-2 ring-white/30 scale-110" : ""}`}
                    style={{ background: c }} />
                ))}
              </div>
              <button onClick={addTag} className="btn-primary text-xs flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="input w-full text-xs pl-8" placeholder="Search tags..." />
            </div>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="input text-xs w-36">
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Recent Tags */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Clock size={13} className="text-blue-400" /> Recently Used</h2>
            <div className="flex flex-wrap gap-2">
              {recentTags.map(tag => (
                <span key={tag.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: tag.color }} />
                  {tag.name}
                  <span className="text-[9px] text-muted">({tag.count})</span>
                </span>
              ))}
            </div>
          </div>

          {/* Tag grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {filtered.map(tag => (
              <div key={tag.id} className={`flex items-center justify-between p-3 rounded-xl group transition-all bg-surface-light border ${selectedTags.includes(tag.id) ? "border-gold" : "border-border"}`}>
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <button onClick={() => toggleSelect(tag.id)}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedTags.includes(tag.id) ? "border-gold bg-gold" : "border-border"}`}>
                      {selectedTags.includes(tag.id) && <span className="text-[8px] text-black font-bold">&#10003;</span>}
                    </div>
                  </button>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: tag.color }} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{tag.name}</p>
                    <div className="flex items-center gap-2 text-[9px] text-muted">
                      <span className="flex items-center gap-0.5"><Users size={8} /> {tag.count}</span>
                      <span>{tag.category}</span>
                      {tag.autoRule && <Zap size={8} className="text-gold" />}
                    </div>
                  </div>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditingTag(editingTag === tag.id ? null : tag.id)} className="text-muted hover:text-foreground p-1"><Edit3 size={10} /></button>
                  <button onClick={() => removeTag(tag.id)} className="text-muted hover:text-red-400 p-1"><Trash2 size={10} /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Bulk Operations */}
          {selectedTags.length > 0 && (
            <div className="card p-3 flex items-center justify-between">
              <span className="text-xs text-muted">{selectedTags.length} tags selected</span>
              <div className="flex gap-2">
                <button onClick={mergeTags} className="btn-secondary text-[10px] flex items-center gap-1"><Merge size={10} /> Merge</button>
                <button onClick={() => { selectedTags.forEach(id => removeTag(id)); }} className="btn-secondary text-[10px] flex items-center gap-1 text-red-400"><Trash2 size={10} /> Delete All</button>
                <button onClick={() => setSelectedTags([])} className="btn-ghost text-[10px]">Clear</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Auto Rules Tab */}
      {tab === "rules" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Zap size={13} className="text-gold" /> Smart Auto-Tagging Rules</h2>
            <div className="space-y-2">
              {rules.map(rule => (
                <div key={rule.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-light border border-border">
                  <Zap size={14} className={rule.active ? "text-gold" : "text-muted/30"} />
                  <div className="flex-1">
                    <p className="text-xs font-semibold">{rule.name}</p>
                    <p className="text-[10px] text-muted">When: {rule.condition} → Apply: <span className="text-gold">{rule.tag}</span></p>
                  </div>
                  <span className="text-[9px] text-muted">{rule.triggered} triggered</span>
                  <button onClick={() => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r))}
                    className={`w-10 h-5 rounded-full transition-all relative ${rule.active ? "bg-gold" : "bg-surface"}`}>
                    <div className="w-4 h-4 rounded-full bg-white absolute top-0.5" style={{ left: rule.active ? 22 : 2 }} />
                  </button>
                </div>
              ))}
            </div>
            <button className="btn-secondary text-xs mt-3 flex items-center gap-1.5"><Plus size={12} /> Add Rule</button>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {tab === "analytics" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><BarChart3 size={13} className="text-gold" /> Tag Usage Stats</h2>
            <div className="space-y-2">
              {[...tags].sort((a, b) => b.count - a.count).slice(0, 10).map(tag => {
                const pct = (tag.count / Math.max(...tags.map(t => t.count), 1)) * 100;
                return (
                  <div key={tag.id} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: tag.color }} />
                    <span className="text-xs w-28 truncate">{tag.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-surface-light overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tag.color }} />
                    </div>
                    <span className="text-xs font-bold w-10 text-right">{tag.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Filter size={13} className="text-blue-400" /> Tags by Category</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {CATEGORIES.map(cat => {
                const catTags = tags.filter(t => t.category === cat);
                const catCount = catTags.reduce((s, t) => s + t.count, 0);
                return (
                  <div key={cat} className="p-3 rounded-lg bg-surface-light text-center border border-border">
                    <p className="text-[10px] text-muted">{cat}</p>
                    <p className="text-lg font-bold">{catTags.length}</p>
                    <p className="text-[9px] text-muted">{catCount} uses</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Hierarchy Tab */}
      {tab === "hierarchy" && (
        <div className="card">
          <h2 className="section-header flex items-center gap-2"><FolderTree size={13} className="text-gold" /> Tag Hierarchy</h2>
          <div className="space-y-3">
            {CATEGORIES.map(cat => {
              const catTags = tags.filter(t => t.category === cat);
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-light mb-1">
                    <FolderTree size={12} className="text-gold" />
                    <span className="text-xs font-bold">{cat}</span>
                    <span className="text-[9px] text-muted">({catTags.length} tags)</span>
                  </div>
                  <div className="ml-6 space-y-1">
                    {catTags.map(tag => (
                      <div key={tag.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-white/[0.02]">
                        <div className="w-2 h-2 rounded-full" style={{ background: tag.color }} />
                        <span className="text-[11px]">{tag.name}</span>
                        <span className="text-[9px] text-muted ml-auto">{tag.count} leads</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {showMerge && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowMerge(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Merge size={14} className="text-gold" /> Merge Tags</h3>
              <button onClick={() => setShowMerge(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <p className="text-xs text-muted">The following tags will be merged into one:</p>
            <div className="space-y-1">
              {selectedTags.map((id, idx) => {
                const tag = tags.find(t => t.id === id);
                if (!tag) return null;
                return (
                  <div key={id} className="flex items-center gap-2 p-2 rounded-lg bg-surface-light">
                    <div className="w-3 h-3 rounded-full" style={{ background: tag.color }} />
                    <span className="text-xs">{tag.name}</span>
                    <span className="text-[9px] text-muted">({tag.count} leads)</span>
                    {idx === 0 && <span className="text-[8px] text-gold ml-auto">KEEP</span>}
                    {idx > 0 && <span className="text-[8px] text-red-400 ml-auto">MERGE INTO</span>}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowMerge(false)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={mergeTags} className="btn-primary text-xs flex items-center gap-1.5"><Merge size={12} /> Merge Tags</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
