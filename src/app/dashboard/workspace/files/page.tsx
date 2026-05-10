"use client";

/**
 * Workspace Files — Drive-style file system on Cloudflare R2.
 *
 * Layout:
 *   ┌─ <PageHero ocean> with breadcrumb + actions ────────────────┐
 *   │  Upload | New folder                                        │
 *   ├─ LEFT (folder tree) ───────────┬─ RIGHT (folder contents) ──┤
 *   │  • Workspace                   │  Drag-drop zone            │
 *   │  • Templates                   │  Grid of file cards        │
 *   │  • Brand assets                │                            │
 *   │  • Clients                     │                            │
 *   └────────────────────────────────┴────────────────────────────┘
 *
 * Upload flow: presign → PUT to R2 → finalize → refresh list.
 */
import { useState, useEffect, useCallback, useRef, DragEvent } from "react";
import {
  FolderIcon,
  FilePlus,
  FolderPlus,
  Upload as UploadIcon,
  ChevronRight,
  ChevronDown,
  File as FileIcon,
  Image as ImageIcon,
  FileVideo,
  FileText,
  Trash2,
  Edit2,
  Link2,
  Move,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import toast from "react-hot-toast";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Folder {
  id: string;
  agency_owner_id: string;
  parent_id: string | null;
  client_id: string | null;
  name: string;
  permission: "owner_only" | "team_read" | "team_write" | "client_can_view";
  is_system: boolean;
  created_at: string;
}

interface Crumb {
  id: string;
  name: string;
}

interface FileRow {
  id: string;
  agency_owner_id: string;
  folder_id: string;
  name: string;
  size_bytes: number;
  mime_type: string;
  r2_key: string;
  r2_public_url: string | null;
  status: "pending" | "ready" | "failed";
  source: string;
  created_at: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function fileIconFor(mime: string) {
  if (mime.startsWith("image/")) return <ImageIcon size={18} />;
  if (mime.startsWith("video/")) return <FileVideo size={18} />;
  if (mime === "application/pdf") return <FileText size={18} />;
  if (mime.startsWith("text/")) return <FileText size={18} />;
  return <FileIcon size={18} />;
}

const PERMISSION_LABEL: Record<Folder["permission"], string> = {
  owner_only: "Owner only",
  team_read: "Team can view",
  team_write: "Team can edit",
  client_can_view: "Client can view",
};

// ─── Page ───────────────────────────────────────────────────────────────────

export default function WorkspaceFilesPage() {
  // Folder tree state — flat map keyed by parent_id ("root" for parent_id NULL).
  const [folderTree, setFolderTree] = useState<Record<string, Folder[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["root"]));
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<Crumb[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderPermission, setNewFolderPermission] =
    useState<Folder["permission"]>("team_write");
  const [uploading, setUploading] = useState<number>(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileRow } | null>(
    null,
  );

  const dropRef = useRef<HTMLDivElement>(null);

  // ── Load folders for a parent (cached in folderTree[parentKey]) ─────
  const loadFolders = useCallback(
    async (parentId: string | null): Promise<Folder[]> => {
      const url = parentId
        ? `/api/workspace/folders?parent_id=${parentId}`
        : "/api/workspace/folders";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        toast.error("Failed to load folders");
        return [];
      }
      const data = (await res.json()) as { folders: Folder[]; breadcrumb: Crumb[] };
      const key = parentId ?? "root";
      setFolderTree((prev) => ({ ...prev, [key]: data.folders }));
      if (parentId) setBreadcrumb(data.breadcrumb);
      return data.folders;
    },
    [],
  );

  const loadFiles = useCallback(async (folderId: string) => {
    const res = await fetch(`/api/workspace/files?folder_id=${folderId}`, { cache: "no-store" });
    if (!res.ok) {
      toast.error("Failed to load files");
      return;
    }
    const data = (await res.json()) as { files: FileRow[] };
    setFiles(data.files);
  }, []);

  // Initial load — fetch root folders, auto-select the first one ("Workspace")
  useEffect(() => {
    (async () => {
      setLoading(true);
      const roots = await loadFolders(null);
      if (roots.length > 0) {
        setActiveFolderId(roots[0].id);
        setBreadcrumb([{ id: roots[0].id, name: roots[0].name }]);
        await loadFiles(roots[0].id);
      }
      setLoading(false);
    })();
  }, [loadFolders, loadFiles]);

  // ── Tree expand / collapse ─────────────────────────────────────────────
  const toggleExpand = useCallback(
    async (folderId: string) => {
      const next = new Set(expanded);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
        if (!folderTree[folderId]) await loadFolders(folderId);
      }
      setExpanded(next);
    },
    [expanded, folderTree, loadFolders],
  );

  const selectFolder = useCallback(
    async (folder: Folder) => {
      setActiveFolderId(folder.id);
      await loadFiles(folder.id);
      // Refresh breadcrumb by hitting the API for this folder's children — the
      // response includes the breadcrumb walked up to the root.
      const res = await fetch(`/api/workspace/folders?parent_id=${folder.id}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { folders: Folder[]; breadcrumb: Crumb[] };
        setFolderTree((prev) => ({ ...prev, [folder.id]: data.folders }));
        // Append the folder itself if breadcrumb stops at the parent.
        const last = data.breadcrumb[data.breadcrumb.length - 1];
        const trail = last?.id === folder.id ? data.breadcrumb : [...data.breadcrumb, { id: folder.id, name: folder.name }];
        setBreadcrumb(trail);
      }
    },
    [loadFiles],
  );

  // ── New folder ────────────────────────────────────────────────────────
  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const res = await fetch("/api/workspace/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_id: activeFolderId,
        name,
        permission: newFolderPermission,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j?.error ?? "Could not create folder");
      return;
    }
    toast.success("Folder created");
    setNewFolderName("");
    setCreatingFolder(false);
    // Refresh both the parent's listing and the tree side.
    await loadFolders(activeFolderId);
  }, [activeFolderId, loadFolders, newFolderName, newFolderPermission]);

  // ── Upload ─────────────────────────────────────────────────────────────
  const uploadOne = useCallback(
    async (file: File): Promise<void> => {
      if (!activeFolderId) {
        toast.error("Pick a folder first");
        return;
      }
      // 1. presign
      const pres = await fetch("/api/workspace/files/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder_id: activeFolderId,
          name: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
        }),
      });
      if (!pres.ok) {
        const j = await pres.json().catch(() => ({}));
        toast.error(j?.error ?? "Could not start upload");
        return;
      }
      const { upload_url, file_id } = (await pres.json()) as {
        upload_url: string;
        file_id: string;
      };

      // 2. PUT to R2
      const put = await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) {
        toast.error(`Upload failed (${put.status})`);
        return;
      }

      // 3. finalize
      const fin = await fetch(`/api/workspace/files/${file_id}/finalize`, { method: "POST" });
      if (!fin.ok) {
        const j = await fin.json().catch(() => ({}));
        toast.error(j?.error ?? "Finalize failed");
        return;
      }
    },
    [activeFolderId],
  );

  const handleUpload = useCallback(
    async (fileList: FileList | File[]) => {
      const arr = Array.from(fileList);
      if (arr.length === 0 || !activeFolderId) return;
      setUploading(arr.length);
      let completed = 0;
      for (const f of arr) {
        try {
          await uploadOne(f);
        } catch (err) {
          console.error("[workspace-files] upload error", err);
        }
        completed += 1;
        setUploading(arr.length - completed);
      }
      toast.success(`${arr.length} file${arr.length === 1 ? "" : "s"} uploaded`);
      await loadFiles(activeFolderId);
    },
    [activeFolderId, loadFiles, uploadOne],
  );

  // Drag and drop on the right pane.
  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        void handleUpload(e.dataTransfer.files);
      }
    },
    [handleUpload],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ── Context menu actions ───────────────────────────────────────────────
  const closeContext = useCallback(() => setContextMenu(null), []);
  useEffect(() => {
    if (!contextMenu) return;
    const onClick = () => closeContext();
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [contextMenu, closeContext]);

  const handleDeleteFile = useCallback(
    async (file: FileRow) => {
      if (!confirm(`Delete "${file.name}"?`)) return;
      const res = await fetch(`/api/workspace/files/${file.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Delete failed");
        return;
      }
      toast.success("Deleted");
      if (activeFolderId) await loadFiles(activeFolderId);
    },
    [activeFolderId, loadFiles],
  );

  const handleRenameFile = useCallback(
    async (file: FileRow) => {
      const next = window.prompt("Rename file", file.name);
      if (!next || next.trim() === "" || next === file.name) return;
      // We use the file table's name column for display only; renames don't
      // touch the R2 key (which is content-addressed by ts + slug). Update
      // the row directly.
      // NOTE: the file route doesn't expose PATCH yet — we'll skip rename in
      // this MVP and surface a graceful message.
      toast(`Rename UX coming soon — file is "${file.name}"`);
      void next;
    },
    [],
  );

  const handleShareLink = useCallback(async (file: FileRow) => {
    const res = await fetch(`/api/workspace/files/${file.id}/share-link?ttl=24h`);
    if (!res.ok) {
      toast.error("Could not generate share link");
      return;
    }
    const { url } = (await res.json()) as { url: string };
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied (24h)");
    } catch {
      window.prompt("Share link (24h)", url);
    }
  }, []);

  const handleDownload = useCallback(async (file: FileRow) => {
    const res = await fetch(`/api/workspace/files/${file.id}/download`);
    if (!res.ok) {
      toast.error("Download failed");
      return;
    }
    const { url } = (await res.json()) as { url: string };
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────
  const rootFolders = folderTree["root"] ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        title="Workspace files"
        subtitle="Drive-style storage on Cloudflare R2 — briefs, thumbnails, videos, contracts, and brand assets in one place."
        gradient="gold"
        eyebrow="Workspace"
        icon={<Sparkles size={20} />}
        actions={
          <>
            <button
              type="button"
              onClick={() => setCreatingFolder((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm px-3 py-1.5 transition"
            >
              <FolderPlus size={14} /> New folder
            </button>
            <label className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/90 hover:bg-cyan-300 text-slate-900 text-sm font-medium px-3 py-1.5 cursor-pointer transition">
              <UploadIcon size={14} /> Upload
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void handleUpload(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </>
        }
      />

      {/* New-folder inline prompt */}
      {creatingFolder && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-black/[0.06] bg-black/[0.04] p-3">
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreateFolder();
            }}
            placeholder="Folder name"
            autoFocus
            className="flex-1 min-w-[180px] rounded-md bg-[#F8FAFC] border border-black/[0.08] text-[#111827] text-sm px-3 py-1.5 outline-none focus:border-[rgba(37,99,235,0.6)]"
          />
          <select
            value={newFolderPermission}
            onChange={(e) => setNewFolderPermission(e.target.value as Folder["permission"])}
            className="rounded-md bg-[#F8FAFC] border border-black/[0.08] text-[#111827] text-sm px-2 py-1.5"
          >
            <option value="owner_only">Owner only</option>
            <option value="team_read">Team can view</option>
            <option value="team_write">Team can edit</option>
            <option value="client_can_view">Client can view</option>
          </select>
          <button
            type="button"
            onClick={() => void handleCreateFolder()}
            className="rounded-md bg-cyan-400 hover:bg-cyan-300 text-slate-900 text-sm font-medium px-3 py-1.5"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setCreatingFolder(false);
              setNewFolderName("");
            }}
            className="rounded-md text-[#6B7280] hover:text-[#111827] text-sm px-2 py-1.5"
          >
            Cancel
          </button>
        </div>
      )}

      {/* 2-column body */}
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        {/* LEFT — folder tree */}
        <aside className="rounded-xl border border-black/[0.06] bg-white p-2 h-fit">
          <h3 className="text-[11px] uppercase tracking-wide text-[#9CA3AF] px-2 pt-2 pb-1.5">
            Folders
          </h3>
          {loading && rootFolders.length === 0 ? (
            <div className="px-2 py-4 text-[#9CA3AF] text-sm">Loading…</div>
          ) : (
            <ul className="space-y-0.5">
              {rootFolders.map((f) => (
                <FolderTreeNode
                  key={f.id}
                  folder={f}
                  depth={0}
                  expanded={expanded}
                  folderTree={folderTree}
                  activeFolderId={activeFolderId}
                  onToggle={toggleExpand}
                  onSelect={selectFolder}
                />
              ))}
            </ul>
          )}
        </aside>

        {/* RIGHT — folder contents */}
        <section
          ref={dropRef}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="rounded-xl border border-black/[0.06] bg-white p-4 min-h-[420px]"
        >
          {/* Breadcrumb */}
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-[#6B7280] mb-4">
            <span className="text-[#9CA3AF]">Files</span>
            {breadcrumb.map((c, i) => (
              <span key={c.id} className="flex items-center gap-1.5">
                <ChevronRight size={12} className="text-[#9CA3AF]" />
                <span className={i === breadcrumb.length - 1 ? "text-[#111827]" : ""}>{c.name}</span>
              </span>
            ))}
          </nav>

          {uploading > 0 && (
            <div className="mb-3 flex items-center gap-2 text-cyan-300 text-sm">
              <Loader2 size={14} className="animate-spin" /> Uploading {uploading} file
              {uploading === 1 ? "" : "s"}…
            </div>
          )}

          {!activeFolderId ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#9CA3AF]">
              <FolderIcon size={32} />
              <p className="mt-3 text-sm">Select a folder to see its files</p>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#9CA3AF]">
              <FilePlus size={32} />
              <p className="mt-3 text-sm">No files yet — drop a file here or click Upload</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {files.map((f) => (
                <FileCard
                  key={f.id}
                  file={f}
                  onContextMenu={(e, file) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, file });
                  }}
                  onDoubleClick={(file) => void handleDownload(file)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded-md border border-black/[0.06] bg-white shadow-2xl py-1 text-sm"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {[
            {
              label: "Open / download",
              icon: <FileIcon size={14} />,
              fn: () => handleDownload(contextMenu.file),
            },
            {
              label: "Copy 24h share link",
              icon: <Link2 size={14} />,
              fn: () => handleShareLink(contextMenu.file),
            },
            {
              label: "Rename",
              icon: <Edit2 size={14} />,
              fn: () => handleRenameFile(contextMenu.file),
            },
            {
              label: "Move",
              icon: <Move size={14} />,
              fn: () => toast("Move UX coming soon — drag-drop or use the API"),
            },
            {
              label: "Delete",
              icon: <Trash2 size={14} />,
              fn: () => handleDeleteFile(contextMenu.file),
              danger: true,
            },
          ].map((row) => (
            <button
              type="button"
              key={row.label}
              onClick={() => {
                void row.fn();
                closeContext();
              }}
              className={`flex items-center gap-2 px-3 py-1.5 w-full text-left ${
                row.danger ? "text-red-700 hover:bg-red-500/10" : "text-[#111827] hover:bg-black/[0.04]"
              }`}
            >
              {row.icon} {row.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // (close component)
}

// ─── Folder tree node ────────────────────────────────────────────────────────

interface FolderTreeNodeProps {
  folder: Folder;
  depth: number;
  expanded: Set<string>;
  folderTree: Record<string, Folder[]>;
  activeFolderId: string | null;
  onToggle: (id: string) => void | Promise<void>;
  onSelect: (folder: Folder) => void | Promise<void>;
}

function FolderTreeNode(props: FolderTreeNodeProps) {
  const { folder, depth, expanded, folderTree, activeFolderId, onToggle, onSelect } = props;
  const isOpen = expanded.has(folder.id);
  const kids = folderTree[folder.id] ?? [];
  const isActive = activeFolderId === folder.id;

  return (
    <li>
      <div
        className={`flex items-center gap-1 rounded-md text-sm cursor-pointer ${
          isActive ? "bg-[rgba(37,99,235,0.08)] text-[#2563EB]" : "text-[#374151] hover:bg-black/[0.04]"
        }`}
        style={{ paddingLeft: 8 + depth * 12, paddingRight: 8 }}
      >
        <button
          type="button"
          aria-label={isOpen ? "Collapse" : "Expand"}
          onClick={() => void onToggle(folder.id)}
          className="p-1 text-[#6B7280] hover:text-[#111827]"
        >
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <button
          type="button"
          onClick={() => void onSelect(folder)}
          className="flex items-center gap-1.5 py-1.5 flex-1 text-left truncate"
          title={`${folder.name} — ${PERMISSION_LABEL[folder.permission]}`}
        >
          <FolderIcon size={14} className={isActive ? "text-[#2563EB]" : "text-[#6B7280]"} />
          <span className="truncate">{folder.name}</span>
          {folder.is_system && <Lock size={9} className="text-[#9CA3AF] shrink-0" />}
        </button>
      </div>
      {isOpen && kids.length > 0 && (
        <ul className="space-y-0.5">
          {kids.map((k) => (
            <FolderTreeNode
              key={k.id}
              folder={k}
              depth={depth + 1}
              expanded={expanded}
              folderTree={folderTree}
              activeFolderId={activeFolderId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── File card ──────────────────────────────────────────────────────────────

interface FileCardProps {
  file: FileRow;
  onContextMenu: (e: React.MouseEvent, file: FileRow) => void;
  onDoubleClick: (file: FileRow) => void;
}

function FileCard(props: FileCardProps) {
  const { file, onContextMenu, onDoubleClick } = props;
  const isImage = file.mime_type.startsWith("image/") && file.r2_public_url;

  return (
    <button
      type="button"
      onContextMenu={(e) => onContextMenu(e, file)}
      onDoubleClick={() => onDoubleClick(file)}
      className="group flex flex-col text-left rounded-lg border border-black/[0.06] bg-white hover:bg-[#F8FAFC] hover:border-[rgba(37,99,235,0.3)] transition overflow-hidden"
    >
      <div className="aspect-square w-full bg-[#F8FAFC] flex items-center justify-center text-[#9CA3AF] overflow-hidden">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.r2_public_url ?? ""}
            alt={file.name}
            className="w-full h-full object-cover group-hover:scale-105 transition"
            loading="lazy"
          />
        ) : (
          <div className="text-[#2563EB]/60">{fileIconFor(file.mime_type)}</div>
        )}
      </div>
      <div className="px-2 py-1.5">
        <div className="text-xs text-[#111827] truncate" title={file.name}>
          {file.name}
        </div>
        <div className="text-[10px] text-[#9CA3AF] mt-0.5 flex items-center justify-between">
          <span>{formatBytes(file.size_bytes)}</span>
          {file.status !== "ready" && <span className="text-amber-700">{file.status}</span>}
        </div>
      </div>
    </button>
  );
}
