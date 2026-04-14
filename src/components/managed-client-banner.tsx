"use client";

import { useAppStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  X, UserCheck, ChevronRight, FileText, CreditCard,
  Film, Send, BarChart3, Zap
} from "lucide-react";

const QUICK_LINKS = [
  { label: "Content", href: "/dashboard/content", icon: <Film size={10} /> },
  { label: "Invoices", href: "/dashboard/invoices", icon: <CreditCard size={10} /> },
  { label: "Deals", href: "/dashboard/deals", icon: <BarChart3 size={10} /> },
  { label: "Scripts", href: "/dashboard/script-lab", icon: <FileText size={10} /> },
  { label: "Social", href: "/dashboard/social-manager", icon: <Send size={10} /> },
  { label: "Workflows", href: "/dashboard/workflows", icon: <Zap size={10} /> },
];

export default function ManagedClientBanner() {
  const { profile } = useAuth();
  const { managedClient, isManaging, setManagedClient } = useAppStore();
  const pathname = usePathname();

  if (!isManaging || !managedClient) return null;
  if (profile?.role !== "admin" && profile?.role !== "team_member") return null;

  return (
    <div className="bg-gold/8 border-b border-gold/15">
      <div className="flex items-center justify-between px-5 lg:px-6 h-9">
        <div className="flex items-center gap-2">
          <UserCheck size={13} className="text-gold" />
          <span className="text-[10px] text-gold/80 font-semibold uppercase tracking-wider">
            Managing
          </span>
          <ChevronRight size={10} className="text-gold/40" />
          <span className="text-xs font-semibold text-gold">
            {managedClient.business_name}
          </span>
          <span className="text-[10px] text-muted ml-1">
            {managedClient.contact_name}
          </span>
          {managedClient.package_tier && (
            <span className="text-[9px] bg-gold/10 text-gold px-1.5 py-0.5 rounded font-medium ml-1">
              {managedClient.package_tier}
            </span>
          )}

          {/* Quick nav links */}
          <div className="hidden md:flex items-center gap-0.5 ml-3 pl-3 border-l border-gold/15">
            {QUICK_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded transition-all ${
                  pathname === link.href
                    ? "bg-gold/15 text-gold font-medium"
                    : "text-muted hover:text-gold hover:bg-gold/5"
                }`}
              >
                {link.icon} {link.label}
              </Link>
            ))}
          </div>
        </div>

        <button
          onClick={() => setManagedClient(null)}
          className="flex items-center gap-1.5 text-[10px] text-muted hover:text-foreground bg-surface-light/50 hover:bg-surface-light px-2.5 py-1 rounded-md border border-border/30 transition-all"
          title="Stop managing this client"
        >
          <X size={10} />
          Exit
        </button>
      </div>
    </div>
  );
}
