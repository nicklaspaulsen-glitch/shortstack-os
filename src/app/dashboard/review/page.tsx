"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileVideo, Plus, Filter } from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import EmptyState from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReviewSession, ReviewStatus } from "@/lib/review/types";

const STATUSES: (ReviewStatus | "all")[] = [
  "all",
  "pending",
  "in_review",
  "approved",
  "revisions_requested",
  "archived",
];

const STATUS_LABELS: Record<ReviewStatus | "all", string> = {
  all: "All",
  pending: "Pending",
  in_review: "In review",
  approved: "Approved",
  revisions_requested: "Revisions",
  archived: "Archived",
};

export default function ReviewListPage() {
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReviewStatus | "all">("all");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const q = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/review/sessions${q}`);
      if (res.ok) {
        const j = await res.json();
        setSessions(j.sessions ?? []);
      }
      setLoading(false);
    };
    run();
  }, [filter]);

  return (
    <div className="space-y-6">
      <PageHero
        title="Creative Review"
        subtitle="Share deliverables with clients for timestamped feedback and approval."
        icon={<FileVideo className="w-6 h-6" />}
        gradient="gold"
        actions={
          <Link
            href="/dashboard/review/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C9A84C] text-black font-semibold text-sm hover:bg-[#d4b559] transition"
          >
            <Plus className="w-4 h-4" /> New review
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-white/50" />
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs rounded-md border transition ${
              filter === s
                ? "bg-[#C9A84C] text-black border-[#C9A84C] font-semibold"
                : "bg-white/5 text-white/70 border-white/10 hover:border-white/30"
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No review sessions"
          description="Create a new review to share a deliverable with your client."
          action={
            <Link
              href="/dashboard/review/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C9A84C] text-black font-semibold text-sm"
            >
              <Plus className="w-4 h-4" /> New review
            </Link>
          }
        />
      ) : (
        <div className="grid gap-2">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/review/${s.id}`}
              className="block rounded-lg border border-white/10 bg-white/[0.02] p-4 hover:border-[#C9A84C]/40 transition"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-white truncate">{s.title}</h3>
                  <p className="text-xs text-white/50 mt-0.5">
                    {s.asset_type} · v{s.version} ·{" "}
                    {new Date(s.updated_at).toLocaleString()}
                  </p>
                </div>
                <StatusPill status={s.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: ReviewStatus }) {
  const cls: Record<ReviewStatus, string> = {
    pending: "bg-white/10 text-white/70",
    in_review: "bg-blue-500/20 text-blue-300",
    approved: "bg-green-500/20 text-green-300",
    revisions_requested: "bg-orange-500/20 text-orange-300",
    archived: "bg-white/5 text-white/40",
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded whitespace-nowrap ${cls[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
