"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import type { GeneratedCaseStudyDraft } from "@/lib/showcase/types";

export default function NewShowcasePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [clientName, setClientName] = useState("");
  const [draft, setDraft] = useState<GeneratedCaseStudyDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function generate() {
    if (!projectId.trim()) {
      toast.error("Enter a project ID to generate from");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/showcase/generate-from-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Generation failed");
      setDraft(json.draft);
      if (!title) setTitle(json.draft.title);
      if (!subtitle) setSubtitle(json.draft.subtitle);
      toast.success("Draft generated — review and save");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        client_name: clientName.trim() || null,
        project_id: projectId.trim() || null,
      };
      if (draft) {
        body.summary = draft.summary;
        body.body_markdown = draft.body_markdown;
        body.metrics = draft.metrics;
        body.industry_tags = draft.industry_tags;
        body.service_tags = draft.service_tags;
        body.seo_title = draft.seo_title;
        body.seo_description = draft.seo_description;
      }
      const res = await fetch("/api/showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      toast.success("Case study created");
      router.push(`/dashboard/showcase/${json.case_study.id}/edit`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHero
        title="New case study"
        subtitle="Start from scratch or generate a draft from an existing project."
        icon={<Sparkles className="w-6 h-6" />}
      />

      <div className="space-y-5">
        <div>
          <label className="block text-xs font-medium mb-1">Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="How we 3x'd conversion for Acme Corp"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Subtitle</label>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="One-line hook visible on the hero"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Client name</label>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Acme Corp"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
          />
        </div>

        <div className="p-4 rounded-xl border border-white/10 bg-white/5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <div className="text-sm font-semibold flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-primary" /> Generate draft from project
              </div>
              <p className="text-xs text-white/60">Paste a project id. AI will draft title, summary, body, metrics, and tags.</p>
            </div>
            <button
              onClick={generate}
              disabled={generating || !projectId.trim()}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-black text-xs font-semibold disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {generating ? "Generating..." : "Generate"}
            </button>
          </div>
          <input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="Project / board id (uuid)"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-mono"
          />

          {draft && (
            <div className="mt-3 text-xs text-white/80 space-y-1">
              <div><span className="text-white/50">Summary:</span> {draft.summary}</div>
              <div><span className="text-white/50">Metrics:</span> {draft.metrics.length} · <span className="text-white/50">Tags:</span> {draft.industry_tags.length + draft.service_tags.length}</div>
              <p className="text-emerald-300">Draft ready — click Create to save.</p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving || !title.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-black text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create case study
          </button>
          <button
            onClick={() => router.push("/dashboard/showcase")}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
