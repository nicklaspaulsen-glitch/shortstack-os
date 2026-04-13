"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ContentCalendarEntry, ContentScript } from "@/lib/types";
import StatusBadge from "@/components/ui/status-badge";
import { PageLoading } from "@/components/ui/loading";
import EmptyState from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { Film, Calendar, Download, CheckCircle, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";

export default function ClientContentPage() {
  const { profile } = useAuth();
  const [calendar, setCalendar] = useState<ContentCalendarEntry[]>([]);
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [loading, setLoading] = useState(true);
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

  if (loading) return <PageLoading />;

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
                {c.status === "ready_to_publish" && (
                  <div className="flex gap-1.5 pt-1 border-t border-border">
                    <button onClick={async () => {
                      await supabase.from("content_calendar").update({ status: "published" }).eq("id", c.id);
                      toast.success("Approved!");
                      fetchContent();
                    }} className="flex-1 text-[9px] py-1 rounded flex items-center justify-center gap-1 bg-success/10 text-success hover:bg-success/20 transition-colors">
                      <CheckCircle size={10} /> Approve
                    </button>
                    <button onClick={async () => {
                      const note = prompt("What changes do you need?");
                      if (!note) return;
                      await supabase.from("trinity_log").insert({
                        agent: "content",
                        action_type: "custom",
                        description: `Content revision: "${c.title}" — "${note}"`,
                        client_id: null,
                        status: "pending",
                        result: { type: "client_request", category: "revision", message: note },
                      });
                      toast.success("Revision request sent!");
                    }} className="flex-1 text-[9px] py-1 rounded flex items-center justify-center gap-1 bg-warning/10 text-warning hover:bg-warning/20 transition-colors">
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
    </div>
  );
}
