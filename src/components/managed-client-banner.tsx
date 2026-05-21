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
    <div className="bg-[rgba(212,255,0,0.05)] border-b border-[rgba(212,255,0,0.08)]">
      <div className="flex items-center justify-between px-5 lg:px-6 h-9">
        <div className="flex items-center gap-2">
          <UserCheck size={13} className="text-[#2563EB]" />
          <span className="text-[10px] text-[rgba(212,255,0,0.8)] font-semibold uppercase tracking-wider">
            Managing
          </span>
          <ChevronRight size={10} className="text-[rgba(212,255,0,0.4)]" />
          <span className="text-xs font-semibold text-[#2563EB]">
            {managedClient.business_name}
          </span>
          <span className="text-[10px] text-text-muted ml-1">
            {managedClient.contact_name}
          </span>
          {managedClient.package_tier && (
            <span className="text-[9px] bg-[rgba(212,255,0,0.08)] text-[#2563EB] px-1.5 py-0.5 rounded font-medium ml-1">
              {managedClient.package_tier}
            </span>
          )}

          {/* Quick nav links */}
          <div className="hidden md:flex items-center gap-0.5 ml-3 pl-3 border-l border-[rgba(212,255,0,0.08)]">
            {QUICK_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded transition-all ${
                  pathname === link.href
                    ? "bg-[rgba(212,255,0,0.08)] text-[#2563EB] font-medium"
                    : "text-text-muted hover:text-[#2563EB] hover:bg-[rgba(212,255,0,0.05)]"
                }`}
              >
                {link.icon} {link.label}
              </Link>
            ))}
          </div>
        </div>

        <button
          onClick={() => setManagedClient(null)}
          className="flex items-center gap-1.5 text-[10px] text-text-muted hover:text-text-primary bg-surface-light/50 hover:bg-surface-light px-2.5 py-1 rounded-md border border-border-subtle/30 transition-all"
          title="Stop managing this client"
        >
          <X size={10} />
          Exit
        </button>
      </div>
    </div>
  );
}
