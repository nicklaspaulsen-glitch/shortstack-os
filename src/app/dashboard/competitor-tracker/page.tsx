"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import Modal from "@/components/ui/modal";
import toast from "react-hot-toast";
import {
  Crosshair, Plus, Trash2, Edit2, Loader,
  Globe, RefreshCw, CheckCircle, AlertCircle, X
} from "lucide-react";

interface Competitor {
  id: string;
  user_id: string;
  name: string;
  website: string | null;
  notes: string | null;
  last_checked: string | null;
  snapshot_history: SnapshotEntry[];
  social_urls: Record<string, string>;
  tracked_keywords: string[];
  created_at: string;
}

interface SnapshotEntry {
  checked_at: string;
  title: string | null;
  description: string | null;
}

interface FormState {
  name: string;
  website: string;
  notes: string;
}

const EMPTY_FORM: FormState = { name: "", website: "", notes: "" };

function getDiff(a: SnapshotEntry | null, b: SnapshotEntry): string | null {
  if (!a) return null;
  const changes: string[] = [];
  if (a.title !== b.title) changes.push(`Title: "${a.title}" → "${b.title}"`);
  if (a.description !== b.description) changes.push("Description changed");
  return changes.length ? changes.join("; ") : null;
}

export default function CompetitorTrackerPage() {
  const supabase = createClient();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Competitor | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("competitors")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setCompetitors(data as Competitor[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditItem(null);
    setShowCreate(true);
  }

  function openEdit(c: Competitor) {
    setForm({ name: c.name, website: c.website || "", notes: c.notes || "" });
    setEditItem(c);
    setShowCreate(true);
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setSaving(false); return; }
    const payload = {
      name: form.name,
      website: form.website || null,
      notes: form.notes || null,
    };
    const { error } = editItem
      ? await supabase.from("competitors").update(payload).eq("id", editItem.id)
      : await supabase.from("competitors").insert({
          ...payload,
          user_id: user.id,
          social_urls: {},
          tracked_keywords: [],
          snapshot_history: [],
        });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editItem ? "Updated" : "Competitor added");
    setShowCreate(false);
    load();
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this competitor?")) return;
    await supabase.from("competitors").delete().eq("id", id);
    setCompetitors(prev => prev.filter(c => c.id !== id));
    toast.success("Deleted");
  }

  async function checkNow(c: Competitor) {
    if (!c.website) { toast.error("No website set"); return; }
    setChecking(c.id);
    try {
      // Fetch via a CORS proxy or direct — will work for same-origin servers;
      // for cross-origin we use the no-cors mode and extract what we can from opaque response.
      // We use a simple approach: fetch through our own API route equivalent via native fetch.
      const resp = await fetch(
        `/api/scrape?url=${encodeURIComponent(c.website)}`,
        { signal: AbortSignal.timeout(10000) }
      ).catch(() => null);

      let title: string | null = null;
      let description: string | null = null;

      if (resp && resp.ok) {
        const json = await resp.json().catch(() => null);
        if (json) { title = json.title || null; description = json.description || null; }
      } else {
        // Fallback: direct fetch (works if no CORS issue)
        const raw = await fetch(c.website, { signal: AbortSignal.timeout(8000) }).catch(() => null);
        if (raw) {
          const html = await raw.text().catch(() => "");
          title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || null;
          description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1]?.trim() || null;
        }
      }

      const snapshot: SnapshotEntry = { checked_at: new Date().toISOString(), title, description };
      const newHistory = [snapshot, ...(c.snapshot_history || [])].slice(0, 20);

      const { error } = await supabase
        .from("competitors")
        .update({ last_checked: new Date().toISOString(), snapshot_history: newHistory })
        .eq("id", c.id);

      if (error) throw error;

      const prev = c.snapshot_history?.[0] || null;
      const diff = getDiff(prev, snapshot);
      toast.success(diff ? `Changes detected: ${diff}` : "No changes detected");
      setCompetitors(prev_ =>
        prev_.map(x =>
          x.id === c.id
            ? { ...x, last_checked: snapshot.checked_at, snapshot_history: newHistory }
            : x
        )
      );
    } catch (err) {
      toast.error("Check failed — site may block automated requests");
    } finally {
      setChecking(null);
    }
  }

  function setF(key: keyof FormState, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function timeAgo(ts: string | null): string {
    if (!ts) return "Never";
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Competitor Tracker"
        subtitle="Monitor competitor homepages for changes and track their positioning."
        icon={<Crosshair size={22} />}
        gradient="purple"
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors border border-white/20"
          >
            <Plus size={15} /> Add Competitor
          </button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : competitors.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
          <Crosshair size={40} className="mx-auto mb-4 text-white/20" />
          <p className="text-white/60 mb-4">No competitors tracked yet.</p>
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-sm font-medium transition-colors"
          >
            <Plus size={14} className="inline mr-1" /> Add Competitor
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {competitors.map(c => {
            const latest = c.snapshot_history?.[0];
            const prev = c.snapshot_history?.[1] || null;
            const diff = latest ? getDiff(prev, latest) : null;
            return (
              <div
                key={c.id}
                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.08] p-4 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white">{c.name}</span>
                      {c.website && (
                        <a
                          href={c.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-white/40 hover:text-white/70 flex items-center gap-0.5"
                        >
                          <Globe size={11} /> {c.website.replace(/^https?:\/\//, "")}
                        </a>
                      )}
                    </div>
                    {c.notes && (
                      <p className="text-xs text-white/40 mb-1 truncate">{c.notes}</p>
                    )}
                    {latest && (
                      <p className="text-xs text-white/30 truncate">
                        Title: {latest.title || "—"}
                      </p>
                    )}
                    {diff && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-400">
                        <AlertCircle size={11} />
                        <span className="truncate">{diff}</span>
                      </div>
                    )}
                    {!diff && latest && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-white/30">
                        <CheckCircle size={11} />
                        No changes since last check
                      </div>
                    )}
                    <p className="text-xs text-white/20 mt-1">
                      Last checked: {timeAgo(c.last_checked)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => checkNow(c)}
                      disabled={checking === c.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs transition-colors disabled:opacity-50"
                    >
                      {checking === c.id ? (
                        <Loader size={12} className="animate-spin" />
                      ) : (
                        <RefreshCw size={12} />
                      )}
                      Check now
                    </button>
                    <button
                      onClick={() => openEdit(c)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => deleteItem(c.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title={editItem ? "Edit Competitor" : "Add Competitor"}
      >
        <div className="space-y-3">
          {(
            [
              { key: "name" as const, label: "Name *", placeholder: "Acme Corp" },
              { key: "website" as const, label: "Website", placeholder: "https://acme.com" },
              { key: "notes" as const, label: "Notes", placeholder: "Key differentiators…" },
            ] as const
          ).map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-white/50 mb-1">{label}</label>
              <input
                value={form[key]}
                onChange={e => setF(key, e.target.value)}
                placeholder={placeholder}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400/50"
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg border border-white/10 text-white/60 hover:text-white text-sm"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {saving && <Loader size={13} className="animate-spin" />}
              {editItem ? "Save" : "Add"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
