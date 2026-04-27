"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import {
  Palette, Globe, Mail, Image, ToggleLeft, ToggleRight, Save, Loader2,
  AlignLeft, CheckCircle2, Eye, EyeOff, RefreshCw, ShieldCheck, X,
  DollarSign, ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";

interface WhiteLabelConfig {
  id?: string;
  company_name: string;
  brand_name: string;
  logo_url: string;
  primary_color: string;
  custom_domain: string;
  custom_domain_verified: boolean;
  custom_domain_ssl_status: string;
  email_from_name: string;
  tagline: string;
  login_text: string;
  show_powered_by: boolean;
  accent_color: string;
  favicon_url: string;
  support_email: string;
  privacy_url: string;
  terms_url: string;
  resell_enabled: boolean;
  markup_percent: number;
}

const DEFAULT: WhiteLabelConfig = {
  company_name: "",
  brand_name: "",
  logo_url: "",
  primary_color: "#C9A84C",
  custom_domain: "",
  custom_domain_verified: false,
  custom_domain_ssl_status: "pending",
  email_from_name: "",
  tagline: "",
  login_text: "",
  show_powered_by: true,
  accent_color: "#1a1611",
  favicon_url: "",
  support_email: "",
  privacy_url: "",
  terms_url: "",
  resell_enabled: false,
  markup_percent: 0,
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-white/80">{label}</label>
      {children}
      {hint && <p className="text-xs text-white/40">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#C9A84C]/50 focus:bg-white/8 transition-all"
    />
  );
}

export default function WhiteLabelPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<WhiteLabelConfig>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [stripeStatus, setStripeStatus] = useState<{ connected: boolean; fully_onboarded?: boolean } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("white_label_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setConfig({ ...DEFAULT, ...(data as Partial<WhiteLabelConfig>) });
        setDomainInput((data as { custom_domain?: string }).custom_domain || "");
      }
      setLoading(false);
      try {
        const sRes = await fetch("/api/integrations/stripe-connect/status");
        if (sRes.ok) {
          const sJson = await sRes.json();
          setStripeStatus({
            connected: !!sJson.connected,
            fully_onboarded: !!sJson.account?.fully_onboarded,
          });
        }
      } catch {
        // Stripe status is informational only
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const set = (key: keyof WhiteLabelConfig, val: string | boolean | number) =>
    setConfig((prev) => ({ ...prev, [key]: val } as WhiteLabelConfig));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = { ...config, user_id: user.id };
      const { error } = config.id
        ? await supabase.from("white_label_config").update(payload).eq("id", config.id)
        : await supabase.from("white_label_config").insert(payload).select().single();
      if (error) throw error;
      const { data: fresh } = await supabase
        .from("white_label_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (fresh) setConfig({ ...DEFAULT, ...(fresh as Partial<WhiteLabelConfig>) });
      toast.success("White label settings saved");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleAddDomain = async () => {
    const value = domainInput.trim().toLowerCase();
    if (!value) {
      toast.error("Enter a domain");
      return;
    }
    setDomainBusy(true);
    try {
      const res = await fetch("/api/whitelabel/domains/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Domain add failed");
      toast.success(json.verified ? "Domain attached and verified" : "Domain attached. Add DNS to verify.");
      set("custom_domain", value);
      set("custom_domain_verified", !!json.verified);
      set("custom_domain_ssl_status", json.verified ? "active" : "provisioning");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Domain add failed";
      toast.error(msg);
    } finally {
      setDomainBusy(false);
    }
  };

  const handleVerifyDomain = async () => {
    setDomainBusy(true);
    try {
      const res = await fetch("/api/whitelabel/domains/verify", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Verify failed");
      if (json.verified) {
        toast.success("DNS verified -- your domain is live");
        set("custom_domain_verified", true);
        set("custom_domain_ssl_status", "active");
      } else {
        toast.error(json.error || "DNS not yet propagated. Try again in a few minutes.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verify failed";
      toast.error(msg);
    } finally {
      setDomainBusy(false);
    }
  };

  const handleRemoveDomain = async () => {
    if (!confirm("Remove this custom domain? Branded URLs will stop working.")) return;
    setDomainBusy(true);
    try {
      const res = await fetch("/api/whitelabel/domains/remove", { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Remove failed");
      }
      toast.success("Domain removed");
      set("custom_domain", "");
      set("custom_domain_verified", false);
      set("custom_domain_ssl_status", "pending");
      setDomainInput("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Remove failed";
      toast.error(msg);
    } finally {
      setDomainBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto">
      <PageHero
        title="White Label"
        subtitle="Brand ShortStack as your own product -- custom domain, logo, colors, Stripe Connect resell."
        icon={<Palette className="w-6 h-6" />}
        gradient="purple"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/15 text-white/80 transition-all"
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPreview ? "Hide Preview" : "Preview"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-[#C9A84C] hover:bg-[#d4b55d] text-black transition-all disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Settings
            </button>
          </div>
        }
      />

      {showPreview && (
        <div
          className="rounded-xl border border-white/10 p-5 overflow-hidden relative"
          style={{ background: config.accent_color || "#1a1611" }}
        >
          <div className="flex items-center gap-4">
            {config.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.logo_url} alt="logo" className="h-10 object-contain rounded" />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
                style={{ background: config.primary_color, color: "#000" }}
              >
                {(config.brand_name || config.company_name || "S")[0]}
              </div>
            )}
            <div>
              <p className="text-white font-bold text-lg">
                {config.brand_name || config.company_name || "Your Brand"}
              </p>
              {config.tagline && <p className="text-white/60 text-sm">{config.tagline}</p>}
            </div>
          </div>
          <p className="absolute top-3 right-4 text-[10px] text-white/30 uppercase tracking-widest">
            Preview
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/8 bg-white/3 p-5 flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Branding</p>
          <Field label="Brand Name" hint="Replaces ShortStack across the platform">
            <Input
              value={config.brand_name || config.company_name}
              onChange={(v) => {
                set("brand_name", v);
                set("company_name", v);
              }}
              placeholder="Acme Agency"
            />
          </Field>
          <Field label="Tagline" hint="Short description shown on the login page">
            <Input value={config.tagline} onChange={(v) => set("tagline", v)} placeholder="Grow faster with AI" />
          </Field>
          <Field label="Logo URL" hint="Direct link to your logo image (PNG/SVG recommended)">
            <div className="flex gap-2">
              <Input value={config.logo_url} onChange={(v) => set("logo_url", v)} placeholder="https://cdn.yourbrand.com/logo.png" />
              <Image className="w-5 h-5 text-white/30 shrink-0 self-center" />
            </div>
          </Field>
          <Field label="Favicon URL" hint="16x16 or 32x32 .ico or .png">
            <Input value={config.favicon_url} onChange={(v) => set("favicon_url", v)} placeholder="https://cdn.yourbrand.com/favicon.ico" />
          </Field>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/3 p-5 flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Colors</p>
          <Field label="Primary Color" hint="Main accent color -- buttons, highlights">
            <div className="flex gap-3 items-center">
              <input type="color" value={config.primary_color} onChange={(e) => set("primary_color", e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border border-white/10 bg-transparent" />
              <Input value={config.primary_color} onChange={(v) => set("primary_color", v)} placeholder="#C9A84C" />
            </div>
          </Field>
          <Field label="Background / Dark Color" hint="Used in hero gradients and dark surfaces">
            <div className="flex gap-3 items-center">
              <input type="color" value={config.accent_color} onChange={(e) => set("accent_color", e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border border-white/10 bg-transparent" />
              <Input value={config.accent_color} onChange={(v) => set("accent_color", v)} placeholder="#1a1611" />
            </div>
          </Field>

          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/8">
            <div>
              <p className="text-sm text-white font-medium">Show Powered by ShortStack</p>
              <p className="text-xs text-white/40">Display attribution in the footer</p>
            </div>
            <button onClick={() => set("show_powered_by", !config.show_powered_by)} className="shrink-0">
              {config.show_powered_by ? <ToggleRight className="w-8 h-8 text-[#C9A84C]" /> : <ToggleLeft className="w-8 h-8 text-white/30" />}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/3 p-5 flex flex-col gap-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Custom Domain</p>
            {config.custom_domain && (
              <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${config.custom_domain_verified ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                {config.custom_domain_verified ? "Verified" : "Awaiting DNS"}
              </span>
            )}
          </div>

          {!config.custom_domain ? (
            <Field label="Add a custom domain" hint="e.g. app.youragency.com -- this becomes the URL your subaccounts log in at.">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    placeholder="app.youragency.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#C9A84C]/50 transition-all"
                  />
                </div>
                <button
                  onClick={handleAddDomain}
                  disabled={domainBusy || !domainInput.trim()}
                  className="px-4 py-2.5 rounded-lg bg-[#C9A84C] hover:bg-[#d4b55d] text-black text-sm font-semibold disabled:opacity-60 transition-all whitespace-nowrap"
                >
                  {domainBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Attach"}
                </button>
              </div>
            </Field>
          ) : (
            <>
              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-white/40" />
                  <span className="font-mono text-white text-sm">{config.custom_domain}</span>
                  {config.custom_domain_verified && (
                    <a href={`https://${config.custom_domain}`} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white" aria-label="Open">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleVerifyDomain} disabled={domainBusy} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white/80 text-xs font-medium disabled:opacity-60">
                    {domainBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Verify
                  </button>
                  <button onClick={handleRemoveDomain} disabled={domainBusy} className="p-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-300" title="Remove">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {!config.custom_domain_verified && (
                <div className="rounded-lg bg-white/5 border border-white/10 p-3 flex flex-col gap-2 text-xs">
                  <p className="font-semibold text-white/80 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                    Add these DNS records to your domain registrar:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-white/70">
                    <div className="bg-black/30 rounded px-2 py-1">
                      <p className="text-white/40 text-[10px] uppercase">Type</p>
                      <p>{config.custom_domain.split(".").length > 2 ? "CNAME" : "A"}</p>
                    </div>
                    <div className="bg-black/30 rounded px-2 py-1">
                      <p className="text-white/40 text-[10px] uppercase">Name</p>
                      <p>{config.custom_domain.split(".").length > 2 ? config.custom_domain.split(".")[0] : "@"}</p>
                    </div>
                    <div className="bg-black/30 rounded px-2 py-1">
                      <p className="text-white/40 text-[10px] uppercase">Value</p>
                      <p>{config.custom_domain.split(".").length > 2 ? "cname.vercel-dns.com" : "76.76.21.21"}</p>
                    </div>
                  </div>
                  <p className="text-white/40">DNS propagation takes 5-30 minutes. SSL is provisioned automatically once verified.</p>
                </div>
              )}

              {config.custom_domain_verified && (
                <div className="flex items-center gap-2 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Live with SSL. Your subaccounts can sign in at <span className="font-mono">https://{config.custom_domain}</span>.
                </div>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-white/8 bg-white/3 p-5 flex flex-col gap-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Resell Billing</p>
            {stripeStatus && (
              <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${stripeStatus.fully_onboarded ? "bg-emerald-500/20 text-emerald-300" : stripeStatus.connected ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-white/40"}`}>
                {stripeStatus.fully_onboarded ? "Stripe Connected" : stripeStatus.connected ? "Onboarding incomplete" : "Not connected"}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/8">
            <div>
              <p className="text-sm text-white font-medium">Enable Reselling</p>
              <p className="text-xs text-white/40">
                Allow subaccounts to be billed via your Stripe Connect account. Requires Stripe Connect onboarded first.
              </p>
            </div>
            <button
              onClick={() => set("resell_enabled", !config.resell_enabled)}
              disabled={!stripeStatus?.fully_onboarded}
              className="shrink-0 disabled:opacity-40"
              title={stripeStatus?.fully_onboarded ? "Toggle reselling" : "Connect Stripe first"}
            >
              {config.resell_enabled ? <ToggleRight className="w-8 h-8 text-[#C9A84C]" /> : <ToggleLeft className="w-8 h-8 text-white/30" />}
            </button>
          </div>

          <Field label="Markup percent" hint="Adds this percentage on top of the ShortStack base fee. e.g. 30 = you charge subaccounts 1.3x the base price.">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-white/30" />
              <input
                type="number"
                min={0}
                max={500}
                step={5}
                value={config.markup_percent}
                onChange={(e) => set("markup_percent", Number(e.target.value) || 0)}
                className="w-32 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#C9A84C]/50"
              />
              <span className="text-white/60 text-sm">%</span>
            </div>
          </Field>

          {!stripeStatus?.connected && (
            <a href="/api/integrations/stripe-connect/onboard" className="text-xs text-[#C9A84C] hover:underline flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Connect your Stripe account to enable resell billing
            </a>
          )}
        </div>

        <div className="rounded-xl border border-white/8 bg-white/3 p-5 flex flex-col gap-4 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Email and Portal Copy</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Email From Name" hint="Sender name shown in client email notifications">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  value={config.email_from_name}
                  onChange={(e) => set("email_from_name", e.target.value)}
                  placeholder="Acme Agency Team"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#C9A84C]/50 transition-all"
                />
              </div>
            </Field>
            <Field label="Support Email" hint="Where customer support emails go for your brand">
              <Input value={config.support_email} onChange={(v) => set("support_email", v)} placeholder="support@youragency.com" />
            </Field>
            <Field label="Privacy URL" hint="Linked from the footer of branded surfaces">
              <Input value={config.privacy_url} onChange={(v) => set("privacy_url", v)} placeholder="https://youragency.com/privacy" />
            </Field>
            <Field label="Terms URL" hint="Linked from the footer of branded surfaces">
              <Input value={config.terms_url} onChange={(v) => set("terms_url", v)} placeholder="https://youragency.com/terms" />
            </Field>
          </div>
          <Field label="Custom Login Page Text" hint="Shown below the logo on the sign-in page">
            <div className="relative">
              <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-white/30" />
              <textarea
                value={config.login_text}
                onChange={(e) => set("login_text", e.target.value)}
                placeholder="Welcome back! Sign in to manage your growth."
                rows={3}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#C9A84C]/50 transition-all resize-none"
              />
            </div>
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#C9A84C] hover:bg-[#d4b55d] text-black transition-all disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save White Label Settings
        </button>
      </div>
    </div>
  );
}
