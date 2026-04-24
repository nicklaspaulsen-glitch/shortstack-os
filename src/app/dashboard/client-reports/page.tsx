"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  ClipboardList, Download, Mail, FileText,
  Calendar, CheckCircle, Clock, AlertCircle
} from "lucide-react";

interface GeneratedReport {
  id: string;
  user_id: string;
  client_id: string | null;
  metrics: string[] | null;
  date_from: string | null;
  date_to: string | null;
  pdf_url: string | null;
  pdf_size_bytes: number | null;
  created_at: string;
}

interface ClientRow {
  client_id: string | null;
  client_name: string;
  reports: GeneratedReport[];
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(d));
}

function fmtBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function groupByClient(reports: GeneratedReport[]): ClientRow[] {
  const map = new Map<string, ClientRow>();
  for (const r of reports) {
    const key = r.client_id || "__none__";
    if (!map.has(key)) {
      map.set(key, {
        client_id: r.client_id,
        client_name: r.client_id ? `Client ${r.client_id.slice(0, 8)}` : "No Client",
        reports: [],
      });
    }
    map.get(key)!.reports.push(r);
  }
  return Array.from(map.values());
}

export default function ClientReportsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [resending, setResending] = useState<string | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("generated_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        // If table doesn't exist, show friendly empty state
        if (error.code === "42P01") {
          setTableExists(false);
        }
        setLoading(false);
        return;
      }
      if (data) {
        setRows(groupByClient(data as GeneratedReport[]));
      }
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resendEmail(reportId: string) {
    setResending(reportId);
    // Trigger resend via API route if available
    try {
      const resp = await fetch(`/api/reports/${reportId}/resend`, { method: "POST" });
      if (resp.ok) {
        toast.success("Report email resent");
      } else {
        toast.error("Could not resend — check API route");
      }
    } catch {
      toast.error("Resend failed");
    } finally {
      setResending(null);
    }
  }

  function downloadReport(url: string, filename: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (!tableExists) {
    return (
      <div className="space-y-6">
        <PageHero
          title="Client Reports"
          subtitle="View and resend generated PDF reports for each client."
          icon={<ClipboardList size={22} />}
          gradient="purple"
        />
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
          <FileText size={40} className="mx-auto mb-4 text-white/20" />
          <p className="text-white/60 mb-2">No reports generated yet.</p>
          <p className="text-white/40 text-sm mb-6">
            Generate your first report using the Report Generator.
          </p>
          <Link
            href="/dashboard/report-generator"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-sm font-medium transition-colors"
          >
            Go to Report Generator
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Client Reports"
        subtitle="View and resend generated PDF reports for each client."
        icon={<ClipboardList size={22} />}
        gradient="purple"
        actions={
          <Link
            href="/dashboard/report-generator"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors border border-white/20"
          >
            <FileText size={14} /> Generate Report
          </Link>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
          <ClipboardList size={40} className="mx-auto mb-4 text-white/20" />
          <p className="text-white/60 mb-2">No reports yet.</p>
          <Link
            href="/dashboard/report-generator"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-sm font-medium transition-colors"
          >
            Generate your first report
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map(row => {
            const isExpanded = expandedClient === row.client_id;
            return (
              <div
                key={row.client_id || "__none__"}
                className="rounded-xl border border-white/10 bg-white/5 overflow-hidden"
              >
                {/* Client header */}
                <button
                  onClick={() =>
                    setExpandedClient(isExpanded ? null : row.client_id)
                  }
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                      <FileText size={14} className="text-purple-300" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-white text-sm">{row.client_name}</p>
                      <p className="text-xs text-white/40">
                        {row.reports.length} report{row.reports.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-white/30 text-xs">
                    {isExpanded ? "Hide" : "Show"}
                  </span>
                </button>

                {/* Reports list */}
                {isExpanded && (
                  <div className="border-t border-white/10 divide-y divide-white/5">
                    {row.reports.map(r => (
                      <div
                        key={r.id}
                        className="flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            {r.pdf_url ? (
                              <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                            ) : (
                              <Clock size={12} className="text-yellow-400 shrink-0" />
                            )}
                            <span className="text-sm text-white truncate">
                              {fmtDate(r.date_from)} – {fmtDate(r.date_to)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-white/30">
                            <span className="flex items-center gap-1">
                              <Calendar size={10} /> Generated {fmtDate(r.created_at)}
                            </span>
                            {r.pdf_size_bytes && (
                              <span>{fmtBytes(r.pdf_size_bytes)}</span>
                            )}
                            {r.metrics && r.metrics.length > 0 && (
                              <span>{r.metrics.slice(0, 3).join(", ")}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.pdf_url && (
                            <button
                              onClick={() =>
                                downloadReport(r.pdf_url!, `report-${r.id.slice(0, 8)}.pdf`)
                              }
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs transition-colors"
                            >
                              <Download size={11} /> Download
                            </button>
                          )}
                          <button
                            onClick={() => resendEmail(r.id)}
                            disabled={resending === r.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs transition-colors disabled:opacity-50"
                          >
                            <Mail size={11} />
                            {resending === r.id ? "Sending…" : "Resend"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
