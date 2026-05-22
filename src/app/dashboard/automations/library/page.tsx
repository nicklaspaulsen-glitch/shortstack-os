"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import toast from "react-hot-toast";
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
import { MotionPage } from "@/components/motion/motion-page";

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
  sales: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  onboarding: "bg-[rgba(212,255,0,0.08)] text-brand-accent border-[rgba(212,255,0,0.25)]",
  retention: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  recovery: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  social: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  support: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  marketing: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } } };

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
    <MotionPage className="min-h-screen">{/* -- Workflow Library command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">Templates &amp; Blueprints</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Workflow Library</h1>
      </div>
    </div><div className="mx-auto max-w-6xl">
              {/* Filters */}
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="w-full rounded-lg glass pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-accent focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-text-muted" />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="rounded-lg glass px-3 py-2 text-sm text-text-primary focus:border-brand-accent focus:outline-none"
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
                  className="ml-auto inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary"
                >
                  Back to automations <ArrowRight size={12} />
                </Link>
              </div>

              {/* Cards */}
              {loading ? (
                <div className="flex items-center justify-center py-24 text-text-muted">
                  <Loader className="animate-spin" size={20} />
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-xl border border-border-subtle bg-white/5 px-6 py-16 text-center text-text-muted">
                  No templates match your filters.
                </div>
              ) : (
                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((t) => (
                    <motion.article
                      key={t.id}
                      variants={itemVariants}
                      className="group glass rounded-xl p-5 transition hover:border-border-strong"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            CATEGORY_COLORS[t.category] ||
                            "bg-white/8 text-text-secondary border-white/15"
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

                      <h3 className="mb-1.5 text-base font-semibold text-text-primary">
                        {t.name}
                      </h3>
                      <p className="mb-4 text-sm text-text-muted leading-relaxed">
                        {t.description}
                      </p>

                      <div className="mb-4 flex flex-wrap gap-2 text-[11px] text-text-muted">
                        <span className="inline-flex items-center gap-1">
                          <Zap size={11} /> {t.step_count} steps
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} /> ~{t.estimated_setup_minutes} min setup
                        </span>
                      </div>

                      {t.required_integrations.length > 0 && (
                        <div className="mb-4 text-[11px] text-text-muted">
                          <span className="text-text-muted">Needs:</span>{" "}
                          {t.required_integrations.map((i) => (
                            <span
                              key={i}
                              className="ml-1 inline-flex rounded bg-white/8 px-1.5 py-0.5 font-mono text-[10px] text-text-secondary"
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
                            className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-center text-xs font-semibold text-text-secondary hover:bg-white/8"
                          >
                            Open
                          </Link>
                        ) : (
                          <button
                            onClick={() => install(t.id)}
                            disabled={installing === t.id}
                            className="flex-1 rounded-full bg-brand-accent px-3 py-2 text-xs font-semibold text-[#0D1120] transition hover:bg-brand-accent/80 disabled:opacity-60"
                          >
                            {installing === t.id ? "Installing..." : "Install"}
                          </button>
                        )}
                      </div>
                    </motion.article>
                  ))}
                </motion.div>
              )}
            </div></MotionPage>
  );
}
