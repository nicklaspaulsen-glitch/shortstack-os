"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ContentCalendarEntry, ContentScript } from "@/lib/types";
import StatusBadge from "@/components/ui/status-badge";
import { PageLoading } from "@/components/ui/loading";
import EmptyState from "@/components/ui/empty-state";
import Modal from "@/components/ui/modal";
import { formatDate } from "@/lib/utils";
import { Film, Calendar, Download, CheckCircle, MessageSquare, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

type RevisionMode = "request" | "changes";

interface RevisionTarget {
  contentId: string;
  contentTitle: string;
  mode: RevisionMode;
}

export default function ClientContentPage() {
  const { profile } = useAuth();
  const [calendar, setCalendar] = useState<ContentCalendarEntry[]>([]);
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [revisionTarget, setRevisionTarget] = useState<RevisionTarget | null>(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [revisionUrgent, setRevisionUrgent] = useState(false);
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (profile) fetchContent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function fetchContent() {
    if (!profile?.id) { setLoading(false); return; }
    try {
      const { data: clientData, error: clientError } = await supabase.from("clients").select("id").eq("profile_id", profile.id).single();
      if (clientError && clientError.code !== "PGRST116") throw clientError;
      if (!clientData) { setLoading(false); return; }

      const [{ data: cal }, { data: sc }] = await Promise.all([
        supabase.from("content_calendar").select("*").eq("client_id", clientData.id).order("scheduled_at", { ascending: false }),
        supabase.from("content_scripts").select("*").eq("client_id", clientData.id).order("created_at", { ascending: false }),
      ]);
      setCalendar(cal || []);
      setScripts(sc || []);
    } catch {
      toast.error("Failed to load content data");
    } finally {
      setLoading(false);
    }
  }

  function openRevisionModal(contentId: string, contentTitle: string, mode: RevisionMode) {
    setRevisionTarget({ contentId, contentTitle, mode });
    setRevisionNote("");
    setRevisionUrgent(false);
  }

  function closeRevisionModal() {
    setRevisionTarget(null);
    setRevisionNote("");
    setRevisionUrgent(false);
  }

  async function submitRevision() {
    if (!revisionTarget) return;
    const note = revisionNote.trim();
    if (!note) {
      toast.error("Please describe what needs to change");
      return;
    }
    setSubmittingRevision(true);
    try {
      const res = await fetch("/api/portal/revisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_item_id: revisionTarget.contentId,
          revision_notes: note,
          priority: revisionUrgent ? "urgent" : "normal",
        }),
      });
      if (res.ok) {
        toast.success("Revision request sent!");
        closeRevisionModal();
        fetchContent();
      } else {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Failed to send revision");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmittingRevision(false);
    }
  }

  if (loading) return <PageLoading />;

  const modalTitle = revisionTarget?.mode === "request"
    ? `Request a revision on "${revisionTarget.contentTitle}"`
    : "Request changes";
  const modalDescription = revisionTarget?.mode === "request"
    ? "Tell us what needs to change. We'll get on it and re-publish once ready."
    : "Describe the changes you'd like before this gets published.";

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2"><Film size={18} className="text-gold" /> Your Content</h1>
        <p className="text-xs text-muted mt-0.5">All content created and scheduled for your brand</p>
      </div>

      {/* Content Calendar */}
      <div className="card">
        <h2 className="section-header flex items-center gap-2"><Calendar size={13} className="text-gold" /> Content Calendar</h2>
        {calendar.length === 0 ? (
          <EmptyState icon={<Calendar size={32} />} title="No Content Scheduled" description="Your content calendar is empty. We&apos;ll start populating it soon." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {calendar.map((c) => (
              <div key={c.id} className="bg-surface-light border border-border rounded-lg p-3 hover:border-gold/15 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-muted capitalize font-medium">{c.platform.replace(/_/g, " ")}</span>
                  <StatusBadge status={c.status} />
                </div>
                <p className="text-xs font-medium mb-1">{c.title}</p>
                {c.scheduled_at && <p className="text-[9px] text-muted mb-2">{formatDate(c.scheduled_at)}</p>}
                {(c.status === "published" || c.status === "approved_for_publish") && (
                  <button
                    onClick={() => openRevisionModal(c.id, c.title, "request")}
                    className="w-full text-[9px] py-1 rounded flex items-center justify-center gap-1 bg-warning/10 text-warning hover:bg-warning/20 transition-colors mt-1"
                  >
                    <MessageSquare size={10} /> Request revision
                  </button>
                )}
                {c.status === "ready_to_publish" && (
                  <div className="flex gap-1.5 pt-1 border-t border-border">
                    <button onClick={async () => {
                      await supabase.from("content_calendar").update({ status: "published" }).eq("id", c.id);
                      toast.success("Approved!");
                      fetchContent();
                    }} className="flex-1 text-[9px] py-1 rounded flex items-center justify-center gap-1 bg-success/10 text-success hover:bg-success/20 transition-colors">
                      <CheckCircle size={10} /> Approve
                    </button>
                    <button
                      onClick={() => openRevisionModal(c.id, c.title, "changes")}
                      className="flex-1 text-[9px] py-1 rounded flex items-center justify-center gap-1 bg-warning/10 text-warning hover:bg-warning/20 transition-colors"
                    >
                      <MessageSquare size={10} /> Changes
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scripts */}
      {scripts.length > 0 && (
        <div className="card">
          <h2 className="section-header">Content Scripts</h2>
          <div className="space-y-2">
            {scripts.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-xs font-medium">{s.title}</p>
                  <p className="text-[10px] text-muted capitalize">{s.script_type?.replace(/_/g, " ")} · {s.target_platform?.replace(/_/g, " ")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={s.status} />
                  <button onClick={async () => {
                    const res = await fetch(`/api/content/pdf?id=${s.id}`);
                    if (res.ok) { const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${s.title}.pdf`; a.click(); }
                  }} className="text-gold hover:text-gold-light"><Download size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revision modal — replaces window.prompt + window.confirm */}
      <Modal
        isOpen={revisionTarget !== null}
        onClose={() => {
          if (!submittingRevision) closeRevisionModal();
        }}
        title={modalTitle}
        size="md"
      >
        <p className="text-xs text-muted mb-4">{modalDescription}</p>
        <label className="block text-[11px] font-medium text-muted mb-1.5">
          What needs to change?
        </label>
        <textarea
          value={revisionNote}
          onChange={(e) => setRevisionNote(e.target.value)}
          placeholder="e.g. Replace the headline, tighten the script, swap the CTA..."
          rows={5}
          autoFocus
          disabled={submittingRevision}
          className="w-full text-xs border border-border/60 bg-surface-light/40 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:border-gold/60"
        />
        <label className="mt-4 flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={revisionUrgent}
            onChange={(e) => setRevisionUrgent(e.target.checked)}
            disabled={submittingRevision}
            className="h-3.5 w-3.5 rounded border-border/60 bg-surface-light/40 accent-warning"
          />
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-warning" />
            Mark this as urgent
          </span>
        </label>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={closeRevisionModal}
            disabled={submittingRevision}
            className="text-xs px-4 py-2 rounded-lg text-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submitRevision}
            disabled={submittingRevision || !revisionNote.trim()}
            className="text-xs px-4 py-2 rounded-lg bg-gold text-black font-semibold hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            <MessageSquare size={12} />
            {submittingRevision ? "Sending..." : "Send revision"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
