"use client";

/**
 * Provider self-serve profile editor. Two modes:
 *   1. First-run (no pro_services_providers row yet) → "Apply to join" form
 *      that POSTs to /api/pro-services/providers with vetted=false.
 *   2. Existing provider → PATCH /api/pro-services/providers/[id]. They
 *      cannot toggle vetted themselves; that's admin-only.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  UserCog,
  Save,
  Loader2,
  ArrowLeft,
  Plus,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";
import {
  PRO_SERVICE_CATEGORIES,
  type ProServiceCategory,
  isValidCategory,
  type ProProvider,
} from "@/lib/pro-services";

export default function ProviderProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [existing, setExisting] = useState<ProProvider | null>(null);
  const [loadingRow, setLoadingRow] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [timezone, setTimezone] = useState(
    typeof window !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "",
  );
  const [categories, setCategories] = useState<ProServiceCategory[]>([]);
  const [startingPrice, setStartingPrice] = useState("");
  const [turnaround, setTurnaround] = useState("7");
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  const loadRow = useCallback(async () => {
    if (!user?.email) {
      setLoadingRow(false);
      return;
    }
    setLoadingRow(true);
    try {
      const res = await fetch("/api/pro-services/providers");
      if (res.ok) {
        const json = await res.json();
        const row: ProProvider | null =
          (json.providers ?? []).find(
            (p: ProProvider) =>
              p.email?.toLowerCase() === user.email?.toLowerCase(),
          ) ?? null;
        if (row) {
          setExisting(row);
          setName(row.name);
          setBio(row.bio ?? "");
          setAvatarUrl(row.avatar_url ?? "");
          setTimezone(row.timezone ?? timezone);
          setCategories(row.categories ?? []);
          setStartingPrice(
            row.starting_price_cents ? String(row.starting_price_cents / 100) : "",
          );
          setTurnaround(String(row.turnaround_days ?? 7));
          setPortfolioUrls(row.portfolio_urls.length > 0 ? row.portfolio_urls : [""]);
        }
      }
    } catch (err) {
      console.error("[providers/profile] load failed:", err);
    } finally {
      setLoadingRow(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  useEffect(() => {
    if (authLoading) return;
    void loadRow();
  }, [authLoading, loadRow]);

  const toggleCategory = (c: ProServiceCategory) => {
    setCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  const save = useCallback(async () => {
    if (!user?.email) return;
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (categories.length === 0) {
      toast.error("Pick at least one category");
      return;
    }

    const payload = {
      name: name.trim(),
      email: user.email,
      bio: bio.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      timezone: timezone.trim() || null,
      categories,
      starting_price_cents: startingPrice
        ? Math.floor(Number(startingPrice) * 100)
        : 0,
      turnaround_days: Math.max(1, Math.floor(Number(turnaround) || 7)),
      portfolio_urls: portfolioUrls.map((u) => u.trim()).filter((u) => u.length > 0),
    };

    setSaving(true);
    try {
      const res = await fetch(
        existing
          ? `/api/pro-services/providers/${existing.id}`
          : "/api/pro-services/providers",
        {
          method: existing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || `Failed (${res.status})`);
        return;
      }
      toast.success(existing ? "Profile saved" : "Application submitted!");
      await loadRow();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }, [
    user?.email,
    name,
    bio,
    avatarUrl,
    timezone,
    categories,
    startingPrice,
    turnaround,
    portfolioUrls,
    existing,
    loadRow,
  ]);

  if (authLoading || loadingRow) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-xs text-muted">
        <Loader2 size={14} className="animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="fade-in max-w-3xl mx-auto space-y-6 p-4 sm:p-6">
      <Link
        href="/providers/dashboard"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
      >
        <ArrowLeft size={12} /> Back to dashboard
      </Link>

      <PageHero
        icon={<UserCog size={22} />}
        eyebrow={existing ? "Your listing" : "Apply to join"}
        title={existing ? "Edit your provider profile" : "Apply to the Pro Services directory"}
        subtitle={
          existing
            ? existing.vetted
              ? "Your listing is live. Updates appear to clients immediately."
              : "Your application is under review."
            : "Tell us about your skills. Our team reviews each application within a few days."
        }
        gradient="gold"
      />

      <section className="rounded-2xl border border-border bg-surface p-5 space-y-4">
        <Field label="Display name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name or studio name"
            className="w-full bg-surface-light border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none"
            maxLength={120}
          />
        </Field>

        <Field label="Bio">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What you do, who you love working with, your style."
            rows={5}
            className="w-full bg-surface-light border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none resize-none"
            maxLength={2000}
          />
        </Field>

        <Field label="Avatar URL (optional)">
          <input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…/avatar.jpg"
            className="w-full bg-surface-light border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none"
          />
        </Field>

        <Field label="Timezone">
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="e.g. America/Los_Angeles"
            className="w-full bg-surface-light border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none"
          />
        </Field>

        <Field label="Categories (pick any that apply)">
          <div className="flex flex-wrap gap-1.5">
            {PRO_SERVICE_CATEGORIES.map((c) => {
              const active = categories.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-surface-light text-muted border-border"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Starting price (USD)">
            <input
              value={startingPrice}
              onChange={(e) => setStartingPrice(e.target.value)}
              placeholder="150"
              inputMode="numeric"
              className="w-full bg-surface-light border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none"
            />
          </Field>
          <Field label="Turnaround (days)">
            <input
              value={turnaround}
              onChange={(e) => setTurnaround(e.target.value)}
              placeholder="7"
              inputMode="numeric"
              className="w-full bg-surface-light border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none"
            />
          </Field>
        </div>

        <Field label="Portfolio links">
          <div className="space-y-2">
            {portfolioUrls.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={url}
                  onChange={(e) =>
                    setPortfolioUrls((prev) => prev.map((u, idx) => (idx === i ? e.target.value : u)))
                  }
                  placeholder="https://…"
                  className="flex-1 bg-surface-light border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={() => setPortfolioUrls((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={portfolioUrls.length <= 1}
                  className="p-2 rounded-xl border border-border bg-surface-light text-muted hover:text-foreground disabled:opacity-40"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setPortfolioUrls((prev) => [...prev, ""])}
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
            >
              <Plus size={12} /> Add another
            </button>
          </div>
        </Field>

        <div className="flex justify-end pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold disabled:opacity-60"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {saving ? "Saving…" : existing ? "Save changes" : "Submit application"}
          </button>
        </div>
      </section>
    </div>
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

// The `isValidCategory` import keeps the library tree-shaken even if we
// don't use it directly in this file.
void isValidCategory;
