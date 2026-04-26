"use client";

import { useState } from "react";
import { Phone, MessageCircle, Send } from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import DialerTab from "./_components/DialerTab";
import SMSConsoleTab from "./_components/SMSConsoleTab";
import DMComposerTab from "./_components/DMComposerTab";

const TABS = ["Power Dialer", "SMS Console", "DM Composer"] as const;
type Tab = (typeof TABS)[number];

const TAB_ICON: Record<Tab, React.ReactNode> = {
  "Power Dialer": <Phone size={16} />,
  "SMS Console": <MessageCircle size={16} />,
  "DM Composer": <Send size={16} />,
};

// /dashboard/dialer — three-tab cockpit covering the Voice / SMS / DM gap
// with GHL. Tab selection is local-only state; navigating away resets to
// the default tab so users can deep-link without seeing stale state.
export default function DialerPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Power Dialer");

  return (
    <div className="min-h-screen pb-12">
      <PageHero
        title="Dialer"
        subtitle="Power dialer, manual SMS, and direct messaging — closes the GHL Voice gap."
        gradient="sunset"
        icon={<Phone size={28} />}
      />

      <div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
        <div className="border-b border-white/10">
          <nav className="flex gap-1 overflow-x-auto" aria-label="Dialer tabs">
            {TABS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-orange-400 text-orange-200"
                      : "border-transparent text-white/60 hover:text-white"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {TAB_ICON[tab]}
                  {tab}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-6">
          {activeTab === "Power Dialer" && <DialerTab />}
          {activeTab === "SMS Console" && <SMSConsoleTab />}
          {activeTab === "DM Composer" && <DMComposerTab />}
        </div>
      </div>
    </div>
  );
}
