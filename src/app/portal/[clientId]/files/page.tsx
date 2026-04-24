"use client";

/**
 * Portal file drop page.
 *
 * Three panels:
 *   1. Drag-drop upload zone + file picker (POST multipart -> /files/upload).
 *   2. List of uploaded files (portal + gdrive + webhook sources), with signed URLs.
 *   3. Connect Google Drive button (or, when connected, a Drive-file picker that
 *      sends selected fileIds to /gdrive/sync).
 *
 * Dropbox/OneDrive are placeholders — the buttons are rendered but flagged
 * "Coming soon" until those providers are wired up.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  Upload,
  UploadCloud,
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  Film,
  Music,
  Download as DownloadIcon,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Link2,
  RefreshCw,
  Cloud,
  Plug,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

type FileRow = {
  id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_url: string | null;
  source: string;
  status: string;
  created_at: string;
  signed_url: string | null;
  metadata: Record<string, unknown>;
};

type GDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string | null;
  iconLink: string | null;
  webViewLink: string | null;
};

function formatBytes(n: number | null | undefined) {
  if (!n || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
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

export default function PortalFilesPage() {
  const params = useParams<{ clientId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const clientId = params?.clientId || "";

  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [gdriveStatus, setGdriveStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [gdriveFiles, setGdriveFiles] = useState<GDriveFile[]>([]);
  const [gdriveLoading, setGdriveLoading] = useState(false);
  const [gdriveSelected, setGdriveSelected] = useState<Set<string>>(new Set());
  const [showGDrivePicker, setShowGDrivePicker] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // ─── Load existing files ─────────────────────────────────────────
  const refreshFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/${clientId}/files/upload`);
      if (!res.ok) throw new Error(`List failed (${res.status})`);
      const json = await res.json();
      setFiles(json.files || []);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't load your files");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  // ─── Post-OAuth banner ───────────────────────────────────────────
  useEffect(() => {
    const connected = searchParams?.get("connected");
    const err = searchParams?.get("error");
    if (connected === "gdrive") {
      toast.success("Google Drive connected");
      setGdriveStatus("connected");
      // Clean up URL params
      router.replace(`/portal/${clientId}/files`);
    } else if (err) {
      toast.error(`Drive connect failed: ${err}`);
      router.replace(`/portal/${clientId}/files`);
    }
  }, [searchParams, clientId, router]);

  // ─── Drive status probe ──────────────────────────────────────────
  const probeGDrive = useCallback(async () => {
    try {
      const r = await fetch(`/api/portal/${clientId}/files/gdrive/list`);
      if (r.status === 404) {
        setGdriveStatus("disconnected");
        return;
      }
      const j = await r.json();
      if (j.connected) {
        setGdriveStatus("connected");
        if (Array.isArray(j.files)) setGdriveFiles(j.files);
      } else {
        setGdriveStatus("disconnected");
      }
    } catch {
      setGdriveStatus("disconnected");
    }
  }, [clientId]);

  useEffect(() => {
    probeGDrive();
  }, [probeGDrive]);

  // ─── Upload ──────────────────────────────────────────────────────
  const uploadFiles = useCallback(
    async (list: FileList | File[]) => {
      const arr = Array.from(list);
      if (!arr.length) return;
      setUploading(true);
      let failures = 0;
      for (const f of arr) {
        const fd = new FormData();
        fd.append("file", f);
        try {
          const r = await fetch(`/api/portal/${clientId}/files/upload`, {
            method: "POST",
            body: fd,
          });
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.error || `Upload failed (${r.status})`);
          }
        } catch (e) {
          failures++;
          const msg = e instanceof Error ? e.message : "Upload error";
          toast.error(`${f.name}: ${msg}`);
        }
      }
      setUploading(false);
      if (failures < arr.length) {
        toast.success(`Uploaded ${arr.length - failures} file${arr.length === 1 ? "" : "s"}`);
        refreshFiles();
      }
    },
    [clientId, refreshFiles],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer?.files?.length) {
        uploadFiles(e.dataTransfer.files);
      }
    },
    [uploadFiles],
  );

  const openGDrivePicker = useCallback(async () => {
    setShowGDrivePicker(true);
    setGdriveLoading(true);
    try {
      const r = await fetch(`/api/portal/${clientId}/files/gdrive/list`);
      const j = await r.json();
      if (!r.ok || !j.connected) {
        throw new Error(j.error || "Not connected");
      }
      setGdriveFiles(j.files || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to list Drive";
      toast.error(msg);
      setShowGDrivePicker(false);
    } finally {
      setGdriveLoading(false);
    }
  }, [clientId]);

  const syncSelected = useCallback(async () => {
    if (!gdriveSelected.size) return;
    setSyncing(true);
    try {
      const r = await fetch(`/api/portal/${clientId}/files/gdrive/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: Array.from(gdriveSelected) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Sync failed (${r.status})`);
      const importedCount = j.imported?.length || 0;
      const skippedCount = j.skipped?.length || 0;
      toast.success(`Imported ${importedCount} · skipped ${skippedCount}`);
      setGdriveSelected(new Set());
      setShowGDrivePicker(false);
      refreshFiles();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync error";
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  }, [clientId, gdriveSelected, refreshFiles]);

  const disconnectGDrive = useCallback(async () => {
    if (!confirm("Disconnect Google Drive? Already-imported files stay.")) return;
    try {
      const r = await fetch(`/api/portal/${clientId}/files/gdrive/disconnect`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(`Disconnect failed (${r.status})`);
      toast.success("Google Drive disconnected");
      setGdriveStatus("disconnected");
      setGdriveFiles([]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Disconnect error";
      toast.error(msg);
    }
  }, [clientId]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Files</h1>
        <p className="text-sm text-muted mt-1">
          Drop files here or sync from a cloud drive — your agency sees them instantly.
        </p>
      </header>

      {/* ─── Drag-drop zone ─────────────────────────────────────── */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-gold bg-gold/5"
            : "border-border bg-surface hover:border-gold/40 hover:bg-surface-light"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <Loader2 size={32} className="text-gold animate-spin" />
          ) : (
            <UploadCloud size={32} className="text-gold" />
          )}
          <div>
            <p className="text-sm font-medium text-foreground">
              {uploading ? "Uploading…" : "Drop files or click to browse"}
            </p>
            <p className="text-xs text-muted mt-1">
              Up to 500 MB per file. Any file type.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Cloud sync row ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ConnectCard
          title="Google Drive"
          icon={<Cloud size={18} className="text-blue-400" />}
          status={gdriveStatus}
          onConnect={() =>
            (window.location.href = `/portal/${clientId}/files/gdrive/connect`)
          }
          onPick={openGDrivePicker}
          onDisconnect={disconnectGDrive}
        />
        <ConnectCard
          title="Dropbox"
          icon={<Cloud size={18} className="text-sky-400" />}
          status="disconnected"
          comingSoon
        />
        <ConnectCard
          title="OneDrive"
          icon={<Cloud size={18} className="text-indigo-400" />}
          status="disconnected"
          comingSoon
        />
      </div>

      {/* ─── File list ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-surface">
        <header className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-muted" />
            <h2 className="text-sm font-semibold text-foreground">Your files</h2>
            <span className="text-xs text-muted">({files.length})</span>
          </div>
          <button
            onClick={refreshFiles}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-light transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </header>
        {loading ? (
          <div className="p-10 text-center text-muted text-sm">Loading…</div>
        ) : files.length === 0 ? (
          <div className="p-10 text-center text-muted text-sm">
            No files yet — drop your first one above.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {files.map((f) => {
              const Icon = iconForMime(f.mime_type);
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
                      <span>{formatBytes(f.size_bytes)}</span>
                      <span>·</span>
                      <span className="uppercase tracking-wide">{f.source.replace("_", " ")}</span>
                      {f.status !== "ready" && (
                        <>
                          <span>·</span>
                          <span className="text-amber-400">{f.status}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{new Date(f.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {f.signed_url ? (
                    <a
                      href={f.signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg text-muted hover:text-gold hover:bg-gold/5 transition-colors"
                      title="Open"
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
        )}
      </section>

      {/* ─── GDrive file picker modal ──────────────────────────── */}
      {showGDrivePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowGDrivePicker(false)}
          />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-2xl flex flex-col max-h-[80vh]">
            <header className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Cloud size={16} className="text-blue-400" />
                <h3 className="text-sm font-semibold text-foreground">Pick files from Google Drive</h3>
              </div>
              <button
                onClick={() => setShowGDrivePicker(false)}
                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-light transition-colors"
              >
                <X size={14} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto">
              {gdriveLoading ? (
                <div className="p-10 text-center text-muted text-sm">Loading your Drive…</div>
              ) : gdriveFiles.length === 0 ? (
                <div className="p-10 text-center text-muted text-sm">No files found</div>
              ) : (
                <ul className="divide-y divide-border">
                  {gdriveFiles.map((f) => {
                    const Icon = iconForMime(f.mimeType);
                    const checked = gdriveSelected.has(f.id);
                    return (
                      <li
                        key={f.id}
                        className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-surface-light transition-colors"
                        onClick={() => {
                          setGdriveSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(f.id)) next.delete(f.id);
                            else next.add(f.id);
                            return next;
                          });
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          readOnly
                          className="h-4 w-4 accent-gold"
                        />
                        <div className="h-8 w-8 rounded-lg bg-surface flex items-center justify-center text-muted">
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{f.name}</p>
                          <p className="text-[11px] text-muted">
                            {formatBytes(f.size)} ·{" "}
                            {f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : ""}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <footer className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="text-xs text-muted">
                {gdriveSelected.size} selected
              </span>
              <button
                disabled={!gdriveSelected.size || syncing}
                onClick={syncSelected}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-bg font-medium text-sm hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {syncing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <UploadCloud size={14} />
                )}
                Import
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectCard({
  title,
  icon,
  status,
  onConnect,
  onPick,
  onDisconnect,
  comingSoon,
}: {
  title: string;
  icon: React.ReactNode;
  status: "connected" | "disconnected" | "unknown";
  onConnect?: () => void;
  onPick?: () => void;
  onDisconnect?: () => void;
  comingSoon?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-foreground">{title}</span>
        {status === "connected" && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
            <CheckCircle2 size={10} />
            Connected
          </span>
        )}
        {comingSoon && (
          <span className="ml-auto text-[10px] font-semibold text-muted bg-surface-light px-1.5 py-0.5 rounded">
            Coming soon
          </span>
        )}
      </div>
      {comingSoon ? (
        <p className="text-xs text-muted">
          Ping your agency to enable {title} sync.
        </p>
      ) : status === "connected" ? (
        <div className="flex items-center gap-2">
          <button
            onClick={onPick}
            className="flex items-center gap-1.5 flex-1 justify-center px-3 py-1.5 text-xs font-medium rounded-lg bg-gold text-bg hover:bg-gold/90 transition-colors"
          >
            <UploadCloud size={12} />
            Pick files
          </button>
          <button
            onClick={onDisconnect}
            className="px-3 py-1.5 text-xs rounded-lg text-muted hover:text-danger border border-border hover:bg-surface-light transition-colors"
            title="Disconnect"
          >
            <Plug size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={onConnect}
          className="flex items-center gap-1.5 w-full justify-center px-3 py-1.5 text-xs font-medium rounded-lg border border-gold/30 text-gold hover:bg-gold/5 transition-colors"
        >
          <Link2 size={12} />
          Connect {title}
        </button>
      )}
    </div>
  );
}
