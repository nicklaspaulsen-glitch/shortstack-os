"use client";

/**
 * Dashboard → Client Files
 *
 * Agency-side view: every client's dropped files grouped together with
 * signed URLs, source badges, and a storage-quota bar.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  Film,
  Music,
  Download as DownloadIcon,
  RefreshCw,
  ExternalLink,
  UploadCloud,
  HardDrive,
  Loader2,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

type FileRow = {
  id: string;
  client_id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_url: string | null;
  source: string;
  status: string;
  created_at: string;
  signed_url: string | null;
};

type Group = {
  client: { id: string; name: string };
  files: FileRow[];
};

type QuotaRow = {
  plan_tier: string;
  bytes_used: number;
  bytes_limit: number;
};

function formatBytes(n: number | null | undefined) {
  if (!n || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

function iconForMime(mime: string | null | undefined) {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return ImageIcon;
  if (m.startsWith("video/")) return Film;
  if (m.startsWith("audio/")) return Music;
  if (m.includes("pdf") || m.includes("text")) return FileText;
  return FileIcon;
}

function sourceBadge(source: string) {
  switch (source) {
    case "portal_upload":
      return { label: "Portal", className: "text-blue-400 bg-blue-400/10" };
    case "gdrive":
      return { label: "Drive", className: "text-emerald-400 bg-emerald-400/10" };
    case "dropbox":
      return { label: "Dropbox", className: "text-sky-400 bg-sky-400/10" };
    case "onedrive":
      return { label: "OneDrive", className: "text-indigo-400 bg-indigo-400/10" };
    case "webhook":
      return { label: "Zap", className: "text-amber-400 bg-amber-400/10" };
    default:
      return { label: source, className: "text-muted bg-surface-light" };
  }
}

export default function ClientFilesPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [quota, setQuota] = useState<QuotaRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/dashboard/client-files");
      if (!r.ok) throw new Error(`Load failed (${r.status})`);
      const j = await r.json();
      setGroups(j.groups || []);
      setQuota(j.quota || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Mark this nav path as visited on mount (clears the sidebar badge).
  useEffect(() => {
    fetch("/api/user/sidebar-unread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nav_path: "/dashboard/client-files" }),
    }).catch(() => {});
  }, []);

  const totalFiles = groups.reduce((s, g) => s + g.files.length, 0);
  const quotaPct =
    quota && quota.bytes_limit > 0
      ? Math.min(100, Math.round((Number(quota.bytes_used) / Number(quota.bytes_limit)) * 100))
      : 0;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Section · Operations"
        title="Client Files"
        subtitle="Every file dropped via portal, Drive, Dropbox, OneDrive, or webhook — grouped by client."
        icon={<HardDrive size={22} />}
        gradient="gold"
      />

      {/* Quota */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-medium text-foreground">Storage</p>
            <p className="text-xs text-muted">
              {quota
                ? `${quota.plan_tier.toUpperCase()} · ${formatBytes(quota.bytes_used)} of ${
                    quota.bytes_limit === 0 ? "unlimited" : formatBytes(quota.bytes_limit)
                  }`
                : "No activity yet"}
            </p>
          </div>
          <button
            onClick={refresh}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-light transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        {quota && quota.bytes_limit > 0 && (
          <div className="h-2 w-full rounded-full bg-surface-light overflow-hidden">
            <div
              className={`h-full transition-all ${
                quotaPct > 90 ? "bg-danger" : quotaPct > 70 ? "bg-amber-400" : "bg-gold"
              }`}
              style={{ width: `${quotaPct}%` }}
            />
          </div>
        )}
      </div>

      {/* Groups */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center text-muted text-sm">
          <Loader2 className="mx-auto animate-spin mb-2" size={20} />
          Loading files…
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
          <UploadCloud className="mx-auto text-muted mb-3" size={28} />
          <p className="text-sm font-medium text-foreground">No client files yet</p>
          <p className="text-xs text-muted mt-1">
            Clients can drop files or connect Google Drive from their portal.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.client.id} className="rounded-2xl border border-border bg-surface">
              <header className="flex items-center justify-between px-5 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-muted" />
                  <h2 className="text-sm font-semibold text-foreground">{g.client.name}</h2>
                  <span className="text-xs text-muted">({g.files.length})</span>
                </div>
                <Link
                  href={`/dashboard/clients/${g.client.id}`}
                  className="flex items-center gap-1 text-xs text-muted hover:text-gold transition-colors"
                >
                  Open client
                  <ExternalLink size={10} />
                </Link>
              </header>
              <ul className="divide-y divide-border">
                {g.files.map((f) => {
                  const Icon = iconForMime(f.mime_type);
                  const badge = sourceBadge(f.source);
                  return (
                    <li key={f.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="h-9 w-9 rounded-lg bg-surface-light flex items-center justify-center text-muted">
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate" title={f.filename}>
                          {f.filename}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-muted mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded font-semibold ${badge.className}`}>
                            {badge.label}
                          </span>
                          <span>{formatBytes(f.size_bytes)}</span>
                          <span>·</span>
                          <span>{new Date(f.created_at).toLocaleString()}</span>
                          {f.status !== "ready" && (
                            <>
                              <span>·</span>
                              <span className="text-amber-400">{f.status}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {f.signed_url ? (
                        <a
                          href={f.signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg text-muted hover:text-gold hover:bg-gold/5 transition-colors"
                          title="Open / download"
                        >
                          <DownloadIcon size={14} />
                        </a>
                      ) : (
                        <span className="text-xs text-muted">Pending</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <p className="text-[11px] text-muted text-center">
            Showing {totalFiles} file{totalFiles === 1 ? "" : "s"} across {groups.length} client{groups.length === 1 ? "" : "s"}.
          </p>
        </div>
      )}
    </div>
  );
}
