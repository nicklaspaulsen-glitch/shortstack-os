"use client";

import { useState } from "react";
import {
  Download,
  Monitor,
  Laptop,
  Globe,
  Zap,
  Keyboard,
  MousePointer,
  Wifi,
  Bell,
  Shield,
  CheckCircle2,
  ExternalLink,
  Terminal,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

/**
 * Desktop download page — offers the Electron native app for Windows, macOS, Linux.
 * The actual installers are built via `npm run electron:build` (electron-builder NSIS).
 * Until a public release exists, these links point to the GitHub releases page.
 */

const CURRENT_VERSION = "1.4.0";
const GH_RELEASES = "https://github.com/shortstack/shortstack-os/releases/latest";
// Placeholder paths served out of /public/downloads. Replace these once
// electron-builder outputs land on the CDN / release page.
const DOWNLOAD_PATHS = {
  windows: "/downloads/ShortStack-OS-Setup.exe",
  mac: "/downloads/ShortStack-OS.dmg",
  linux: "/downloads/ShortStack-OS.AppImage",
} as const;

type Platform = "windows" | "mac" | "linux";

interface PlatformCard {
  id: Platform;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  fileNote: string;
  href: string;
  accent: string;
}

const PLATFORMS: PlatformCard[] = [
  {
    id: "windows",
    title: "Windows",
    subtitle: "Windows 10 & 11 (x64)",
    icon: <Monitor size={26} />,
    fileNote: ".exe NSIS installer",
    href: DOWNLOAD_PATHS.windows,
    accent: "#60A5FA",
  },
  {
    id: "mac",
    title: "macOS",
    subtitle: "macOS 11+ (Intel & Apple Silicon)",
    icon: <Laptop size={26} />,
    fileNote: ".dmg disk image",
    href: DOWNLOAD_PATHS.mac,
    accent: "#E2E8F0",
  },
  {
    id: "linux",
    title: "Linux",
    subtitle: "Ubuntu, Fedora, Arch & more",
    icon: <Terminal size={26} />,
    fileNote: ".AppImage portable",
    href: DOWNLOAD_PATHS.linux,
    accent: "#FBBF24",
  },
];

const FEATURES = [
  { icon: <Zap size={16} />, title: "Native performance", desc: "No browser tab — runs as a real app with full system access." },
  { icon: <Globe size={16} />, title: "Built-in Chrome browser", desc: "Research leads and scrape sites without leaving ShortStack." },
  { icon: <MousePointer size={16} />, title: "AI-assisted mouse + keyboard", desc: "Agents can click, type, and automate tasks for you." },
  { icon: <Wifi size={16} />, title: "Offline support for drafts", desc: "Keep writing even when your connection drops." },
  { icon: <Bell size={16} />, title: "OS-level notifications", desc: "Native toasts when deals close or an agent finishes a job." },
  { icon: <Shield size={16} />, title: "Sandboxed agent runtime", desc: "Local tool execution is gated by workspace + command filters." },
];

export default function DownloadDesktopPage() {
  const [detectedOS] = useState<Platform | null>(() => {
    if (typeof window === "undefined") return null;
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) return "windows";
    if (ua.includes("mac")) return "mac";
    if (ua.includes("linux")) return "linux";
    return null;
  });

  return (
    <div className="space-y-6 pb-10">
      <PageHero
        eyebrow="Desktop App"
        title="Download Trinity for Desktop"
        subtitle="Work faster with a native app. Chrome browser built in, AI-assisted clicks, keyboard automation."
        icon={<Download size={22} />}
        gradient="gold"
        actions={
          <a
            href={GH_RELEASES}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/15 transition-colors"
          >
            View all releases <ExternalLink size={12} />
          </a>
        }
      />

      {/* ── Download cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLATFORMS.map((p) => {
          const isRecommended = detectedOS === p.id;
          return (
            <a
              key={p.id}
              href={p.href}
              download
              className={`group relative rounded-2xl border p-5 transition-all hover:scale-[1.01] ${
                isRecommended
                  ? "border-gold/50 shadow-[0_0_20px_rgba(201,168,76,0.12)]"
                  : "border-border hover:border-border-light"
              }`}
              style={{ background: "var(--color-surface, #0f1115)" }}
            >
              {isRecommended && (
                <div className="absolute -top-2 left-4 px-2 py-0.5 rounded-full bg-gold text-[10px] font-bold text-black uppercase tracking-wider">
                  Recommended for you
                </div>
              )}
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center border"
                  style={{
                    background: `${p.accent}18`,
                    borderColor: `${p.accent}44`,
                    color: p.accent,
                  }}
                >
                  {p.icon}
                </div>
                <Download
                  size={18}
                  className="text-muted group-hover:text-gold transition-colors"
                />
              </div>
              <div className="text-lg font-semibold text-foreground mb-0.5">{p.title}</div>
              <div className="text-xs text-muted mb-3">{p.subtitle}</div>
              <div className="text-[11px] text-muted-light mb-4">{p.fileNote}</div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-[11px] text-muted">v{CURRENT_VERSION}</span>
                <span className="text-xs font-medium text-gold group-hover:underline">
                  Download
                </span>
              </div>
            </a>
          );
        })}
      </div>

      {/* ── What's included ──────────────────────────────────────── */}
      <div
        className="rounded-2xl border border-border p-6"
        style={{ background: "var(--color-surface, #0f1115)" }}
      >
        <div className="mb-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gold mb-1">
            What&apos;s included
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            Everything the web app does — plus native superpowers
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-surface-light/40"
            >
              <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-gold/10 text-gold border border-gold/20">
                <CheckCircle2 size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <span className="text-gold">{f.icon}</span>
                  {f.title}
                </div>
                <div className="text-[11px] text-muted mt-0.5 leading-relaxed">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Version + changelog ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-border p-4 bg-surface-light/40">
        <div className="flex items-center gap-3 text-xs text-muted">
          <Keyboard size={14} className="text-gold" />
          <span>
            Current version{" "}
            <span className="font-mono font-semibold text-foreground">v{CURRENT_VERSION}</span>{" "}
            &middot; Built with Electron &amp; electron-builder
          </span>
        </div>
        <a
          href={GH_RELEASES}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-gold hover:underline flex items-center gap-1"
        >
          View changelog <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}
