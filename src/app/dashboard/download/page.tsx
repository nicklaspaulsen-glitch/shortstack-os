"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
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
import { MotionPage } from "@/components/motion/motion-page";

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
  "mailto:support@shortstack.work?subject=Desktop%20app%20download%20unavailable";

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
    accent: "#3B82F6",
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
    <MotionPage className="space-y-6 pb-10"><PageHero
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
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-black/5 hover:bg-black/10 text-foreground border border-border transition-colors"
                >
                  View all releases <ExternalLink size={12} />
                </a>
              }
            />{/* ── Unavailable banner (graceful fallback) ───────────────── */}{!loading && !isAvailable && (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex items-start gap-3 glass rounded-xl border border-amber-500/30 p-4"
              >
                <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-amber-700">
                    Installer temporarily unavailable
                  </div>
                  <div className="text-xs text-amber-600 mt-0.5">
                    Our desktop installer is currently being staged. You can still grab it from
                    GitHub releases, or email support and we&apos;ll send a direct link.
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <a
                      href={GH_RELEASES}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
                    >
                      GitHub releases <ExternalLink size={11} />
                    </a>
                    <a
                      href={SUPPORT_MAILTO}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md bg-[rgba(0,0,0,0.04)] hover:bg-[rgba(0,0,0,0.06)] text-[#374151] border border-[rgba(0,0,0,0.08)]"
                    >
                      <Mail size={11} /> Contact support
                    </a>
                  </div>
                </div>
              </motion.div>
            )}{/* ── Download cards ────────────────────────────────────────── */}<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLATFORMS.map((p, index) => {
                const isRecommended = detectedOS === p.id;
                const entry = manifest?.files?.[p.id] ?? null;
                const size = formatBytes(entry?.size);
                const href = `/api/desktop/download/${p.id}`;
                return (
                  <motion.a
                    key={p.id}
                    href={href}
                    download
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06, duration: 0.4 }}
                    whileHover={{ y: -4, scale: 1.01 }}
                    className={`group relative glass rounded-xl p-5 transition-all ${
                      isRecommended
                        ? "border-[rgba(37,99,235,0.5)] shadow-[0_0_20px_rgba(37,99,235,0.12)]"
                        : ""
                    }`}
                  >
                    {isRecommended && (
                      <div className="absolute -top-2 left-4 px-2 py-0.5 rounded-full bg-[#2563EB] text-[10px] font-bold text-white uppercase tracking-wider">
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
                        className="text-muted group-hover:text-[#2563EB] transition-colors"
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
                      <span className="text-xs font-medium text-[#2563EB] group-hover:underline">
                        Download
                      </span>
                    </div>
                  </motion.a>
                );
              })}
            </div>{/* ── What's included ──────────────────────────────────────── */}<motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="glass rounded-xl p-6"
            >
              <div className="mb-5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] mb-1">
                  What&apos;s included
                </div>
                <h2 className="text-xl font-semibold text-foreground">
                  Everything the web app does — plus native superpowers
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {FEATURES.map((f, i) => (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-start gap-3 p-3 glass-md rounded-xl"
                  >
                    <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-[rgba(37,99,235,0.08)] text-[#2563EB] border border-[rgba(37,99,235,0.25)]">
                      <CheckCircle2 size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <span className="text-[#2563EB]">{f.icon}</span>
                        {f.title}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5 leading-relaxed">{f.desc}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>{/* ── Version + changelog ──────────────────────────────────── */}<motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 glass rounded-xl p-4"
            >
              <div className="flex items-center gap-3 text-xs text-muted">
                <Keyboard size={14} className="text-[#2563EB]" />
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
                className="text-xs font-medium text-[#2563EB] hover:underline flex items-center gap-1"
              >
                View changelog <ExternalLink size={11} />
              </a>
            </motion.div></MotionPage>
  );
}
