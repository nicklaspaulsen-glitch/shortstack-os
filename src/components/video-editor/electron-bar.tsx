"use client";

/* ────────────────────────────────────────────────────────────────
 * Electron-only feature bar.
 *
 * All features gated behind `window.electron`. When rendered in the
 * web build, the bar hides itself entirely. In Electron the button
 * handlers call out to the preload IPC bridge.
 * ────────────────────────────────────────────────────────────────*/

import { useEffect, useState } from "react";
import { FolderOpen, Cpu, Download, Zap } from "lucide-react";
import toast from "react-hot-toast";

// ElectronApi + window.electron live in src/types/electron.d.ts — one canonical
// shape so TS doesn't reject conflicting inline `declare global` blocks. Every
// method is optional; we guard with `window.electron?.foo` at every call site.

export interface ElectronBarProps {
  onFilesImported?: (paths: string[]) => void;
  composition?: unknown;
}

export function ElectronBar({ onFilesImported, composition }: ElectronBarProps) {
  const [isElectron, setIsElectron] = useState(false);
  const [gpu, setGpu] = useState(false);

  useEffect(() => {
    const has = typeof window !== "undefined" && Boolean(window.electron);
    setIsElectron(has);
    if (has && window.electron?.gpuAvailable) {
      window.electron
        .gpuAvailable()
        .then((ok) => setGpu(Boolean(ok)))
        .catch(() => setGpu(false));
    }
  }, []);

  if (!isElectron) return null;

  const openFiles = async () => {
    if (!window.electron?.openFiles) {
      toast.error("Native file picker unavailable");
      return;
    }
    try {
      const paths = await window.electron.openFiles();
      if (paths.length > 0) {
        toast.success(`Imported ${paths.length} file${paths.length === 1 ? "" : "s"}`);
        onFilesImported?.(paths);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to open files";
      toast.error(msg);
    }
  };

  const renderLocal = async () => {
    if (!window.electron?.renderLocal) {
      toast("Local render: FFmpeg bridge pending", { icon: "▸" });
      return;
    }
    const id = toast.loading("Rendering locally…");
    try {
      const result = await window.electron.renderLocal(composition ?? {});
      if (result.ok && result.path) {
        toast.success(`Saved → ${result.path}`, { id });
      } else {
        toast.error(result.error || "Local render failed", { id });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Local render failed";
      toast.error(msg, { id });
    }
  };

  return (
    <div className="flex items-center gap-2 bg-neutral-900/70 border border-neutral-800 rounded-md px-2 py-1">
      <button
        type="button"
        onClick={openFiles}
        className="flex items-center gap-1 text-[10px] text-neutral-200 hover:text-white px-2 py-1 rounded hover:bg-neutral-800"
        title="Open footage from disk (native picker)"
      >
        <FolderOpen size={11} /> Import
      </button>
      <button
        type="button"
        onClick={renderLocal}
        className="flex items-center gap-1 text-[10px] text-neutral-200 hover:text-white px-2 py-1 rounded hover:bg-neutral-800"
        title="Render with local FFmpeg"
      >
        <Download size={11} /> Render local
      </button>
      {gpu && (
        <span
          className="flex items-center gap-1 text-[10px] rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5"
          title="GPU-accelerated preview enabled"
        >
          <Zap size={10} /> GPU
        </span>
      )}
      <span className="flex items-center gap-1 text-[10px] rounded bg-neutral-800 text-neutral-400 border border-neutral-700 px-2 py-0.5">
        <Cpu size={10} /> Electron
      </span>
    </div>
  );
}
