"use client";
import { CaretRight, ChartBar, CreditCard, FileText, FilmStrip, Lightning, PaperPlaneTilt, UserCheck, X } from "@phosphor-icons/react";

import { useAppStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";
import Link from "next/link";

const QUICK_LINKS = [
  { label: "Content", href: "/dashboard/content", icon: <FilmStrip size={10} /> },
  { label: "Invoices", href: "/dashboard/invoices", icon: <CreditCard size={10} /> },
  { label: "Deals", href: "/dashboard/deals", icon: <ChartBar size={10} /> },
  { label: "Scripts", href: "/dashboard/script-lab", icon: <FileText size={10} /> },
  { label: "Social", href: "/dashboard/social-manager", icon: <PaperPlaneTilt size={10} /> },
  { label: "Workflows", href: "/dashboard/workflows", icon: <Lightning size={10} /> },
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
          <UserCheck size={13} className="text-[#D4FF00]" />
          <span className="text-[10px] text-[rgba(212,255,0,0.8)] font-semibold uppercase tracking-wider">
            Managing
          </span>
          <CaretRight size={10} className="text-[rgba(212,255,0,0.4)]" />
          <span className="text-xs font-semibold text-[#D4FF00]">
            {managedClient.business_name}
          </span>
          <span className="text-[10px] text-text-muted ml-1">
            {managedClient.contact_name}
          </span>
          {managedClient.package_tier && (
            <span className="text-[9px] bg-[rgba(212,255,0,0.08)] text-[#D4FF00] px-1.5 py-0.5 rounded font-medium ml-1">
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
                    ? "bg-[rgba(212,255,0,0.08)] text-[#D4FF00] font-medium"
                    : "text-text-muted hover:text-[#D4FF00] hover:bg-[rgba(212,255,0,0.05)]"
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
