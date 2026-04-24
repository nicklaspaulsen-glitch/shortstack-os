"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Folder, Users, Copy, Plus, Trash2, Loader, Share2, CheckCircle2,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import toast from "react-hot-toast";

interface FolderRow {
  id: string;
  folder_id: string;
  folder_label: string;
  path_hint: string;
  size_gb: number;
  file_count: number;
  owner_user_id: string;
}
interface Member {
  folder_id: string;
  user_id: string;
  permission: string;
  added_at: string;
  profile: { email?: string; full_name?: string } | null;
}
interface ShareKit {
  folder: { id: string; folder_id: string; folder_label: string };
  sender_device: { device_id: string; device_name: string; platform: string };
  qr_payload: string;
  qr_svg_data_url: string;
  instructions: string[];
}

export default function FolderDetail() {
  const params = useParams();
  const folderId = params?.id as string;

  const [folder, setFolder] = useState<FolderRow | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [shareKit, setShareKit] = useState<ShareKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newPermission, setNewPermission] = useState("send-receive");
  const [addingMember, setAddingMember] = useState(false);

  const load = useCallback(async () => {
    if (!folderId) return;
    setLoading(true);
    try {
      const [fRes, mRes, sRes] = await Promise.all([
        fetch(`/api/team-sync/folders/${folderId}`),
        fetch(`/api/team-sync/folders/${folderId}/members`),
        fetch(`/api/team-sync/folders/${folderId}/share-kit`),
      ]);
      const fJson = await fRes.json();
      const mJson = await mRes.json();
      const sJson = await sRes.json();
      if (fJson.folder) setFolder(fJson.folder);
      setMembers(mJson.members ?? []);
      if (sRes.ok) setShareKit(sJson);
    } catch {
      toast.error("Failed to load folder");
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => {
    load();
  }, [load]);

  const addMember = async () => {
    if (!newMemberEmail.trim()) return;
    setAddingMember(true);
    try {
      const res = await fetch(`/api/team-sync/folders/${folderId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newMemberEmail.trim(),
          permission: newPermission,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Add failed");
      toast.success("Member added");
      setNewMemberEmail("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAddingMember(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!confirm("Remove this member?")) return;
    try {
      const res = await fetch(
        `/api/team-sync/folders/${folderId}/members?user_id=${userId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Remove failed");
      toast.success("Member removed");
      await load();
    } catch {
      toast.error("Remove failed");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  if (loading && !folder) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-5 h-5 animate-spin text-muted" />
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="text-center py-12 text-muted">
        <p className="text-sm">Folder not found.</p>
        <Link
          href="/dashboard/files/team-sync"
          className="text-xs text-brand-primary hover:underline"
        >
          Back to team sync
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/files/team-sync"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
      >
        <ArrowLeft className="w-3 h-3" /> Back to team sync
      </Link>

      <PageHero
        title={folder.folder_label || folder.folder_id}
        subtitle={folder.path_hint || "Shared Syncthing folder"}
        icon={<Folder className="w-6 h-6" />}
        gradient="ocean"
      />

      <section className="rounded-xl border border-border/40 bg-surface/40 p-5 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Users className="w-4 h-4" /> Members ({members.length})
        </h2>

        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] uppercase tracking-wider text-muted">
              Team member email
            </label>
            <input
              type="email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              placeholder="teammate@agency.com"
              className="w-full mt-1 bg-background border border-border/40 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-brand-primary"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted">
              Permission
            </label>
            <select
              value={newPermission}
              onChange={(e) => setNewPermission(e.target.value)}
              className="mt-1 bg-background border border-border/40 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-brand-primary"
            >
              <option value="send-receive">Send &amp; Receive</option>
              <option value="send-only">Send only</option>
              <option value="receive-only">Receive only</option>
            </select>
          </div>
          <button
            onClick={addMember}
            disabled={addingMember}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary text-xs font-medium disabled:opacity-50"
          >
            <Plus className="w-3 h-3" />
            {addingMember ? "Adding..." : "Add"}
          </button>
        </div>

        {members.length === 0 ? (
          <p className="text-xs text-muted py-2">
            No members yet. Add teammates to share this folder with them.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {members.map((m) => (
              <li
                key={m.user_id}
                className="flex items-center justify-between p-2 rounded-md bg-background/60 border border-border/30"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <div>
                    <div className="text-xs">
                      {m.profile?.full_name || m.profile?.email || m.user_id}
                    </div>
                    <div className="text-[10px] text-muted">
                      {m.permission}
                      {m.user_id === folder.owner_user_id ? " - owner" : ""}
                    </div>
                  </div>
                </div>
                {m.user_id !== folder.owner_user_id && (
                  <button
                    onClick={() => removeMember(m.user_id)}
                    className="p-1 rounded hover:bg-red-500/10 text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {shareKit && (
        <section className="rounded-xl border border-border/40 bg-surface/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Share2 className="w-4 h-4" /> Share this folder
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-center p-3 bg-white rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shareKit.qr_svg_data_url}
                alt="Share QR"
                className="w-56 h-56"
              />
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted">
                  Your device ID
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="font-mono text-[10px] bg-background/60 border border-border/30 rounded px-2 py-1 truncate">
                    {shareKit.sender_device.device_id}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        shareKit.sender_device.device_id,
                        "Device ID"
                      )
                    }
                    className="p-1.5 rounded hover:bg-brand-primary/10 text-brand-primary"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted">
                  Folder ID
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="font-mono text-[10px] bg-background/60 border border-border/30 rounded px-2 py-1 truncate">
                    {shareKit.folder.folder_id}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(shareKit.folder.folder_id, "Folder ID")
                    }
                    className="p-1.5 rounded hover:bg-brand-primary/10 text-brand-primary"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted">
                  Share URL
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="font-mono text-[10px] bg-background/60 border border-border/30 rounded px-2 py-1 truncate flex-1">
                    {shareKit.qr_payload}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(shareKit.qr_payload, "Share URL")
                    }
                    className="p-1.5 rounded hover:bg-brand-primary/10 text-brand-primary"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-foreground mb-2">
              Recipient setup steps
            </div>
            <ol className="list-decimal pl-5 space-y-1 text-[11px] text-muted leading-relaxed">
              {shareKit.instructions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </div>
  );
}
