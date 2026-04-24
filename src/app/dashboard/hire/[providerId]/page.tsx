"use client";

/**
 * Provider detail — full profile, portfolio, reviews, and the quote-request
 * modal. Accessed from the directory (/dashboard/hire).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Star,
  Clock,
  ExternalLink,
  Send,
  Briefcase,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import Modal from "@/components/ui/modal";
import {
  PRO_SERVICE_CATEGORIES,
  type ProProvider,
  type ProReview,
  type ProServiceCategory,
  categoryLabel,
  fmtPrice,
  isValidCategory,
} from "@/lib/pro-services";

interface DetailResponse {
  provider: ProProvider;
  reviews: ProReview[];
  stats: {
    completed_count: number;
    review_count: number;
    avg_rating: number | null;
  };
}

export default function ProviderDetailPage() {
  const params = useParams<{ providerId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillCategory = searchParams?.get("category") ?? null;
  const prefillTitle = searchParams?.get("title") ?? null;

  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!params?.providerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pro-services/providers/${params.providerId}`);
      if (!res.ok) throw new Error(`detail ${res.status}`);
      const json = (await res.json()) as DetailResponse;
      setData(json);
    } catch (err) {
      console.error("[hire/detail] failed:", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [params?.providerId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-open the modal if deep-linked with `?open=quote` (from AI-page
  // Prefer-a-human link)
  useEffect(() => {
    if (searchParams?.get("open") === "quote" && data?.provider.vetted) {
      setModalOpen(true);
    }
  }, [searchParams, data?.provider.vetted]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-xs text-muted">
        <Loader2 size={14} className="animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-3">
        <p className="text-sm font-semibold text-foreground">Provider not found</p>
        <button
          onClick={() => router.push("/dashboard/hire")}
          className="text-xs text-muted hover:text-foreground"
        >
          Back to directory
        </button>
      </div>
    );
  }

  const { provider, reviews, stats } = data;

  return (
    <div className="fade-in max-w-4xl mx-auto space-y-6">
      <Link
        href="/dashboard/hire"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
      >
        <ArrowLeft size={12} /> Back to directory
      </Link>

      {/* Header */}
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div
            className="w-20 h-20 rounded-full bg-surface-light border border-border flex items-center justify-center overflow-hidden shrink-0"
          >
            {provider.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={provider.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-muted">
                {provider.name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-foreground">{provider.name}</h1>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {provider.categories.map((c) => (
                <span
                  key={c}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-light text-foreground border border-border"
                >
                  {categoryLabel(c)}
                </span>
              ))}
            </div>
            {provider.timezone && (
              <p className="text-[11px] text-muted mt-2">{provider.timezone}</p>
            )}
          </div>

          <button
            onClick={() => setModalOpen(true)}
            disabled={!provider.vetted}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold disabled:opacity-50"
          >
            <Send size={13} /> Request quote
          </button>
        </div>

        {provider.bio && (
          <p className="text-sm text-foreground/80 mt-5 whitespace-pre-wrap leading-relaxed">
            {provider.bio}
          </p>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-border">
          <StatBox label="Starting price" value={fmtPrice(provider.starting_price_cents)} />
          <StatBox label="Turnaround" value={`${provider.turnaround_days} days`} />
          <StatBox
            label="Completed"
            value={`${stats.completed_count} projects`}
          />
        </div>
      </section>

      {/* Portfolio */}
      {provider.portfolio_urls.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Briefcase size={14} className="text-muted" /> Portfolio
          </h2>
          <div className="flex flex-col gap-2">
            {provider.portfolio_urls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface-light border border-border hover:border-foreground/20 text-xs text-foreground group"
              >
                <span className="truncate">{url}</span>
                <ExternalLink size={12} className="text-muted group-hover:text-foreground shrink-0" />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Star size={14} className="text-amber-400" fill="currentColor" /> Reviews
          {stats.avg_rating != null && (
            <span className="text-xs font-normal text-muted">
              · {stats.avg_rating.toFixed(1)} average · {stats.review_count} total
            </span>
          )}
        </h2>
        {reviews.length === 0 ? (
          <p className="text-xs text-muted">No reviews yet. Be first to work with {provider.name}!</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl bg-surface-light border border-border p-3">
                <div className="flex items-center gap-1 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={12}
                      className={i < r.rating ? "text-amber-400" : "text-border"}
                      fill={i < r.rating ? "currentColor" : "none"}
                    />
                  ))}
                </div>
                {r.review_text && (
                  <p className="text-xs text-foreground/80 whitespace-pre-wrap">{r.review_text}</p>
                )}
                <p className="text-[10px] text-muted mt-1">
                  {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <QuoteRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        provider={provider}
        initialCategory={
          prefillCategory && isValidCategory(prefillCategory)
            ? (prefillCategory as ProServiceCategory)
            : provider.categories[0]
        }
        initialTitle={prefillTitle ?? ""}
      />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-sm font-bold text-foreground mt-0.5">{value}</p>
    </div>
  );
}

// ─── Quote request modal ─────────────────────────────────────────────────

interface QuoteModalProps {
  open: boolean;
  onClose: () => void;
  provider: ProProvider;
  initialCategory?: ProServiceCategory;
  initialTitle?: string;
}

function QuoteRequestModal({
  open,
  onClose,
  provider,
  initialCategory,
  initialTitle,
}: QuoteModalProps) {
  const [category, setCategory] = useState<ProServiceCategory>(
    initialCategory ?? provider.categories[0] ?? "other",
  );
  const [title, setTitle] = useState(initialTitle ?? "");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setCategory(initialCategory ?? provider.categories[0] ?? "other");
      setTitle(initialTitle ?? "");
      setSuccess(false);
    }
  }, [open, initialCategory, initialTitle, provider.categories]);

  const submit = useCallback(async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/pro-services/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider_id: provider.id,
          category,
          title: title.trim(),
          description: description.trim(),
          budget_cents: budget ? Math.floor(Number(budget) * 100) : undefined,
          deadline: deadline || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || `Failed (${res.status})`);
        return;
      }
      toast.success("Request sent! The provider will reply with a quote.");
      setSuccess(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }, [provider.id, category, title, description, budget, deadline]);

  return (
    <Modal isOpen={open} onClose={onClose} title={`Request quote — ${provider.name}`} size="lg">
      {success ? (
        <div className="py-4 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 size={22} />
          </div>
          <p className="text-sm font-semibold text-foreground">Request sent!</p>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {provider.name} will receive an email and reply with a quote. You&apos;ll see it in{" "}
            <Link href="/dashboard/hire/requests" className="text-foreground underline">
              My requests
            </Link>
            .
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border bg-surface-light text-xs font-semibold text-foreground"
            >
              Close
            </button>
            <Link
              href="/dashboard/hire/requests"
              className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold"
            >
              View my requests
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ProServiceCategory)}
              className="w-full bg-surface-light border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none"
            >
              {PRO_SERVICE_CATEGORIES.filter((c) =>
                provider.categories.length === 0 ? true : provider.categories.includes(c.id),
              ).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Project title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 10-min YouTube edit for weekly tech channel"
              className="w-full bg-surface-light border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none placeholder-muted"
              maxLength={140}
            />
          </Field>
          <Field label="Describe what you need">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Style references, deliverable specs, platform, anything else the freelancer should know."
              rows={5}
              className="w-full bg-surface-light border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none placeholder-muted resize-none"
              maxLength={3000}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Budget (USD, optional)">
              <input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="500"
                className="w-full bg-surface-light border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none placeholder-muted"
                inputMode="numeric"
              />
            </Field>
            <Field label="Deadline (optional)">
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-surface-light border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none"
              />
            </Field>
          </div>

          <p className="text-[11px] text-muted pt-1">
            No money changes hands through ShortStack yet — once accepted, the provider will invoice
            you directly with your preferred method.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border bg-surface-light text-xs font-semibold text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold disabled:opacity-60"
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              {submitting ? "Sending…" : "Send request"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

