"use client";

import { useAppStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { X, UserCheck, ChevronRight } from "lucide-react";

export default function ManagedClientBanner() {
  const { profile } = useAuth();
  const { managedClient, isManaging, setManagedClient } = useAppStore();

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
