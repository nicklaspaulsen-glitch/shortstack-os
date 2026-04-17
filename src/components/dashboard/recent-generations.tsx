"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles, Mail, Share2, Film, Image as ImageIcon, FileText,
  Globe, Layers, ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface RecentItem {
  id: string;
  type: string;
  title: string;
  source_tool: string | null;
  thumbnail_url: string | null;
  created_at: string;
  href: string;
}

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; gradient: string; color: string }> = {
  email:        { label: "Email",        icon: <Mail size={11} />,      gradient: "from-amber-500/30 to-orange-500/20",  color: "text-amber-400" },
  social_post:  { label: "Social Post",  icon: <Share2 size={11} />,    gradient: "from-rose-500/30 to-pink-500/20",     color: "text-rose-400" },
  video:        { label: "Video",        icon: <Film size={11} />,      gradient: "from-blue-500/30 to-indigo-500/20",   color: "text-blue-400" },
  thumbnail:    { label: "Thumbnail",    icon: <ImageIcon size={11} />, gradient: "from-emerald-500/30 to-green-500/20", color: "text-emerald-400" },
  script:       { label: "Script",       icon: <FileText size={11} />,  gradient: "from-cyan-500/30 to-teal-500/20",     color: "text-cyan-400" },
  landing_page: { label: "Landing Page", icon: <Globe size={11} />,     gradient: "from-teal-500/30 to-emerald-500/20",  color: "text-teal-400" },
  form:         { label: "Form",         icon: <Layers size={11} />,    gradient: "from-violet-500/30 to-purple-500/20", color: "text-violet-400" },
  sequence:     { label: "Sequence",     icon: <Mail size={11} />,      gradient: "from-fuchsia-500/30 to-pink-500/20",  color: "text-fuchsia-400" },
  blog:         { label: "Blog",         icon: <FileText size={11} />,  gradient: "from-indigo-500/30 to-blue-500/20",   color: "text-indigo-400" },
  other:        { label: "Generation",   icon: <Sparkles size={11} />,  gradient: "from-gold/30 to-amber-500/20",        color: "text-gold" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function RecentGenerations() {
  const [items, setItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/generations/recent?limit=8")
      .then(r => r.ok ? r.json() : { items: [] })
      .then(data => { if (!cancelled) setItems(data.items || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="card-static">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles size={14} className="text-gold" /> Recent AI Generations
          <span className="text-[9px] text-muted font-normal bg-gold/10 text-gold px-2 py-0.5 rounded-full">
            Latest
          </span>
        </h2>
        <Link href="/dashboard/generations" className="text-[10px] text-gold hover:underline flex items-center gap-0.5 font-medium">
          View all <ChevronRight size={10} />
        </Link>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-x-hidden pb-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shrink-0 w-44 space-y-2">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2 w-32" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8">
          <Sparkles size={28} className="mx-auto mb-2 text-muted/30" />
          <p className="text-xs text-muted font-medium mb-1">No generations yet</p>
          <p className="text-[10px] text-muted max-w-xs mx-auto mb-3">
            Use any AI tool in ShortStack and your output will land here.
          </p>
          <Link
            href="/dashboard/ai-studio"
            className="inline-flex items-center gap-1 text-[10px] text-gold hover:underline font-medium"
          >
            Create your first AI generation <ChevronRight size={10} />
          </Link>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {items.map(item => {
            const meta = TYPE_META[item.type] || TYPE_META.other;
            return (
              <Link
                key={item.id}
                href={item.href}
                className="shrink-0 w-44 group rounded-xl border border-border bg-surface hover:border-gold/30 hover:shadow-md transition-all overflow-hidden"
              >
                {/* Thumbnail */}
                <div className={`relative h-24 w-full bg-gradient-to-br ${meta.gradient} flex items-center justify-center overflow-hidden`}>
                  {item.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnail_url}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <span className={`${meta.color} opacity-60 scale-[2.5]`}>
                      {meta.icon}
                    </span>
                  )}
                  <span className={`absolute top-1.5 left-1.5 inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-full font-semibold bg-black/40 backdrop-blur-sm ${meta.color}`}>
                    {meta.icon} {meta.label}
                  </span>
                </div>
                {/* Body */}
                <div className="p-2.5">
                  <p className="text-[11px] font-semibold truncate group-hover:text-gold transition-colors">
                    {item.title.length > 40 ? `${item.title.slice(0, 40)}…` : item.title}
                  </p>
                  <p className="text-[9px] text-muted mt-0.5">{timeAgo(item.created_at)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
