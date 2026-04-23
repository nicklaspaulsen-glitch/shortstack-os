"use client";

import { useEffect, useMemo, useState } from "react";
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
  AlertTriangle,
  Mail,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

/**
 * Desktop download page — offers the Electron native app for Windows, macOS, Linux.
 *
 * Strategy:
 *   - Each download button calls `/api/desktop/download/<platform>` which 302s to
 *     the real installer (either `/downloads/*` on Vercel, or an external R2 URL
 *     if `DESKTOP_DOWNLOAD_BASE_URL` is configured).
 *   - On mount we fetch `/api/desktop/manifest` to render real size / version /
 *     "last updated" metadata. If the manifest is unavailable we show a friendly
 *     "contact support" fallback instead of a 404.
 *   - `postbuild:electron` npm script copies `dist-electron/*.exe` to
 *     `public/downloads/` and writes the manifest.
 */

const FALLBACK_VERSION = "1.4.0";
const GH_RELEASES = "https://github.com/shortstack/shortstack-os/releases/latest";
const SUPPORT_MAILTO =
  "mailto:support@shortstack.dev?subject=Desktop%20app%20download%20unavailable";

type Platform = "windows" | "mac" | "linux";

interface ManifestFile {
  file: string;
  size: number;
  sha512: string | null;
}

interface Manifest {
  available: boolean;
  base: string;
  version?: string;
  updated?: string;
  files?: Partial<Record<Platform, ManifestFile | null>>;
  reason?: string;
}

interface PlatformCard {
  id: Platform;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  fileNote: string;
  accent: string;
}

const PLATFORMS: PlatformCard[] = [
  {
    id: "windows",
    title: "Windows",
    subtitle: "Windows 10 & 11 (x64)",
    icon: <Monitor size={26} />,
    fileNote: ".exe NSIS installer",
    accent: "#60A5FA",
  },
  {
    id: "mac",
    title: "macOS",
    subtitle: "macOS 11+ (Intel & Apple Silicon)",
    icon: <Laptop size={26} />,
    fileNote: ".dmg disk image",
    accent: "#E2E8F0",
  },
  {
    id: "linux",
    title: "Linux",
    subtitle: "Ubuntu, Fedora, Arch & more",
    icon: <Terminal size={26} />,
    fileNote: ".AppImage portable",
    accent: "#FBBF24",
  },
];

const FEATURES = [
  { icon: <Zap size={16} />, title: "Native performance", desc: "No browser tab — runs as a real app with full system access." },
  { icon: <Globe size={16} />, title: "Built-in Chrome browser", desc: "Research leads and scrape sites without leaving Trinity." },
  { icon: <MousePointer size={16} />, title: "AI-assisted mouse + keyboard", desc: "Agents can click, type, and automate tasks for you." },
  { icon: <Wifi size={16} />, title: "Offline support for drafts", desc: "Keep writing even when your connection drops." },
  { icon: <Bell size={16} />, title: "OS-level notifications", desc: "Native toasts when deals close or an agent finishes a job." },
  { icon: <Shield size={16} />, title: "Sandboxed agent runtime", desc: "Local tool execution is gated by workspace + command filters." },
];

function formatBytes(bytes: number | undefined): string | null {
  if (!bytes || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function formatDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function DownloadDesktopPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);

  const detectedOS = useMemo<Platform | null>(() => {
    if (typeof window === "undefined") return null;
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) return "windows";
    if (ua.includes("mac")) return "mac";
    if (ua.includes("linux")) return "linux";
    return null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/desktop/manifest")
      .then((r) => r.json())
      .then((m: Manifest) => {
        if (!cancelled) setManifest(m);
      })
      .catch(() => {
        if (!cancelled) setManifest({ available: false, base: "/downloads" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const version = manifest?.version || FALLBACK_VERSION;
  const updatedStr = formatDate(manifest?.updated);
  const isAvailable = Boolean(manifest?.available);

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

      {/* ── Unavailable banner (graceful fallback) ───────────────── */}
      {!loading && !isAvailable && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-400" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-amber-200">
              Installer temporarily unavailable
            </div>
            <div className="text-xs text-amber-100/80 mt-0.5">
              Our desktop installer is currently being staged. You can still grab it from
              GitHub releases, or email support and we&apos;ll send a direct link.
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <a
                href={GH_RELEASES}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-500/30"
              >
                GitHub releases <ExternalLink size={11} />
              </a>
              <a
                href={SUPPORT_MAILTO}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md bg-white/5 hover:bg-white/10 text-foreground border border-border"
              >
                <Mail size={11} /> Contact support
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Download cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLATFORMS.map((p) => {
          const isRecommended = detectedOS === p.id;
          const entry = manifest?.files?.[p.id] ?? null;
          const size = formatBytes(entry?.size);
          const href = `/api/desktop/download/${p.id}`;
          return (
            <a
              key={p.id}
              href={href}
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
              <div className="text-[11px] text-muted-light mb-4">
                {p.fileNote}
                {size ? ` · ${size}` : ""}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-[11px] text-muted">v{version}</span>
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
            <span className="font-mono font-semibold text-foreground">v{version}</span>
            {updatedStr ? (
              <>
                {" · Updated "}
                <span className="text-foreground">{updatedStr}</span>
              </>
            ) : null}
            {" · Built with Electron & electron-builder"}
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
