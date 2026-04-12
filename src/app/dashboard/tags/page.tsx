"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Tag, Plus, Trash2, Search, Users, Loader
} from "lucide-react";
import toast from "react-hot-toast";

interface TagItem {
  name: string;
  color: string;
  count: number;
}

const TAG_COLORS = [
  "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#14b8a6",
];

const DEFAULT_TAGS: TagItem[] = [
  { name: "hot-lead", color: "#ef4444", count: 0 },
  { name: "warm-lead", color: "#f59e0b", count: 0 },
  { name: "cold-lead", color: "#3b82f6", count: 0 },
  { name: "booked-call", color: "#10b981", count: 0 },
  { name: "sent-proposal", color: "#8b5cf6", count: 0 },
  { name: "closed-won", color: "#c8a855", count: 0 },
  { name: "closed-lost", color: "#6b7280", count: 0 },
  { name: "needs-followup", color: "#f97316", count: 0 },
  { name: "cold-outreach", color: "#06b6d4", count: 0 },
  { name: "referral", color: "#ec4899", count: 0 },
  { name: "vip-client", color: "#c8a855", count: 0 },
  { name: "high-budget", color: "#10b981", count: 0 },
];

export default function TagsPage() {
  useAuth();
  const supabase = createClient();
  const [tags, setTags] = useState<TagItem[]>(DEFAULT_TAGS);
  const [search, setSearch] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchTagCounts(); }, []);

  async function fetchTagCounts() {
    setLoading(true);
    try {
    // Count leads per tag by checking lead status and metadata
    const { data: leads } = await supabase.from("leads").select("status, metadata");

    const counts: Record<string, number> = {};
    (leads || []).forEach(l => {
      const tags = (l.metadata as Record<string, unknown>)?.tags;
      if (Array.isArray(tags)) {
        tags.forEach((t: string) => { counts[t] = (counts[t] || 0) + 1; });
      }
      // Also count by status
      if (l.status === "new") counts["cold-lead"] = (counts["cold-lead"] || 0) + 1;
      if (l.status === "contacted") counts["warm-lead"] = (counts["warm-lead"] || 0) + 1;
      if (l.status === "booked") counts["booked-call"] = (counts["booked-call"] || 0) + 1;
      if (l.status === "converted") counts["closed-won"] = (counts["closed-won"] || 0) + 1;
    });

    setTags(prev => prev.map(t => ({ ...t, count: counts[t.name] || 0 })));
    } catch { /* silent — tag counts are non-critical */ }
    setLoading(false);
  }

  function addTag() {
    if (!newTag.trim()) return;
    const slug = newTag.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (tags.find(t => t.name === slug)) { toast.error("Tag already exists"); return; }
    setTags(prev => [...prev, { name: slug, color: newColor, count: 0 }]);
    setNewTag("");
    toast.success(`Tag "${slug}" added`);
  }

  function removeTag(name: string) {
    setTags(prev => prev.filter(t => t.name !== name));
    toast.success("Tag removed");
  }

  const filtered = tags.filter(t => t.name.includes(search.toLowerCase()));

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Tag size={18} className="text-gold" /> Tags
          </h1>
          <p className="text-xs text-muted mt-0.5">Organize leads and clients with tags</p>
        </div>
      </div>

      {/* Add tag */}
      <div className="card">
        <div className="flex gap-2">
          <input value={newTag} onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTag()}
            className="input flex-1 text-xs" placeholder="New tag name..." />
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

      {/* Search */}
      <div className="relative">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="input w-full text-xs pl-8" placeholder="Search tags..." />
      </div>

      {/* Tag grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader size={16} className="animate-spin text-gold" /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {filtered.map(tag => (
            <div key={tag.name} className="flex items-center justify-between p-3 rounded-xl group transition-all bg-surface-light border border-border">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: tag.color }} />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{tag.name}</p>
                  <p className="text-[9px] text-muted flex items-center gap-1">
                    <Users size={8} /> {tag.count} leads
                  </p>
                </div>
              </div>
              <button onClick={() => removeTag(tag.name)}
                className="text-muted/0 group-hover:text-muted hover:text-danger transition-all p-1">
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
