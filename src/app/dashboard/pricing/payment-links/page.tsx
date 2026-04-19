"use client";

/**
 * Admin-only: copy-able Stripe Payment Links for each plan/cycle.
 *
 * Use these when a client wants a direct subscribe link (email, DM, proposal)
 * instead of going through the in-app pricing page. Each link is a hosted
 * checkout URL created in the Stripe Dashboard under Payment Links.
 *
 * To populate a link, add an env var to Vercel:
 *   STRIPE_PAYMENT_LINK_<TIER>_<CYCLE>
 *   e.g. STRIPE_PAYMENT_LINK_PRO_MONTHLY
 *        STRIPE_PAYMENT_LINK_BUSINESS_ANNUAL
 *
 * Missing links show a "not set" state with the exact env var name to add.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";
import { Check, Copy, ExternalLink, LinkIcon, Lock, ArrowLeft } from "lucide-react";

interface PaymentLink {
  tier: string;
  cycle: string;
  url: string | null;
  env_var: string;
}

const TIER_LABELS: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
  business: "Business",
  unlimited: "Unlimited",
};

export default function PaymentLinksPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [fetchState, setFetchState] = useState<"loading" | "ok" | "forbidden" | "error">("loading");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.push("/login");
      return;
    }
    if (profile.role !== "admin") {
      setFetchState("forbidden");
      return;
    }
    fetch("/api/billing/payment-links")
      .then((r) => {
        if (r.status === 403) {
          setFetchState("forbidden");
          return null;
        }
        if (!r.ok) {
          setFetchState("error");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data?.links) {
          setLinks(data.links);
          setFetchState("ok");
        }
      })
      .catch(() => setFetchState("error"));
  }, [profile, loading, router]);

  function copyLink(key: string, url: string) {
    if (typeof navigator === "undefined") return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  }

  if (loading || fetchState === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted text-sm">
        Loading...
      </div>
    );
  }

  if (fetchState === "forbidden") {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-3">
        <Lock size={32} className="text-muted mx-auto" />
        <h1 className="text-lg font-bold">Admin only</h1>
        <p className="text-xs text-muted">
          Payment Links are only visible to account admins.
        </p>
        <button
          onClick={() => router.push("/dashboard/pricing")}
          className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-light"
        >
          <ArrowLeft size={12} /> Back to Pricing
        </button>
      </div>
    );
  }

  // Group links by tier, then show monthly + annual side-by-side
  const byTier: Record<string, PaymentLink[]> = {};
  for (const link of links) {
    if (!byTier[link.tier]) byTier[link.tier] = [];
    byTier[link.tier].push(link);
  }

  const tierOrder = ["starter", "growth", "pro", "business", "unlimited"];
  const configuredCount = links.filter((l) => !!l.url).length;

  return (
    <div className="fade-in max-w-5xl mx-auto space-y-6">
      <PageHero
        icon={<LinkIcon size={28} />}
        title="Stripe Payment Links"
        subtitle="Hosted checkout URLs you can paste directly into emails, DMs, or proposals."
        gradient="purple"
        eyebrow="Admin"
        actions={
          <button
            onClick={() => router.push("/dashboard/pricing")}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white/90 hover:bg-white/20"
          >
            <ArrowLeft size={12} /> Pricing
          </button>
        }
      />

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-[11px] text-muted leading-relaxed">
          <span className="text-foreground font-medium">{configuredCount}</span> of{" "}
          <span className="text-foreground font-medium">{links.length}</span> payment links configured.{" "}
          To add a missing link, create it in{" "}
          <a
            href="https://dashboard.stripe.com/payment-links"
            target="_blank"
            rel="noreferrer"
            className="text-gold hover:underline"
          >
            Stripe Dashboard &rarr; Payment Links
          </a>
          {" "}and set the corresponding env var in Vercel (shown below). Redeploy to pick it up.
        </p>
      </div>

      <div className="space-y-3">
        {tierOrder
          .filter((t) => byTier[t])
          .map((tier) => (
            <div key={tier} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-foreground">{TIER_LABELS[tier]}</h2>
                <span className="text-[10px] text-muted">
                  {byTier[tier].filter((l) => !!l.url).length}/{byTier[tier].length} configured
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {byTier[tier].map((link) => {
                  const key = `${link.tier}_${link.cycle}`;
                  const cycleLabel = link.cycle === "annual" ? "Annual" : "Monthly";
                  return (
                    <div
                      key={key}
                      className={`rounded-xl border p-3 transition-colors ${
                        link.url
                          ? "border-success/20 bg-success/[0.03]"
                          : "border-border bg-surface-light/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-foreground">{cycleLabel}</span>
                        {link.url ? (
                          <span className="text-[9px] text-success font-medium uppercase tracking-wider">
                            Active
                          </span>
                        ) : (
                          <span className="text-[9px] text-muted font-medium uppercase tracking-wider">
                            Not set
                          </span>
                        )}
                      </div>
                      {link.url ? (
                        <div className="space-y-2">
                          <div className="text-[10px] font-mono text-muted bg-black/20 rounded-md px-2 py-1.5 truncate" title={link.url}>
                            {link.url}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => copyLink(key, link.url!)}
                              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 border border-gold/20 font-medium"
                            >
                              {copiedKey === key ? <Check size={11} /> : <Copy size={11} />}
                              {copiedKey === key ? "Copied!" : "Copy"}
                            </button>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-surface-light text-foreground hover:bg-gold/10 hover:text-gold border border-border font-medium"
                            >
                              <ExternalLink size={11} />
                              Preview
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-muted leading-relaxed">
                          Set env var:{" "}
                          <code className="text-[10px] font-mono text-foreground bg-black/30 px-1.5 py-0.5 rounded">
                            {link.env_var}
                          </code>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>

      {fetchState === "error" && (
        <div className="rounded-2xl border border-danger/20 bg-danger/[0.05] p-4 text-center">
          <p className="text-xs text-danger">Failed to load payment links. Try refreshing.</p>
        </div>
      )}
    </div>
  );
}
