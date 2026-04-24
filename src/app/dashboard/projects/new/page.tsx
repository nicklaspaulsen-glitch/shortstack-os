"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FolderKanban, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";

type Status = "draft" | "active" | "review" | "complete" | "archived";

interface ClientOption {
  id: string;
  name: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<Status>("draft");
  const [clientId, setClientId] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/clients");
        if (!r.ok) return;
        const j = await r.json();
        setClients((j.clients ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      } catch {
        // non-blocking
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          brief: brief.trim() || null,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          status,
          client_id: clientId || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to create");
      toast.success("Project created");
      router.push(`/dashboard/projects/${j.project.id}`);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to create project";
      toast.error(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 fade-in">
      <PageHero
        title="New Project"
        subtitle="Create a project to anchor your next piece of work — briefs, team, assets, and timeline all in one place."
        icon={<FolderKanban size={20} />}
        gradient="gold"
        eyebrow={
          <Link href="/dashboard/projects" className="inline-flex items-center gap-1 hover:text-[#C9A84C]">
            <ArrowLeft size={12} /> Back to projects
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-2xl flex flex-col gap-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Project name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q2 Launch Campaign"
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#C9A84C]"
          />
        </div>

        {/* Brief */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Brief</label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="What needs to be produced? Goals, constraints, tone..."
            rows={5}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#C9A84C]"
          />
        </div>

        {/* Row: client + deadline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">— No client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="review">Review</option>
            <option value="complete">Complete</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-black hover:bg-[#D6B85E] disabled:opacity-50"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Create project
          </button>
          <Link
            href="/dashboard/projects"
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
