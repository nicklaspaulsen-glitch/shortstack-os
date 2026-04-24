"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Shield, Download, Folder, Monitor, Plus, ArrowRight, Loader,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import EmptyState from "@/components/ui/empty-state";
import toast from "react-hot-toast";

interface Device {
  id: string;
  device_id: string;
  device_name: string;
  platform: string;
  last_seen_at: string | null;
  added_at: string;
}
interface FolderRow {
  id: string;
  folder_id: string;
  folder_label: string;
  path_hint: string;
  size_gb: number;
  file_count: number;
  owner_user_id: string;
  created_at: string;
}

export default function TeamSyncLanding() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, fRes] = await Promise.all([
        fetch("/api/team-sync/devices"),
        fetch("/api/team-sync/folders"),
      ]);
      const d = await dRes.json();
      const f = await fRes.json();
      setDevices(d.devices ?? []);
      setFolders(f.folders ?? []);
    } catch {
      toast.error("Failed to load team sync data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createFolder = async () => {
    const folder_id = prompt(
      "Syncthing folder ID (from your local Syncthing web UI, Add Folder, Folder ID):"
    );
    if (!folder_id) return;
    const folder_label = prompt("Display label for this folder:") ?? folder_id;
    const path_hint = prompt("Path hint (what is inside this folder?):") ?? "";

    setCreating(true);
    try {
      const res = await fetch("/api/team-sync/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id, folder_label, path_hint }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      toast.success("Folder registered");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        title="Team file sync"
        subtitle="Peer-to-peer file sync for your internal team, powered by Syncthing."
        icon={<Shield className="w-6 h-6" />}
        gradient="ocean"
        eyebrow="Team only"
      />

      <section className="rounded-xl border border-border/40 bg-surface/40 p-5 space-y-3">
        <h2 className="text-sm font-semibold">Why Syncthing?</h2>
        <ul className="text-xs text-muted space-y-1.5 leading-relaxed">
          <li>
            <strong className="text-foreground">Peer-to-peer.</strong> Files
            transfer directly between your machines. No cloud middleman holds
            your content.
          </li>
          <li>
            <strong className="text-foreground">Encrypted in transit.</strong>{" "}
            TLS 1.3 between every pair of devices.
          </li>
          <li>
            <strong className="text-foreground">Open source (MPL-2.0).</strong>{" "}
            Audited, transparent, and free forever.
          </li>
          <li>
            <strong className="text-foreground">Works offline.</strong> Resumes
            when peers come back online. No monthly storage bill.
          </li>
        </ul>
        <p className="text-[11px] text-muted/80 mt-2">
          This feature is for <strong>internal team collaboration only</strong>.
          Clients continue to use Google Drive via the client portal.
        </p>
      </section>

      <section className="rounded-xl border border-border/40 bg-surface/40 p-5 space-y-4">
        <h2 className="text-sm font-semibold">Get started in 3 steps</h2>
        <ol className="space-y-3 text-xs text-muted">
          <li className="flex gap-3">
            <span className="flex-none w-6 h-6 rounded-full bg-brand-primary/20 text-brand-primary text-[11px] font-semibold flex items-center justify-center">
              1
            </span>
            <div className="space-y-1.5">
              <div className="text-foreground font-medium">
                Install Syncthing on every machine you use
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://syncthing.net/downloads/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] text-brand-primary hover:underline"
                >
                  <Download className="w-3 h-3" /> All downloads
                </a>
                <a
                  href="https://apt.syncthing.net/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] text-brand-primary hover:underline"
                >
                  Linux
                </a>
                <a
                  href="https://github.com/syncthing/syncthing-macos/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] text-brand-primary hover:underline"
                >
                  macOS
                </a>
                <a
                  href="https://github.com/Catfriend1/syncthing-android/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] text-brand-primary hover:underline"
                >
                  Android
                </a>
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-none w-6 h-6 rounded-full bg-brand-primary/20 text-brand-primary text-[11px] font-semibold flex items-center justify-center">
              2
            </span>
            <div>
              <div className="text-foreground font-medium">Grab your device ID</div>
              <div className="text-[11px] mt-1">
                Open{" "}
                <code className="font-mono text-brand-primary">
                  http://localhost:8384
                </code>
                , click <em>Actions, Show ID</em>, and copy the 52-character
                string.
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-none w-6 h-6 rounded-full bg-brand-primary/20 text-brand-primary text-[11px] font-semibold flex items-center justify-center">
              3
            </span>
            <div>
              <div className="text-foreground font-medium">
                Register it in ShortStack
              </div>
              <Link
                href="/dashboard/files/team-sync/devices"
                className="inline-flex items-center gap-1 text-[11px] text-brand-primary hover:underline mt-1"
              >
                Open devices page <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </li>
        </ol>
      </section>

      <section className="rounded-xl border border-border/40 bg-surface/40 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Monitor className="w-4 h-4" /> Your devices
          </h2>
          <Link
            href="/dashboard/files/team-sync/devices"
            className="text-[11px] text-brand-primary hover:underline"
          >
            Manage
          </Link>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted">
            <Loader className="w-4 h-4 animate-spin" />
          </div>
        ) : devices.length === 0 ? (
          <EmptyState
            icon={<Monitor className="w-10 h-10" />}
            title="No devices registered yet"
            description="Add your first device ID to start syncing with teammates."
          />
        ) : (
          <ul className="space-y-2">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between p-3 rounded-lg bg-background/60 border border-border/30"
              >
                <div>
                  <div className="text-xs font-medium">
                    {d.device_name || "Unnamed device"}
                  </div>
                  <div className="text-[10px] text-muted font-mono truncate max-w-md">
                    {d.device_id}
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted">
                  {d.platform}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border/40 bg-surface/40 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Folder className="w-4 h-4" /> Shared folders
          </h2>
          <button
            onClick={createFolder}
            disabled={creating}
            className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary disabled:opacity-50"
          >
            <Plus className="w-3 h-3" />
            {creating ? "Creating..." : "Create shared folder"}
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted">
            <Loader className="w-4 h-4 animate-spin" />
          </div>
        ) : folders.length === 0 ? (
          <EmptyState
            icon={<Folder className="w-10 h-10" />}
            title="No shared folders yet"
            description="Register a Syncthing folder ID to start sharing with teammates."
          />
        ) : (
          <ul className="space-y-2">
            {folders.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/dashboard/files/team-sync/folders/${f.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/60 border border-border/30 hover:border-brand-primary/40 transition-colors"
                >
                  <div>
                    <div className="text-xs font-medium">
                      {f.folder_label || f.folder_id}
                    </div>
                    <div className="text-[10px] text-muted">
                      {f.path_hint || "No description"}
                    </div>
                  </div>
                  <div className="text-[10px] text-muted">
                    {f.size_gb > 0 ? `${f.size_gb.toFixed(1)} GB` : "-"} ·{" "}
                    {f.file_count || 0} files
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
