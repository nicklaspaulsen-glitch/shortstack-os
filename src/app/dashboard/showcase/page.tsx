"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Plus, Eye, Pencil, Trash2, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import EmptyState from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { CaseStudy } from "@/lib/showcase/types";

type CaseStudyWithViews = CaseStudy & { view_count: number };

export default function ShowcaseListPage() {
  const [items, setItems] = useState<CaseStudyWithViews[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
  const [industry, setIndustry] = useState<string>("");
  const [service, setService] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (industry) params.set("industry", industry);
      if (service) params.set("service", service);
      const res = await fetch(`/api/showcase?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setItems(json.case_studies || []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status, industry, service]);

  const { industries, services } = useMemo(() => {
    const i = new Set<string>();
    const s = new Set<string>();
    for (const c of items) {
      for (const t of c.industry_tags || []) i.add(t);
      for (const t of c.service_tags || []) s.add(t);
    }
    return { industries: Array.from(i).sort(), services: Array.from(s).sort() };
  }, [items]);

  async function remove(id: string) {
    if (!confirm("Delete this case study? This cannot be undone.")) return;
    const res = await fetch(`/api/showcase/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Delete failed");
      return;
    }
    toast.success("Deleted");
    load();
  }

  async function togglePublish(cs: CaseStudyWithViews) {
    const path = cs.published ? "unpublish" : "publish";
    const res = await fetch(`/api/showcase/${cs.id}/${path}`, { method: "POST" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Failed");
      return;
    }
    toast.success(cs.published ? "Unpublished" : "Published");
    load();
  }

  return (
    <div>
      <PageHero
        title="Showcase"
        subtitle="Public case studies that tell the story of your best work."
        icon={<Sparkles className="w-6 h-6" />}
        actions={
          <Link
            href="/dashboard/showcase/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-black text-sm font-semibold hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> New case study
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "all" | "draft" | "published")}
          className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10"
        >
          <option value="all">All statuses</option>
          <option value="draft">Drafts</option>
          <option value="published">Published</option>
        </select>
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10"
        >
          <option value="">All industries</option>
          {industries.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={service}
          onChange={(e) => setService(e.target.value)}
          className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10"
        >
          <option value="">All services</option>
          {services.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((k) => <Skeleton key={k} className="h-48" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="w-10 h-10" />}
          title="No case studies yet"
          description="Turn a finished project into a polished public page. Let AI draft it for you."
          action={
            <Link href="/dashboard/showcase/new" className="text-xs text-primary underline">
              Create your first case study
            </Link>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((cs) => (
            <div key={cs.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden flex flex-col">
              {cs.hero_image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={cs.hero_image_url} alt="" className="w-full aspect-video object-cover" />
              ) : (
                <div className="w-full aspect-video bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center text-white/30">
                  <Sparkles className="w-8 h-8" />
                </div>
              )}
              <div className="p-4 flex flex-col gap-2 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{cs.title}</h3>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${cs.published ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-white/70"}`}>
                    {cs.published ? "Live" : "Draft"}
                  </span>
                </div>
                {cs.subtitle && <p className="text-xs text-white/60 line-clamp-2">{cs.subtitle}</p>}
                <div className="flex items-center gap-3 text-[11px] text-white/50 mt-auto pt-2">
                  <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{cs.view_count} views</span>
                  {cs.client_name && <span>{cs.client_name}</span>}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                  <Link
                    href={`/dashboard/showcase/${cs.id}/edit`}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </Link>
                  <button
                    onClick={() => togglePublish(cs)}
                    className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15"
                  >
                    {cs.published ? "Unpublish" : "Publish"}
                  </button>
                  {cs.published && (
                    <Link
                      href={`/showcase/${cs.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15"
                    >
                      <ExternalLink className="w-3 h-3" /> View
                    </Link>
                  )}
                  <button
                    onClick={() => remove(cs.id)}
                    className="ml-auto text-white/50 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
