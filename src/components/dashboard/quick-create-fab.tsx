"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, Users, Sparkles, Mail, Film, Image as ImageIcon, Megaphone,
} from "lucide-react";

interface CreateAction {
  label: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

const ACTIONS: CreateAction[] = [
  { label: "New Campaign",   icon: <Megaphone size={14} />,  href: "/dashboard/ads",                  color: "text-warning" },
  { label: "New Thumbnail",  icon: <ImageIcon size={14} />,  href: "/dashboard/thumbnail-generator",  color: "text-emerald-400" },
  { label: "New Video",      icon: <Film size={14} />,       href: "/dashboard/production",           color: "text-blue-400" },
  { label: "New Email",      icon: <Mail size={14} />,       href: "/dashboard/email-templates",      color: "text-amber-400" },
  { label: "New Content",    icon: <Sparkles size={14} />,   href: "/dashboard/ai-studio",            color: "text-purple-400" },
  { label: "New Client",     icon: <Users size={14} />,      href: "/dashboard/onboard",              color: "text-success" },
];

export default function QuickCreateFab() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {/* Expanded actions */}
      {open && (
        <div className="flex flex-col items-end gap-1.5 fade-in">
          {ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={() => { router.push(a.href); setOpen(false); }}
              className="flex items-center gap-2 pl-3 pr-3.5 py-2 rounded-full bg-surface border border-border shadow-md hover:border-gold/30 hover:shadow-lg transition-all group"
            >
              <span className={`${a.color}`}>{a.icon}</span>
              <span className="text-[11px] font-medium group-hover:text-gold transition-colors">{a.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* FAB toggle */}
      <button
        aria-label={open ? "Close quick create menu" : "Open quick create menu"}
        onClick={() => setOpen(o => !o)}
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all ${
          open
            ? "bg-surface border border-border text-muted hover:text-foreground"
            : "bg-gradient-to-br from-gold to-gold/80 text-black hover:scale-110"
        }`}
        style={open ? {} : { boxShadow: "0 8px 24px -4px rgba(201,168,76,0.55)" }}
      >
        {open ? <X size={18} /> : <Plus size={18} />}
      </button>
    </div>
  );
}
