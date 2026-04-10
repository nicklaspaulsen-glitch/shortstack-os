"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  PieChart as PieIcon, MapPin, Globe, MessageSquare,
  Users, Phone, FileText, Loader
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const SOURCE_COLORS: Record<string, string> = {
  google_maps: "#4285f4",
  cold_outreach: "#c8a855",
  referral: "#10b981",
  website: "#8b5cf6",
  social_media: "#ec4899",
  ads: "#f59e0b",
  form: "#3b82f6",
  csv_import: "#06b6d4",
  manual: "#6b7280",
  unknown: "#374151",
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  google_maps: <MapPin size={14} />,
  cold_outreach: <MessageSquare size={14} />,
  referral: <Users size={14} />,
  website: <Globe size={14} />,
  social_media: <Phone size={14} />,
  form: <FileText size={14} />,
};

export default function LeadSourcesPage() {
  useAuth();
  const supabase = createClient();
  const [sources, setSources] = useState<Array<{ source: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [totalLeads, setTotalLeads] = useState(0);

  useEffect(() => { fetchSources(); }, []);

  async function fetchSources() {
    setLoading(true);
    const { data } = await supabase.from("leads").select("source");

    const counts: Record<string, number> = {};
    (data || []).forEach(l => {
      const src = l.source || "unknown";
      // Normalize source names
      const normalized = src.includes("form") ? "form" : src.includes("csv") ? "csv_import" : src;
      counts[normalized] = (counts[normalized] || 0) + 1;
    });

    const sorted = Object.entries(counts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    setSources(sorted);
    setTotalLeads(sorted.reduce((s, c) => s + c.count, 0));
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader size={20} className="animate-spin text-gold" /></div>;

  const chartData = sources.map(s => ({
    name: s.source.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    value: s.count,
    color: SOURCE_COLORS[s.source] || SOURCE_COLORS.unknown,
  }));

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2">
          <PieIcon size={18} className="text-gold" /> Lead Sources
        </h1>
        <p className="text-xs text-muted mt-0.5">{totalLeads} total leads — see where they come from</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart */}
        <div className="card flex items-center justify-center" style={{ minHeight: 300 }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                  paddingAngle={2} dataKey="value"
                  labelLine={false}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value} leads`, "Count"]}
                  contentStyle={{ background: "#111420", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted">No lead data yet</p>
          )}
        </div>

        {/* Source list */}
        <div className="space-y-2">
          {sources.map(s => {
            const pct = totalLeads > 0 ? Math.round((s.count / totalLeads) * 100) : 0;
            const color = SOURCE_COLORS[s.source] || SOURCE_COLORS.unknown;
            const icon = SOURCE_ICONS[s.source] || <Globe size={14} />;
            const label = s.source.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

            return (
              <div key={s.source} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15`, color }}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold">{label}</p>
                    <span className="text-xs font-mono" style={{ color }}>{s.count}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
                <span className="text-[10px] text-muted font-mono shrink-0 w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
