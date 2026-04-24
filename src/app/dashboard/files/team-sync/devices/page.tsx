"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, Monitor, ExternalLink, AlertTriangle, Loader,
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

const PLATFORM_LABELS: Record<string, string> = {
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
  android: "Android",
  ios: "iOS",
  other: "Other",
};

export default function TeamSyncDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState("");
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newPlatform, setNewPlatform] = useState<string>("other");
  const [iframeBlocked, setIframeBlocked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team-sync/devices");
      const json = await res.json();
      setDevices(json.devices ?? []);
    } catch {
      toast.error("Failed to load devices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addDevice = async () => {
    if (!newDeviceId.trim()) {
      toast.error("Device ID required");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/team-sync/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: newDeviceId.trim().toUpperCase(),
          device_name: newDeviceName.trim(),
          platform: newPlatform,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Add failed");
      toast.success("Device added");
      setNewDeviceId("");
      setNewDeviceName("");
      setNewPlatform("other");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAdding(false);
    }
  };

  const removeDevice = async (id: string) => {
    if (!confirm("Remove this device?")) return;
    try {
      const res = await fetch(`/api/team-sync/devices?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Remove failed");
      toast.success("Device removed");
      await load();
    } catch {
      toast.error("Remove failed");
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/files/team-sync"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
      >
        <ArrowLeft className="w-3 h-3" /> Back to team sync
      </Link>

      <PageHero
        title="Your devices"
        subtitle="Register the Syncthing device IDs for every machine you sync files from."
        icon={<Monitor className="w-6 h-6" />}
        gradient="ocean"
      />

      <section className="rounded-xl border border-border/40 bg-surface/40 p-5 space-y-3">
        <h2 className="text-sm font-semibold">Add a device</h2>
        <p className="text-[11px] text-muted leading-relaxed">
          Open{" "}
          <code className="font-mono text-brand-primary">
            http://localhost:8384
          </code>{" "}
          on your machine, click <em>Actions, Show ID</em>, copy the
          52-character string, and paste it here.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="text-[10px] uppercase tracking-wider text-muted">
              Device ID
            </label>
            <input
              type="text"
              value={newDeviceId}
              onChange={(e) => setNewDeviceId(e.target.value)}
              placeholder="XXXXXXX-XXXXXXX-XXXXXXX-XXXXXXX-XXXXXXX-XXXXXXX-XXXXXXX-XXXXXXX"
              className="w-full mt-1 bg-background border border-border/40 rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:border-brand-primary"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted">
              Nickname
            </label>
            <input
              type="text"
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              placeholder="e.g. Studio iMac"
              className="w-full mt-1 bg-background border border-border/40 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-brand-primary"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted">
              Platform
            </label>
            <select
              value={newPlatform}
              onChange={(e) => setNewPlatform(e.target.value)}
              className="w-full mt-1 bg-background border border-border/40 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-brand-primary"
            >
              {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={addDevice}
          disabled={adding}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary text-xs font-medium disabled:opacity-50"
        >
          <Plus className="w-3 h-3" />
          {adding ? "Adding..." : "Add device"}
        </button>
      </section>

      <section className="rounded-xl border border-border/40 bg-surface/40 p-5">
        <h2 className="text-sm font-semibold mb-3">Registered devices</h2>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted">
            <Loader className="w-4 h-4 animate-spin" />
          </div>
        ) : devices.length === 0 ? (
          <EmptyState
            icon={<Monitor className="w-10 h-10" />}
            title="No devices yet"
            description="Add a Syncthing device ID above to get started."
          />
        ) : (
          <ul className="space-y-2">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between p-3 rounded-lg bg-background/60 border border-border/30"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium">
                    {d.device_name || "Unnamed device"}{" "}
                    <span className="text-[10px] text-muted uppercase ml-2">
                      {PLATFORM_LABELS[d.platform] ?? d.platform}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted font-mono truncate">
                    {d.device_id}
                  </div>
                  <div className="text-[10px] text-muted/70 mt-0.5">
                    Added {new Date(d.added_at).toLocaleDateString()}
                    {d.last_seen_at
                      ? ` - last seen ${new Date(d.last_seen_at).toLocaleString()}`
                      : ""}
                  </div>
                </div>
                <button
                  onClick={() => removeDevice(d.id)}
                  className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
                  title="Remove device"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border/40 bg-surface/40 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Local Syncthing web UI</h2>
          <a
            href="http://localhost:8384"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-brand-primary hover:underline"
          >
            Open in new tab <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="flex items-start gap-2 text-[11px] text-muted bg-amber-500/5 border border-amber-500/20 rounded-md p-3">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-none mt-0.5" />
          <span>
            Requires Syncthing running on <strong>your</strong> machine. If the
            frame is blank, the daemon is not running locally.{" "}
            <a
              href="https://syncthing.net/downloads/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-primary hover:underline"
            >
              Install it
            </a>{" "}
            and restart this page.
          </span>
        </div>
        {iframeBlocked ? (
          <div className="rounded-lg border border-border/30 bg-background/60 p-6 text-center text-xs text-muted">
            Could not load localhost:8384. Is Syncthing running?
          </div>
        ) : (
          <iframe
            src="http://localhost:8384"
            title="Syncthing local web UI"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            className="w-full h-[520px] rounded-lg border border-border/30 bg-background"
            onError={() => setIframeBlocked(true)}
          />
        )}
      </section>
    </div>
  );
}
