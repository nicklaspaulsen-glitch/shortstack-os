"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  ClipboardList, Download, Mail, FileText,
  Calendar, CheckCircle, Clock, AlertCircle
} from "lucide-react";
import { MotionPage } from "@/components/motion/motion-page";

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
      <MotionPage className="space-y-6">{/* -- Client Reports command strip -- */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0">
          <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">CLIENT REPORTS</p>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Client Reports</h1>
        </div>
      </div><motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-12 text-center">
                  <FileText size={40} className="mx-auto mb-4 text-[#9CA3AF]" />
                  <p className="text-[#6B7280] mb-2">No reports generated yet.</p>
                  <p className="text-[#9CA3AF] text-sm mb-6">
                    Generate your first report using the Report Generator.
                  </p>
                  <Link
                    href="/dashboard/report-generator"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgba(37,99,235,0.08)] hover:bg-[rgba(37,99,235,0.14)] text-[#2563EB] text-sm font-medium transition-colors"
                  >
                    Go to Report Generator
                  </Link>
                </motion.div></MotionPage>
    );
  }

  return (
    <div className="space-y-6">
      {/* -- Client Reports command strip -- */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0">
          <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">CLIENT REPORTS</p>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Client Reports</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard/report-generator"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgba(0,0,0,0.06)] hover:bg-[rgba(0,0,0,0.08)] text-white text-sm font-medium transition-colors border border-border"
          >
            <FileText size={14} /> Generate Report
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="h-24 glass rounded-xl animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-12 text-center">
          <ClipboardList size={40} className="mx-auto mb-4 text-[#9CA3AF]" />
          <p className="text-[#6B7280] mb-2">No reports yet.</p>
          <Link
            href="/dashboard/report-generator"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgba(37,99,235,0.08)] hover:bg-[rgba(37,99,235,0.14)] text-[#2563EB] text-sm font-medium transition-colors"
          >
            Generate your first report
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {rows.map((row, i) => {
            const isExpanded = expandedClient === row.client_id;
            return (
              <motion.div
                key={row.client_id || "__none__"}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4, scale: 1.01 }}
                className="glass rounded-xl overflow-hidden"
              >
                {/* Client header */}
                <button
                  onClick={() =>
                    setExpandedClient(isExpanded ? null : row.client_id)
                  }
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-[rgba(0,0,0,0.03)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[rgba(37,99,235,0.08)] border border-[rgba(37,99,235,0.25)] flex items-center justify-center">
                      <FileText size={14} className="text-[#2563EB]" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-[#111827] text-sm">{row.client_name}</p>
                      <p className="text-xs text-[#9CA3AF]">
                        {row.reports.length} report{row.reports.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-[#9CA3AF] text-xs">
                    {isExpanded ? "Hide" : "Show"}
                  </span>
                </button>

                {/* Reports list */}
                {isExpanded && (
                  <div className="border-t border-[rgba(0,0,0,0.08)] divide-y divide-[rgba(0,0,0,0.06)]">
                    {row.reports.map(r => (
                      <div
                        key={r.id}
                        className="flex items-center gap-4 px-5 py-3 hover:bg-[rgba(0,0,0,0.03)] transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            {r.pdf_url ? (
                              <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                            ) : (
                              <Clock size={12} className="text-yellow-400 shrink-0" />
                            )}
                            <span className="text-sm text-[#111827] truncate">
                              {fmtDate(r.date_from)} – {fmtDate(r.date_to)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#9CA3AF]">
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
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[rgba(0,0,0,0.06)] hover:bg-[rgba(0,0,0,0.08)] text-[#6B7280] hover:text-[#374151] text-xs transition-colors"
                            >
                              <Download size={11} /> Download
                            </button>
                          )}
                          <button
                            onClick={() => resendEmail(r.id)}
                            disabled={resending === r.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[rgba(37,99,235,0.08)] hover:bg-[rgba(37,99,235,0.14)] text-[#2563EB] text-xs transition-colors disabled:opacity-50"
                          >
                            <Mail size={11} />
                            {resending === r.id ? "Sending…" : "Resend"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
