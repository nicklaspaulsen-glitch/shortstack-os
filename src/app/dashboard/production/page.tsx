"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/ui/modal";
import StatusBadge from "@/components/ui/status-badge";
import { formatRelativeTime } from "@/lib/utils";
import {
  Film, Upload, Send, FileText, Clock, CheckCircle,
  Sparkles, Loader, MessageSquare, ArrowRight, Camera
} from "lucide-react";
import toast from "react-hot-toast";

const EDIT_TYPES = [
  { id: "short_form", name: "Short Form Edit", desc: "Reels, TikToks, Shorts (30-60s)", icon: <Camera size={16} /> },
  { id: "long_form", name: "Long Form Edit", desc: "YouTube videos (5-30min)", icon: <Film size={16} /> },
  { id: "ad_creative", name: "Ad Creative", desc: "Paid ad video (15-30s)", icon: <Sparkles size={16} /> },
  { id: "podcast", name: "Podcast Edit", desc: "Audio/video podcast cleanup", icon: <MessageSquare size={16} /> },
];

interface ProductionRequest {
  id: string;
  description: string;
  status: string;
  created_at: string;
  result: {
    type: string;
    title: string;
    edit_type: string;
    notes: string;
    footage_url: string;
    deadline: string;
    client_name: string;
  };
}

export default function ProductionPage() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<ProductionRequest[]>([]);
  const [scripts, setScripts] = useState<Array<{ id: string; title: string; hook: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [form, setForm] = useState({
    script_id: "",
    title: "",
    edit_type: "short_form",
    notes: "",
    footage_url: "",
    deadline: "",
  });
  const supabase = createClient();

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  async function fetchData() {
    // Get client ID
    let cId: string | null = null;
    if (profile?.role === "client") {
      const { data } = await supabase.from("clients").select("id").eq("profile_id", profile.id).single();
      cId = data?.id || null;
    }
    setClientId(cId);

    // Get production requests
    let query = supabase.from("trinity_log").select("*").eq("action_type", "custom").order("created_at", { ascending: false });
    if (cId) query = query.eq("client_id", cId);
    const { data: reqs } = await query;
    setRequests((reqs || []).filter(r => (r.result as { type?: string })?.type === "production_request") as ProductionRequest[]);

    // Get scripts
    let scriptQuery = supabase.from("content_scripts").select("id, title, hook").order("created_at", { ascending: false }).limit(10);
    if (cId) scriptQuery = scriptQuery.eq("client_id", cId);
    const { data: sc } = await scriptQuery;
    setScripts(sc || []);

    setLoading(false);
  }

  async function submitRequest() {
    if (!form.title) { toast.error("Enter a title"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/production/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, client_id: clientId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Edit request submitted! Your editors have been notified on Slack.");
        setShowSubmit(false);
        setForm({ script_id: "", title: "", edit_type: "short_form", notes: "", footage_url: "", deadline: "" });
        fetchData();
      } else {
        toast.error(data.error || "Failed to submit");
      }
    } catch {
      toast.error("Connection error");
    }
    setSubmitting(false);
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader size={20} className="animate-spin text-gold" /></div>;

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Film size={18} className="text-gold" /> Content Production
          </h1>
          <p className="text-xs text-muted mt-0.5">Script it, record it, send to editors — all in one flow</p>
        </div>
        <button onClick={() => setShowSubmit(true)} className="btn-primary text-xs flex items-center gap-1.5">
          <Upload size={12} /> Submit Edit Request
        </button>
      </div>

      {/* How it works */}
      <div className="card border-gold/10">
        <h2 className="text-[10px] text-muted uppercase tracking-[0.15em] font-bold mb-3">How it works</h2>
        <div className="flex items-center gap-2">
          {[
            { step: "1", label: "Get Script", desc: "AI writes your script", icon: <FileText size={14} className="text-gold" /> },
            { step: "2", label: "Record", desc: "Film yourself doing the lines", icon: <Camera size={14} className="text-pink-400" /> },
            { step: "3", label: "Upload", desc: "Send footage + notes", icon: <Upload size={14} className="text-accent" /> },
            { step: "4", label: "Editors", desc: "Team notified on Slack", icon: <MessageSquare size={14} className="text-purple-400" /> },
            { step: "5", label: "Done", desc: "Get your edited video", icon: <CheckCircle size={14} className="text-success" /> },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className="text-center flex-1">
                <div className="w-8 h-8 bg-surface-light rounded-lg flex items-center justify-center mx-auto mb-1 border border-border/20">
                  {s.icon}
                </div>
                <p className="text-[9px] font-semibold">{s.label}</p>
                <p className="text-[8px] text-muted">{s.desc}</p>
              </div>
              {i < 4 && <ArrowRight size={10} className="text-muted/30 shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Active requests */}
      <div>
        <h2 className="section-header">Edit Requests</h2>
        {requests.length === 0 ? (
          <div className="card text-center py-8">
            <Film size={24} className="mx-auto mb-2 text-muted/30" />
            <p className="text-xs text-muted mb-2">No edit requests yet</p>
            <button onClick={() => setShowSubmit(true)} className="btn-primary text-xs">Submit Your First Request</button>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map(req => (
              <div key={req.id} className="card-hover p-3 flex items-center gap-3">
                <div className="w-9 h-9 bg-surface-light rounded-lg flex items-center justify-center shrink-0 border border-border/20">
                  <Film size={16} className="text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{req.result.title}</p>
                  <p className="text-[10px] text-muted">{req.result.edit_type?.replace(/_/g, " ")} · {req.result.client_name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={req.status === "in_progress" ? "pending" : req.status} />
                  <span className="text-[9px] text-muted font-mono">{formatRelativeTime(req.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available scripts */}
      {scripts.length > 0 && (
        <div>
          <h2 className="section-header">Your Scripts (ready to record)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {scripts.map(script => (
              <button key={script.id} onClick={() => {
                setForm({ ...form, script_id: script.id, title: script.title });
                setShowSubmit(true);
              }}
                className="card-hover p-3 text-left">
                <p className="text-xs font-medium truncate">{script.title}</p>
                {script.hook && <p className="text-[10px] text-muted truncate mt-0.5 italic">&ldquo;{script.hook}&rdquo;</p>}
                <p className="text-[9px] text-gold mt-1 flex items-center gap-1"><Camera size={9} /> Record this script</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Submit Modal */}
      <Modal isOpen={showSubmit} onClose={() => setShowSubmit(false)} title="Submit Edit Request" size="md">
        <div className="space-y-3">
          <div>
            <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Edit Type</label>
            <div className="grid grid-cols-2 gap-1.5">
              {EDIT_TYPES.map(t => (
                <button key={t.id} onClick={() => setForm({ ...form, edit_type: t.id })}
                  className={`p-2 rounded-lg border text-left transition-all ${form.edit_type === t.id ? "border-gold/30 bg-gold/[0.05]" : "border-border/20"}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gold">{t.icon}</span>
                    <span className="text-[10px] font-medium">{t.name}</span>
                  </div>
                  <p className="text-[8px] text-muted mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Title *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              className="input w-full text-xs" placeholder="e.g., Dental Tips Reel #5" />
          </div>

          <div>
            <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Footage Link</label>
            <input value={form.footage_url} onChange={e => setForm({ ...form, footage_url: e.target.value })}
              className="input w-full text-xs" placeholder="Google Drive, Dropbox, or WeTransfer link" />
          </div>

          <div>
            <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Notes for Editors</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="input w-full h-16 text-xs" placeholder="Any specific instructions, music preferences, style references..." />
          </div>

          <div>
            <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Deadline</label>
            <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}
              className="input w-full text-xs" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowSubmit(false)} className="btn-secondary text-xs">Cancel</button>
            <button onClick={submitRequest} disabled={submitting || !form.title}
              className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
              {submitting ? <Loader size={12} className="animate-spin" /> : <Send size={12} />}
              {submitting ? "Sending..." : "Submit to Editors"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
