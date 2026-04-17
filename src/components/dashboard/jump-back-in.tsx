"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Mail, Film, Image as ImageIcon, Globe, FileText, Share2,
  Layers, ArrowRight, RotateCcw, ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface JumpItem {
  id: string;
  type: string;
  title: string;
  href: string;
  updated_at: string;
  status: string;
}

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  video:        { label: "Video",        icon: <Film size={13} />,      color: "text-blue-400",    bg: "bg-blue-500/10" },
  thumbnail:    { label: "Thumbnail",    icon: <ImageIcon size={13} />, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  email:        { label: "Email",        icon: <Mail size={13} />,      color: "text-amber-400",   bg: "bg-amber-500/10" },
  landing_page: { label: "Landing Page", icon: <Globe size={13} />,     color: "text-teal-400",    bg: "bg-teal-500/10" },
  script:       { label: "Script",       icon: <FileText size={13} />,  color: "text-cyan-400",    bg: "bg-cyan-500/10" },
  social_post:  { label: "Social Post",  icon: <Share2 size={13} />,    color: "text-rose-400",    bg: "bg-rose-500/10" },
  form:         { label: "Form",         icon: <Layers size={13} />,    color: "text-violet-400",  bg: "bg-violet-500/10" },
  sequence:     { label: "Sequence",     icon: <Mail size={13} />,      color: "text-fuchsia-400", bg: "bg-fuchsia-500/10" },
  proposal:     { label: "Proposal",     icon: <FileText size={13} />,  color: "text-purple-400",  bg: "bg-purple-500/10" },
  other:        { label: "Draft",        icon: <FileText size={13} />,  color: "text-muted",       bg: "bg-surface-light" },
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

const RECENT_VISIT_KEY = "ss_recent_visits";

function readLocalRecents(): JumpItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_VISIT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ href: string; title: string; type: string; ts: number }>;
    return parsed
      .slice(0, 4)
      .map((p, i) => ({
        id: `local-${i}`,
        type: p.type || "other",
        title: p.title || "Recent",
        href: p.href,
        updated_at: new Date(p.ts).toISOString(),
        status: "draft",
      }));
  } catch {
    return [];
  }
}

export default function JumpBackIn() {
  const [items, setItems] = useState<JumpItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/jump-back-in")
      .then(r => r.ok ? r.json() : { items: [] })
      .then(data => {
        if (cancelled) return;
        const fromApi = (data.items || []) as JumpItem[];
        if (fromApi.length > 0) {
          setItems(fromApi);
        } else {
          setItems(readLocalRecents());
        }
      })
      .catch(() => {
        if (!cancelled) setItems(readLocalRecents());
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="card-static">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <RotateCcw size={14} className="text-info" /> Jump Back In
        </h2>
        <span className="text-[10px] text-muted">{items.length} draft{items.length === 1 ? "" : "s"}</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-6">
          <RotateCcw size={24} className="mx-auto mb-2 text-muted/30" />
          <p className="text-xs text-muted font-medium mb-1">No drafts in progress</p>
          <p className="text-[10px] text-muted max-w-xs mx-auto mb-2">
            Saved drafts and in-progress edits will show up here.
          </p>
          <Link
            href="/dashboard/ai-studio"
            className="inline-flex items-center gap-1 text-[10px] text-gold hover:underline font-medium"
          >
            Start something new <ChevronRight size={10} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {items.map(item => {
            const meta = TYPE_META[item.type] || TYPE_META.other;
            return (
              <Link
                key={item.id}
                href={item.href}
                className="group p-3 rounded-xl border border-border bg-surface hover:border-gold/30 hover:shadow-sm transition-all flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${meta.bg} ${meta.color}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <span className="text-[8px] text-muted">{timeAgo(item.updated_at)}</span>
                </div>
                <p className="text-[11px] font-semibold truncate group-hover:text-gold transition-colors">
                  {item.title}
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] text-info group-hover:text-gold font-medium mt-auto">
                  Resume <ArrowRight size={10} />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
