/**
 * DesktopIndicator — a small green-dot + "Desktop" pill shown in the
 * sidebar footer when the dashboard is running inside the Electron
 * shell. Clickable → opens a modal summarising what the desktop app
 * unlocks.
 *
 * Feature-detected: renders null on the web build.
 */
"use client";

import { useEffect, useState } from "react";
import {
  Monitor,
  Bell,
  Keyboard,
  FolderOpen,
  Link2,
  X,
  Sparkles,
} from "lucide-react";
import { isDesktop, openDropboxFolder } from "@/lib/desktop-bridge";

export default function DesktopIndicator({ collapsed }: { collapsed?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  // Avoid SSR hydration mismatch — isDesktop() is always false on the server.
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isDesktop()) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`w-full flex items-center gap-2 rounded-xl text-[10px] text-muted hover:text-emerald-400 hover:bg-emerald-500/5 transition-colors ${
          collapsed ? "justify-center py-1.5 px-1" : "px-2.5 py-[6px] my-[1px]"
        }`}
        title="Desktop app detected — click for details"
      >
        <span className="relative flex items-center">
          <Monitor size={12} className="shrink-0" />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-surface animate-pulse" />
        </span>
        {!collapsed && <span>Desktop</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-emerald-400" />
                <h3 className="text-sm font-semibold">
                  Desktop app{" "}
                  <span className="text-emerald-400">connected</span>
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-muted hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>

            {/* Feature list */}
            <div className="p-4 space-y-3">
              <p className="text-[11px] text-muted leading-relaxed">
                Running ShortStack as a native app unlocks these extras
                on top of everything the web dashboard does:
              </p>

              <FeatureRow
                icon={<Bell size={14} className="text-gold" />}
                title="Native notifications"
                body="Leads, email opens, and agent replies surface as real OS notifications — even when ShortStack isn't focused."
              />
              <FeatureRow
                icon={<Keyboard size={14} className="text-blue-400" />}
                title="Global hotkeys"
                body="Ctrl+Shift+N to drop a quick note, Ctrl+Shift+S to capture a screenshot to the active client."
              />
              <FeatureRow
                icon={<Monitor size={14} className="text-purple-400" />}
                title="Tray + unread badge"
                body="Your unread count shows on the taskbar / menu bar. Right-click the tray to jump between clients."
              />
              <FeatureRow
                icon={<FolderOpen size={14} className="text-emerald-400" />}
                title={
                  <button
                    type="button"
                    onClick={() => void openDropboxFolder()}
                    className="hover:text-emerald-300 transition-colors underline decoration-dotted underline-offset-2"
                  >
                    ~/ShortStack/Dropbox auto-upload
                  </button>
                }
                body="Anything you drop into the folder gets uploaded to the client you're currently viewing."
              />
              <FeatureRow
                icon={<Link2 size={14} className="text-pink-400" />}
                title="Protocol links"
                body="shortstack:// links open the right page in the desktop app — great for emails, Slack, and agent handoffs."
              />
            </div>

            <div className="px-4 py-2.5 border-t border-border bg-surface-light/30">
              <p className="text-[10px] text-muted text-center">
                Web users get everything except these five extras.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FeatureRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  body: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-foreground leading-tight">
          {title}
        </p>
        <p className="text-[10px] text-muted leading-relaxed mt-0.5">{body}</p>
      </div>
    </div>
  );
}
