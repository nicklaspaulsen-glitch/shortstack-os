"use client";

import { useState } from "react";
import { Phone, MessageCircle, Send } from "lucide-react";
import { motion } from "framer-motion";
import DialerTab from "./_components/DialerTab";
import SMSConsoleTab from "./_components/SMSConsoleTab";
import DMComposerTab from "./_components/DMComposerTab";
import { MotionPage } from "@/components/motion/motion-page";

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
    <MotionPage className="min-h-screen pb-12 bg-[#F3F6FA]">{/* -- Dialer command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">AI DIALER</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Dialer</h1>
      </div>
    </div><div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
              <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
                <div className="border-b border-[rgba(0,0,0,0.08)]">
                  <nav className="flex gap-1 overflow-x-auto px-2" aria-label="Dialer tabs">
                    {TABS.map((tab, index) => {
                      const isActive = activeTab === tab;
                      return (
                        <motion.button
                          key={tab}
                          type="button"
                          onClick={() => setActiveTab(tab)}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.22, delay: index * 0.06 }}
                          whileHover={{ y: -1 }}
                          className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                            isActive
                              ? "border-brand-accent text-brand-accent"
                              : "border-transparent text-[#6B7280] hover:text-[#374151]"
                          }`}
                          aria-current={isActive ? "page" : undefined}
                        >
                          {TAB_ICON[tab]}
                          {tab}
                        </motion.button>
                      );
                    })}
                  </nav>
                </div>

                <div className="p-6">
                  {activeTab === "Power Dialer" && <DialerTab />}
                  {activeTab === "SMS Console" && <SMSConsoleTab />}
                  {activeTab === "DM Composer" && <DMComposerTab />}
                </div>
              </div>
            </div></MotionPage>
  );
}
