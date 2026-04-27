"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import {
  ArrowRight,
  Check,
  Clock,
  Filter,
  Loader,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────

interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  version: number;
  trigger_type: string;
  step_count: number;
  required_integrations: string[];
  vertical_tags?: string[];
  estimated_setup_minutes: number;
  installed: boolean;
  installed_workflow_id: string | null;
  installed_active: boolean | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Sales",
  onboarding: "Onboarding",
  retention: "Retention",
  recovery: "Recovery",
  social: "Social",
  support: "Support",
  marketing: "Marketing",
};

const CATEGORY_COLORS: Record<string, string> = {
  sales: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  onboarding: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  retention: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  recovery: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  social: "bg-pink-500/10 text-pink-300 border-pink-500/20",
  support: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  marketing: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
};

export default function WorkflowLibraryPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [installing, setInstalling] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/workflows/templates");
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as { templates: TemplateSummary[] };
      setTemplates(data.templates);
    } catch (err) {
      toast.error("Couldn't load templates");
      console.error("[workflow-library]", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let out = templates;
    if (category !== "all") {
      out = out.filter((t) => t.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q),
      );
    }
    return out;
  }, [templates, search, category]);

  async function install(templateId: string) {
    setInstalling(templateId);
    try {
      const res = await fetch("/api/workflows/templates/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: templateId }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        workflow_id?: string;
        error?: string;
      };
      if (!res.ok || !json.success) {
        toast.error(json.error || "Install failed");
        return;
      }
      toast.success("Template installed");
      await load();
    } catch (err) {
      toast.error("Install failed");
      console.error("[workflow-library]", err);
    } finally {
      setInstalling(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <PageHero
        title="Workflow Library"
        subtitle="Battle-tested automations you can install in one click"
        gradient="purple"
        icon={<Sparkles size={20} />}
      />

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-zinc-500" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
            >
              <option value="all">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <Link
            href="/dashboard/automations"
            className="ml-auto inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Back to automations <ArrowRight size={12} />
          </Link>
        </div>

        {/* Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-zinc-500">
            <Loader className="animate-spin" size={20} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-6 py-16 text-center text-zinc-500">
            No templates match your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <article
                key={t.id}
                className="group rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-zinc-700 hover:bg-zinc-900"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      CATEGORY_COLORS[t.category] ||
                      "bg-zinc-700/30 text-zinc-300 border-zinc-700"
                    }`}
                  >
                    {CATEGORY_LABELS[t.category] || t.category}
                  </span>
                  {t.installed && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                      <Check size={10} /> Installed
                    </span>
                  )}
                </div>

                <h3 className="mb-1.5 text-base font-semibold text-zinc-100">
                  {t.name}
                </h3>
                <p className="mb-4 text-sm text-zinc-400 leading-relaxed">
                  {t.description}
                </p>

                <div className="mb-4 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <Zap size={11} /> {t.step_count} steps
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} /> ~{t.estimated_setup_minutes} min setup
                  </span>
                </div>

                {t.required_integrations.length > 0 && (
                  <div className="mb-4 text-[11px] text-zinc-500">
                    <span className="text-zinc-600">Needs:</span>{" "}
                    {t.required_integrations.map((i) => (
                      <span
                        key={i}
                        className="ml-1 inline-flex rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300"
                      >
                        {i}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {t.installed ? (
                    <Link
                      href={`/dashboard/automations`}
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-center text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
                    >
                      Open
                    </Link>
                  ) : (
                    <button
                      onClick={() => install(t.id)}
                      disabled={installing === t.id}
                      className="flex-1 rounded-lg bg-amber-500/90 px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
                    >
                      {installing === t.id ? "Installing..." : "Install"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
