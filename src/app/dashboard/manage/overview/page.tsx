"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Briefcase,
  AlertTriangle,
  Clock,
  FileText,
  ArrowRight,
  Loader2,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import EmptyState from "@/components/ui/empty-state";

interface OverviewRow {
  id: string;
  name: string;
  deadline: string | null;
  health_status: "red" | "yellow" | "green" | null;
  health_generated_at: string | null;
  open_scope_flags: number;
  overdue_tasks: number;
  last_report_status: "draft" | "sent" | "skipped" | null;
}

const HEALTH_META: Record<"red" | "yellow" | "green", { label: string; color: string; bg: string }> = {
  red:    { label: "At risk",    color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  yellow: { label: "Watch",      color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  green:  { label: "On track",   color: "#10b981", bg: "rgba(16,185,129,0.15)" },
};

export default function ManageOverviewPage() {
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const r = await fetch("/api/manage/overview");
      if (!r.ok) throw new Error("Failed");
      const j = await r.json();
      setRows(j.projects ?? []);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't load manage overview");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHero
        title="Manage"
        subtitle="Command center for every active project — health, scope, tasks, reports."
        icon={<Briefcase size={22} />}
        gradient="gold"
        eyebrow="Operations"
      />

      {loading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-neutral-400">
          <Loader2 className="animate-spin" size={16} /> Loading projects…
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon={<Briefcase size={24} />}
            title="No active projects yet"
            description="Spin up a project in the Projects tab to see it here."
            action={
              <Link
                href="/dashboard/projects"
                className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
              >
                Go to Projects
              </Link>
            }
          />
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const healthMeta = row.health_status ? HEALTH_META[row.health_status] : null;
            return (
              <Link
                key={row.id}
                href={`/dashboard/manage/${row.id}`}
                className="group rounded-xl border border-white/10 bg-neutral-900/50 p-5 transition hover:border-white/20 hover:bg-neutral-900/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-white">{row.name}</h3>
                    {row.deadline && (
                      <p className="mt-1 text-xs text-neutral-400">
                        Due {new Date(row.deadline).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {healthMeta ? (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ color: healthMeta.color, background: healthMeta.bg }}
                    >
                      {healthMeta.label}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-xs text-neutral-400">
                      No snapshot
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-white/5 p-2">
                    <div className="flex items-center gap-1 text-neutral-400">
                      <AlertTriangle size={12} />
                      Scope
                    </div>
                    <div className="mt-1 font-semibold text-white">{row.open_scope_flags}</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <div className="flex items-center gap-1 text-neutral-400">
                      <Clock size={12} />
                      Overdue
                    </div>
                    <div className="mt-1 font-semibold text-white">{row.overdue_tasks}</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <div className="flex items-center gap-1 text-neutral-400">
                      <FileText size={12} />
                      Report
                    </div>
                    <div className="mt-1 font-semibold text-white capitalize">
                      {row.last_report_status ?? "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end text-xs text-neutral-400 group-hover:text-white">
                  Manage <ArrowRight size={12} className="ml-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
