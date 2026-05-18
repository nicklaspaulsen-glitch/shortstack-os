"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  Mail, Phone, Globe, LayoutDashboard, MessageSquare,
  Loader, Sparkles, ChevronRight, ShieldCheck, Info,
} from "lucide-react";
import { MotionPage } from "@/components/motion/motion-page";

/**
 * Domain-as-Hub setup wizard.
 *
 * Query params:
 *   ?domain=<already-owned-domain>  → prefill the domain field + hide the
 *     search UI. This page is designed for the "after purchase" flow
 *     where the user just bought the domain and the dashboard redirects
 *     them here with the toggles ready.
 */

interface Toggle {
  key: "email" | "phone" | "website" | "portal" | "chat";
  label: string;
  description: string;
  icon: React.ReactNode;
  example: string;
}

const TOGGLES: Toggle[] = [
  {
    key: "email",
    label: "Send branded email",
    description: "Verified sending domain in Resend with DKIM, SPF, and DMARC pre-configured.",
    icon: <Mail size={16} />,
    example: "you@domain.com",
  },
  {
    key: "phone",
    label: "Provision matching phone number",
    description: "Local Twilio number in the same area code — SMS + voice ready.",
    icon: <Phone size={16} />,
    example: "+1 (555) 010-****",
  },
  {
    key: "website",
    label: "Deploy website to domain",
    description: "Starter coming-soon page ready at your domain, attach your own design later.",
    icon: <Globe size={16} />,
    example: "https://domain.com",
  },
  {
    key: "portal",
    label: "Launch client portal",
    description: "Branded portal at portal.domain.com for client logins, messages, and files.",
    icon: <LayoutDashboard size={16} />,
    example: "https://portal.domain.com",
  },
  {
    key: "chat",
    label: "Install branded chat widget",
    description: "One embed script — live chat on the client's site, routed to your inbox.",
    icon: <MessageSquare size={16} />,
    example: "<script src=…>",
  },
];

function HubSetupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const prefillDomain = params?.get("domain") || "";

  const [domain, setDomain] = useState(prefillDomain);
  const [areaCode, setAreaCode] = useState("");
  const [enabled, setEnabled] = useState<Record<Toggle["key"], boolean>>({
    email: true,
    phone: true,
    website: true,
    portal: true,
    chat: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (prefillDomain) setDomain(prefillDomain);
  }, [prefillDomain]);

  function toggle(key: Toggle["key"]) {
    setEnabled(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const enabledCount = Object.values(enabled).filter(Boolean).length;

  async function submit() {
    const trimmed = domain.trim().toLowerCase();
    if (!trimmed || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed)) {
      toast.error("Enter a valid domain like mybusiness.com");
      return;
    }
    if (enabledCount === 0) {
      toast.error("Pick at least one service to provision");
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading("Kicking off provisioning…");
    try {
      const res = await fetch("/api/domains/provision-hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: trimmed,
          enable_email: enabled.email,
          enable_phone: enabled.phone,
          enable_website: enabled.website,
          enable_portal: enabled.portal,
          enable_chat: enabled.chat,
          area_code: areaCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      toast.dismiss(toastId);

      if (data.success && data.job_id) {
        router.push(`/dashboard/domains/hub-status/${data.job_id}`);
      } else {
        toast.error(data.error || "Failed to start provisioning");
        setSubmitting(false);
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* -- Launch your brand command strip -- */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0">
          <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">HUB SETUP</p>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Launch your brand</h1>
        </div>
      </div>

      {/* Domain input card — hidden if prefilled */}
      {!prefillDomain && (
        <div className="glass rounded-xl p-4">
          <h2 className="flex items-center gap-2">
            <Globe size={13} className="text-brand-accent" /> Which domain?
          </h2>
          <input
            value={domain}
            onChange={e => setDomain(e.target.value)}
            placeholder="mybusiness.com"
            className="input w-full text-sm"
          />
          <p className="text-[10px] text-text-muted mt-2">
            If you just purchased this domain, use its exact spelling.
          </p>
        </div>
      )}
      {prefillDomain && (
        <div className="glass rounded-xl p-4 flex items-center gap-3 bg-[rgba(59,130,246,0.05)] border-[rgba(59,130,246,0.2)]">
          <ShieldCheck size={18} className="text-brand-accent" />
          <div>
            <p className="text-xs font-semibold">{prefillDomain}</p>
            <p className="text-[10px] text-text-muted">Purchase confirmed — now picking services.</p>
          </div>
        </div>
      )}

      {/* 5-toggle picker */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 mb-0">
            <Sparkles size={13} className="text-brand-accent" /> What should we set up?
          </h2>
          <span className="text-[10px] text-text-muted">
            {enabledCount} / 5 selected
          </span>
        </div>
        <div className="space-y-2">
          {TOGGLES.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => toggle(t.key)}
              className={`w-full text-left p-3 rounded-xl border transition flex items-start gap-3 ${
                enabled[t.key]
                  ? "border-[rgba(59,130,246,0.35)] bg-[rgba(59,130,246,0.05)] hover:bg-[rgba(59,130,246,0.08)]"
                  : "border-border-subtle bg-surface-light hover:border-border-subtle/60"
              }`}
            >
              <div
                className={`w-5 h-5 shrink-0 rounded-md flex items-center justify-center mt-0.5 border ${
                  enabled[t.key] ? "bg-brand-accent border-brand-accent text-white" : "border-border-subtle"
                }`}
              >
                {enabled[t.key] && <span className="text-[10px] leading-none font-black">✓</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`${enabled[t.key] ? "text-brand-accent" : "text-text-muted"}`}>
                    {t.icon}
                  </span>
                  <span className="text-xs font-semibold">{t.label}</span>
                </div>
                <p className="text-[10px] text-text-muted mt-1">{t.description}</p>
                <p className="text-[10px] text-text-muted/70 font-mono mt-1">
                  e.g. {t.example.replace("domain", domain || "domain").replace("domain.com", domain || "domain.com")}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Area-code hint only shown when phone is on */}
        {enabled.phone && (
          <div className="mt-3 pt-3 border-t border-border-subtle/60">
            <label className="text-[11px] font-semibold flex items-center gap-1.5 mb-1">
              <Phone size={11} /> Preferred area code
              <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <input
              value={areaCode}
              onChange={e => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="415"
              className="input w-32 text-sm"
            />
            <p className="text-[10px] text-text-muted mt-1">
              Leave blank and Twilio picks any available local US number.
            </p>
          </div>
        )}
      </div>

      <div className="glass rounded-xl p-4 bg-blue-500/5 border-blue-500/25 flex items-start gap-2">
        <Info size={14} className="text-blue-600 mt-0.5 shrink-0" />
        <div className="text-[11px] text-blue-700">
          <p className="font-semibold mb-1">What happens next</p>
          <p className="text-blue-600 leading-relaxed">
            Clicking Launch starts all {enabledCount} services in parallel. You&apos;ll land on a
            live progress page showing colored dots — gray → yellow → green. Any failure surfaces
            a retry button without blocking the rest.
          </p>
        </div>
      </div>

      <div className="sticky bottom-3 z-10">
        <button
          onClick={submit}
          disabled={submitting || enabledCount === 0}
          className="w-full btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader size={14} className="animate-spin" /> Launching…
            </>
          ) : (
            <>
              Launch brand on {domain || "domain.com"} <ChevronRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function HubSetupPage() {
  return (
    <MotionPage>
            <Suspense fallback={<div className="p-6 text-text-muted text-sm">Loading…</div>}>
            <HubSetupInner />
          </Suspense>
          </MotionPage>
  );
}
