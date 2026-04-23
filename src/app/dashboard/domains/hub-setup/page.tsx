"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  Mail, Phone, Globe, LayoutDashboard, MessageSquare,
  Loader, Sparkles, ChevronRight, ShieldCheck, Info,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

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
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Sparkles size={28} />}
        title="Launch your brand"
        subtitle="One click provisions email, phone, website, portal, and chat — all on your new domain."
        gradient="ocean"
      />

      {/* Domain input card — hidden if prefilled */}
      {!prefillDomain && (
        <div className="card">
          <h2 className="section-header flex items-center gap-2">
            <Globe size={13} className="text-gold" /> Which domain?
          </h2>
          <input
            value={domain}
            onChange={e => setDomain(e.target.value)}
            placeholder="mybusiness.com"
            className="input w-full text-sm"
          />
          <p className="text-[10px] text-muted mt-2">
            If you just purchased this domain, use its exact spelling.
          </p>
        </div>
      )}
      {prefillDomain && (
        <div className="card flex items-center gap-3 bg-gold/5 border-gold/20">
          <ShieldCheck size={18} className="text-gold" />
          <div>
            <p className="text-xs font-semibold">{prefillDomain}</p>
            <p className="text-[10px] text-muted">Purchase confirmed — now picking services.</p>
          </div>
        </div>
      )}

      {/* 5-toggle picker */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-header flex items-center gap-2 mb-0">
            <Sparkles size={13} className="text-gold" /> What should we set up?
          </h2>
          <span className="text-[10px] text-muted">
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
                  ? "border-gold/40 bg-gold/5 hover:bg-gold/10"
                  : "border-border bg-surface-light hover:border-border/60"
              }`}
            >
              <div
                className={`w-5 h-5 shrink-0 rounded-md flex items-center justify-center mt-0.5 border ${
                  enabled[t.key] ? "bg-gold border-gold text-black" : "border-border"
                }`}
              >
                {enabled[t.key] && <span className="text-[10px] leading-none font-black">✓</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`${enabled[t.key] ? "text-gold" : "text-muted"}`}>
                    {t.icon}
                  </span>
                  <span className="text-xs font-semibold">{t.label}</span>
                </div>
                <p className="text-[10px] text-muted mt-1">{t.description}</p>
                <p className="text-[10px] text-muted/70 font-mono mt-1">
                  e.g. {t.example.replace("domain", domain || "domain").replace("domain.com", domain || "domain.com")}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Area-code hint only shown when phone is on */}
        {enabled.phone && (
          <div className="mt-3 pt-3 border-t border-border/60">
            <label className="text-[11px] font-semibold flex items-center gap-1.5 mb-1">
              <Phone size={11} /> Preferred area code
              <span className="text-muted font-normal">(optional)</span>
            </label>
            <input
              value={areaCode}
              onChange={e => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="415"
              className="input w-32 text-sm"
            />
            <p className="text-[10px] text-muted mt-1">
              Leave blank and Twilio picks any available local US number.
            </p>
          </div>
        )}
      </div>

      <div className="card bg-blue-500/5 border-blue-500/20 flex items-start gap-2">
        <Info size={14} className="text-blue-300 mt-0.5 shrink-0" />
        <div className="text-[11px] text-blue-100">
          <p className="font-semibold mb-1">What happens next</p>
          <p className="text-blue-200/80 leading-relaxed">
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
    <Suspense fallback={<div className="p-6 text-muted text-sm">Loading…</div>}>
      <HubSetupInner />
    </Suspense>
  );
}
