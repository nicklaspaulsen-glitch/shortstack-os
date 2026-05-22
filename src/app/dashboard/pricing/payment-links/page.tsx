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
import { Check, Copy, ExternalLink, LinkIcon, Lock, ArrowLeft } from "lucide-react";
import { MotionPage } from "@/components/motion/motion-page";

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
      <MotionPage className="flex items-center justify-center min-h-[60vh] text-text-muted text-sm">Loading...
              </MotionPage>
    );
  }

  if (fetchState === "forbidden") {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-3">
        <Lock size={32} className="text-text-muted mx-auto" />
        <h1 className="text-lg font-bold">Admin only</h1>
        <p className="text-xs text-text-muted">
          Payment Links are only visible to account admins.
        </p>
        <button
          onClick={() => router.push("/dashboard/pricing")}
          className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl border border-border-subtle bg-surface hover:bg-surface-light"
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* -- Stripe Payment Links command strip -- */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0">
          <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">Admin</p>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Stripe Payment Links</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => router.push("/dashboard/pricing")}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-white/5 border border-border-subtle text-text-primary hover:bg-white/10"
          >
            <ArrowLeft size={12} /> Pricing
          </button>
        </div>
      </div>

      <div className=" border border-border-subtle bg-surface p-4">
        <p className="text-[11px] text-text-muted leading-relaxed">
          <span className="text-text-primary font-medium">{configuredCount}</span> of{" "}
          <span className="text-text-primary font-medium">{links.length}</span> payment links configured.{" "}
          To add a missing link, create it in{" "}
          <a
            href="https://dashboard.stripe.com/payment-links"
            target="_blank"
            rel="noreferrer"
            className="text-brand-accent hover:underline"
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
            <div key={tier} className=" border border-border-subtle bg-surface p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-text-primary">{TIER_LABELS[tier]}</h2>
                <span className="text-[10px] text-text-muted">
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
                          : "border-border-subtle bg-surface-light/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-text-primary">{cycleLabel}</span>
                        {link.url ? (
                          <span className="text-[9px] text-success font-medium uppercase tracking-wider">
                            Active
                          </span>
                        ) : (
                          <span className="text-[9px] text-text-muted font-medium uppercase tracking-wider">
                            Not set
                          </span>
                        )}
                      </div>
                      {link.url ? (
                        <div className="space-y-2">
                          <div className="text-[10px] font-mono text-text-muted bg-white/5 rounded-md px-2 py-1.5 truncate" title={link.url}>
                            {link.url}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => copyLink(key, link.url!)}
                              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-[rgba(212,255,0,0.08)] text-brand-accent hover:bg-[rgba(212,255,0,0.12)] border border-[rgba(212,255,0,0.2)] font-medium"
                            >
                              {copiedKey === key ? <Check size={11} /> : <Copy size={11} />}
                              {copiedKey === key ? "Copied!" : "Copy"}
                            </button>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-surface-light text-text-primary hover:bg-[rgba(212,255,0,0.08)] hover:text-brand-accent border border-border-subtle font-medium"
                            >
                              <ExternalLink size={11} />
                              Preview
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-text-muted leading-relaxed">
                          Set env var:{" "}
                          <code className="text-[10px] font-mono text-text-primary bg-white/8 px-1.5 py-0.5 rounded">
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
        <div className=" border border-danger/20 bg-danger/[0.05] p-4 text-center">
          <p className="text-xs text-danger">Failed to load payment links. Try refreshing.</p>
        </div>
      )}
    </div>
  );
}
