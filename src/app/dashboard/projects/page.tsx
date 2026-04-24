"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Plus,
  Grid3x3,
  List,
  Search,
  Calendar,
  Loader2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import EmptyState from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

type Status = "draft" | "active" | "review" | "complete" | "archived";

interface Project {
  id: string;
  org_id: string | null;
  client_id: string | null;
  name: string;
  brief: string | null;
  deadline: string | null;
  status: Status;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientOption {
  id: string;
  name: string;
}

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  draft:     { label: "Draft",     color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  active:    { label: "Active",    color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  review:    { label: "Review",    color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  complete:  { label: "Complete",  color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  archived:  { label: "Archived",  color: "#4b5563", bg: "rgba(75,85,99,0.12)" },
};

const STATUS_ORDER: Status[] = ["draft", "active", "review", "complete", "archived"];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [deadlineFilter, setDeadlineFilter] = useState<"all" | "overdue" | "week" | "month">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchProjects();
    fetchClients();
  }, []);

  async function fetchProjects() {
    try {
      setLoading(true);
      const r = await fetch("/api/projects");
      if (!r.ok) throw new Error("Failed to load");
      const j = await r.json();
      setProjects(j.projects ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't load projects");
    } finally {
      setLoading(false);
    }
  }

  async function fetchClients() {
    try {
      const r = await fetch("/api/clients");
      if (!r.ok) return;
      const j = await r.json();
      const list: ClientOption[] = (j.clients ?? []).map((c: { id: string; name: string }) => ({
        id: c.id,
        name: c.name,
      }));
      setClients(list);
    } catch {
      // non-blocking
    }
  }

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (clientFilter && p.client_id !== clientFilter) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;

      if (deadlineFilter !== "all" && p.deadline) {
        const dl = new Date(p.deadline).getTime();
        const now = Date.now();
        const week = 7 * 24 * 60 * 60 * 1000;
        const month = 30 * 24 * 60 * 60 * 1000;
        if (deadlineFilter === "overdue" && dl >= now) return false;
        if (deadlineFilter === "week" && (dl < now || dl > now + week)) return false;
        if (deadlineFilter === "month" && (dl < now || dl > now + month)) return false;
      }
      return true;
    });
  }, [projects, statusFilter, clientFilter, deadlineFilter, search]);

  const clientName = (id: string | null) =>
    id ? clients.find((c) => c.id === id)?.name ?? "—" : "—";

  return (
    <div className="flex flex-col gap-6 fade-in">
      <PageHero
        title="Projects"
        subtitle="The central organizing unit for your creative production work."
        icon={<FolderKanban size={20} />}
        gradient="gold"
        eyebrow={<span>Creative OS</span>}
        actions={
          <Link
            href="/dashboard/projects/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-black hover:bg-[#D6B85E]"
          >
            <Plus size={16} /> New Project
          </Link>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:border-[#C9A84C]"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* status chips */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setStatusFilter("all")}
            className={`rounded-full px-3 py-1.5 text-xs border transition ${
              statusFilter === "all"
                ? "border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            All
          </button>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs border transition ${
                statusFilter === s
                  ? "border-current"
                  : "border-border text-muted hover:text-foreground"
              }`}
              style={statusFilter === s ? { color: STATUS_META[s].color, background: STATUS_META[s].bg } : undefined}
            >
              {STATUS_META[s].label}
            </button>
          ))}
        </div>

        {/* client filter */}
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* deadline filter */}
        <select
          value={deadlineFilter}
          onChange={(e) => setDeadlineFilter(e.target.value as typeof deadlineFilter)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
        >
          <option value="all">Any deadline</option>
          <option value="overdue">Overdue</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>

        {/* view toggle */}
        <div className="ml-auto flex items-center rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView("grid")}
            aria-label="Grid view"
            className={`p-2 ${view === "grid" ? "bg-[#C9A84C]/10 text-[#C9A84C]" : "text-muted"}`}
          >
            <Grid3x3 size={14} />
          </button>
          <button
            onClick={() => setView("list")}
            aria-label="List view"
            className={`p-2 ${view === "list" ? "bg-[#C9A84C]/10 text-[#C9A84C]" : "text-muted"}`}
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className={view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" : "flex flex-col gap-2"}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={36} />}
          title={projects.length === 0 ? "No projects yet" : "No projects match your filters"}
          description={projects.length === 0
            ? "Projects are the central unit of your creative production OS. Start your first one."
            : "Try adjusting filters or search."}
          action={projects.length === 0 ? (
            <Link
              href="/dashboard/projects/new"
              className="inline-flex items-center gap-2 rounded-lg bg-[#C9A84C] px-3 py-1.5 text-xs font-semibold text-black"
            >
              <Plus size={12} /> New Project
            </Link>
          ) : undefined}
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/projects/${p.id}`}
              className="group rounded-lg border border-border bg-card p-4 hover:border-[#C9A84C] transition"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-foreground group-hover:text-[#C9A84C] line-clamp-2">{p.name}</h3>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ color: STATUS_META[p.status].color, background: STATUS_META[p.status].bg }}
                >
                  {STATUS_META[p.status].label}
                </span>
              </div>
              {p.brief && (
                <p className="text-[11px] text-muted line-clamp-2 mb-3">{p.brief}</p>
              )}
              <div className="flex items-center justify-between text-[10px] text-muted">
                <span>{clientName(p.client_id)}</span>
                {p.deadline && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(p.deadline).toLocaleDateString()}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card text-[10px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Client</th>
                <th className="px-4 py-2 text-left">Deadline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-card/50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/projects/${p.id}`} className="font-medium hover:text-[#C9A84C]">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ color: STATUS_META[p.status].color, background: STATUS_META[p.status].bg }}
                    >
                      {STATUS_META[p.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{clientName(p.client_id)}</td>
                  <td className="px-4 py-3 text-muted">
                    {p.deadline ? new Date(p.deadline).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
