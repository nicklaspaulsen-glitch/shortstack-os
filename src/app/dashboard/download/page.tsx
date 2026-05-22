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
    accent: "#D4FF00",
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
    <MotionPage className="space-y-6 pb-10">{/* -- Download Trinity for Desktop command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">Desktop App</p>
        <h1 className="text-2xl font-display font-bold text-text-primary">Download Trinity for Desktop</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a
                  href={GH_RELEASES}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-text-primary border border-border-subtle transition-colors"
                >
                  View all releases <ExternalLink size={12} />
                </a>
      </div>
    </div>{/* ── Unavailable banner (graceful fallback) ───────────────── */}{!loading && !isAvailable && (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex items-start gap-3 glass rounded-xl border border-amber-500/30 p-4"
              >
                <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-amber-400">
                    Installer temporarily unavailable
                  </div>
                  <div className="text-xs text-amber-400 mt-0.5">
                    Our desktop installer is currently being staged. You can still grab it from
                    GitHub releases, or email support and we&apos;ll send a direct link.
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <a
                      href={GH_RELEASES}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30"
                    >
                      GitHub releases <ExternalLink size={11} />
                    </a>
                    <a
                      href={SUPPORT_MAILTO}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md bg-white/5 hover:bg-white/8 text-text-secondary border border-border-subtle"
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
                    onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`); e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`); }}
                    className={`group relative glass rounded-xl p-5 transition-all spotlight-card ${
                      isRecommended
                        ? "border-[rgba(212,255,0,0.5)] shadow-[0_0_20px_rgba(212,255,0,0.12)]"
                        : ""
                    }`}
                  >
                    {isRecommended && (
                      <div className="absolute -top-2 left-4 px-2 py-0.5 rounded-full bg-brand-accent text-[10px] font-bold text-[#0D1120] uppercase tracking-wider">
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
                        className="text-text-muted group-hover:text-brand-accent transition-colors"
                      />
                    </div>
                    <div className="text-lg font-semibold text-text-primary mb-0.5">{p.title}</div>
                    <div className="text-xs text-text-muted mb-3">{p.subtitle}</div>
                    <div className="text-[11px] text-muted-light mb-4">
                      {p.fileNote}
                      {size ? ` · ${size}` : ""}
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
                      <span className="text-[11px] text-text-muted">v{version}</span>
                      <span className="text-xs font-medium text-brand-accent group-hover:underline">
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
                <div className="text-[10px] font-bold uppercase tracking-wider text-brand-accent mb-1">
                  What&apos;s included
                </div>
                <h2 className="text-xl font-semibold text-text-primary">
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
                    <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-[rgba(212,255,0,0.08)] text-brand-accent border border-[rgba(212,255,0,0.25)]">
                      <CheckCircle2 size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                        <span className="text-brand-accent">{f.icon}</span>
                        {f.title}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{f.desc}</div>
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
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <Keyboard size={14} className="text-brand-accent" />
                <span>
                  Current version{" "}
                  <span className="font-mono font-semibold text-text-primary">v{version}</span>
                  {updatedStr ? (
                    <>
                      {" · Updated "}
                      <span className="text-text-primary">{updatedStr}</span>
                    </>
                  ) : null}
                  {" · Built with Electron & electron-builder"}
                </span>
              </div>
              <a
                href={GH_RELEASES}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-brand-accent hover:underline flex items-center gap-1"
              >
                View changelog <ExternalLink size={11} />
              </a>
            </motion.div></MotionPage>
  );
}
