"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Shortcut {
  keys: string;
  label: string;
  action: () => void;
  category: string;
}

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  const shortcuts: Shortcut[] = [
    // Navigation
    { keys: "g d", label: "Go to Dashboard",     action: () => router.push("/dashboard"),                  category: "Navigation" },
    { keys: "g c", label: "Go to Clients",        action: () => router.push("/dashboard/clients"),          category: "Navigation" },
    { keys: "g i", label: "Go to Inbox",          action: () => router.push("/dashboard/inbox"),            category: "Navigation" },
    { keys: "g a", label: "Go to Analytics",      action: () => router.push("/dashboard/analytics"),        category: "Navigation" },
    { keys: "g k", label: "Go to CRM",            action: () => router.push("/dashboard/crm"),              category: "Navigation" },
    { keys: "g l", label: "Go to Lead Finder",    action: () => router.push("/dashboard/scraper"),          category: "Navigation" },
    { keys: "g o", label: "Go to Outreach",       action: () => router.push("/dashboard/outreach-hub"),     category: "Navigation" },
    { keys: "g m", label: "Go to Conversations",  action: () => router.push("/dashboard/conversations"),    category: "Navigation" },
    { keys: "g s", label: "Go to Settings",       action: () => router.push("/dashboard/settings"),         category: "Navigation" },
    { keys: "g h", label: "Go to Agent HQ",       action: () => router.push("/dashboard/agent-supervisor"), category: "Navigation" },

    // Actions
    { keys: "n l", label: "New Lead (scraper)", action: () => router.push("/dashboard/scraper"), category: "Actions" },
    { keys: "n d", label: "New Deal", action: () => router.push("/dashboard/deals"), category: "Actions" },
    { keys: "n i", label: "New Invoice", action: () => router.push("/dashboard/invoices"), category: "Actions" },
    { keys: "n c", label: "New Client", action: () => router.push("/dashboard/onboard"), category: "Actions" },

    // Global
    { keys: "?", label: "Show shortcuts", action: () => setShowHelp(true), category: "Global" },
  ];

  useEffect(() => {
    let buffer = "";
    let timer: ReturnType<typeof setTimeout>;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable) return;

      // Cmd+K is handled by command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") return;

      // Escape closes help
      if (e.key === "Escape") { setShowHelp(false); return; }

      // ? shows help
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowHelp(prev => !prev);
        return;
      }

      // Build key sequence
      clearTimeout(timer);
      buffer += (buffer ? " " : "") + e.key.toLowerCase();

      // Check for matching shortcut
      const match = shortcuts.find(s => s.keys === buffer);
      if (match) {
        e.preventDefault();
        match.action();
        buffer = "";
        return;
      }

      // Check if any shortcut starts with current buffer
      const partial = shortcuts.some(s => s.keys.startsWith(buffer));
      if (!partial) {
        buffer = "";
      }

      // Reset buffer after 1 second
      timer = setTimeout(() => { buffer = ""; }, 1000);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (!showHelp) return null;

  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHelp(false)} />
      <div className="relative max-w-md mx-auto mt-[15vh]">
        <div className="rounded-2xl overflow-hidden bg-white"
          style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)" }}>
          <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.08)]">
            <h2 className="text-sm font-semibold text-[#111827]">Keyboard Shortcuts</h2>
            <p className="text-[10px] text-[#6B7280] mt-0.5">Press <kbd className="px-1.5 py-0.5 rounded text-[9px] bg-[#F3F4F6] font-mono">?</kbd> to toggle</p>
          </div>

          <div className="px-5 py-4 max-h-[400px] overflow-y-auto space-y-5">
            {categories.map(cat => (
              <div key={cat}>
                <p className="text-[9px] text-[#9CA3AF] uppercase tracking-[0.15em] font-bold mb-2">{cat}</p>
                <div className="space-y-0.5">
                  {shortcuts.filter(s => s.category === cat).map(s => (
                    <div key={s.keys} className="flex items-center justify-between py-1.5 px-1 rounded-lg hover:bg-[#F9FAFB] transition-colors">
                      <span className="text-xs text-[#374151]">{s.label}</span>
                      <div className="flex items-center gap-1">
                        {s.keys.split(" ").map((k, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-[#F3F4F6] text-[#2563EB] border border-[rgba(0,0,0,0.08)]">
                              {k}
                            </kbd>
                            {i < s.keys.split(" ").length - 1 && <span className="text-[#9CA3AF] text-[9px]">then</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 border-t border-[rgba(0,0,0,0.06)] text-center">
            <p className="text-[9px] text-[#9CA3AF]">Press <kbd className="px-1 py-0.5 rounded text-[8px] bg-[#F3F4F6] font-mono">Esc</kbd> to close</p>
          </div>
        </div>
      </div>
    </div>
  );
}
