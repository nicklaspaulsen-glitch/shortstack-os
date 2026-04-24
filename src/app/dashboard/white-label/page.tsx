"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import {
  Palette, Globe, Mail, Image, ToggleLeft, ToggleRight, Save, Loader2,
  AlignLeft, CheckCircle2, Eye, EyeOff,
} from "lucide-react";
import toast from "react-hot-toast";

interface WhiteLabelConfig {
  id?: string;
  company_name: string;
  logo_url: string;
  primary_color: string;
  custom_domain: string;
  email_from_name: string;
  tagline: string;
  login_text: string;
  show_powered_by: boolean;
  accent_color: string;
  favicon_url: string;
}

const DEFAULT: WhiteLabelConfig = {
  company_name: "",
  logo_url: "",
  primary_color: "#C9A84C",
  custom_domain: "",
  email_from_name: "",
  tagline: "",
  login_text: "",
  show_powered_by: true,
  accent_color: "#1a1611",
  favicon_url: "",
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-white/80">{label}</label>
      {children}
      {hint && <p className="text-xs text-white/40">{hint}</p>}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
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
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("white_label_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setConfig(data as WhiteLabelConfig);
      setLoading(false);
    })();
  }, [user]);

  const set = (key: keyof WhiteLabelConfig, val: string | boolean) =>
    setConfig((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = { ...config, user_id: user.id };
      const { error } = config.id
        ? await supabase
            .from("white_label_config")
            .update(payload)
            .eq("id", config.id)
        : await supabase.from("white_label_config").insert(payload).select().single();
      if (error) throw error;
      // Re-fetch to get the generated id
      const { data: fresh } = await supabase
        .from("white_label_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (fresh) setConfig(fresh as WhiteLabelConfig);
      toast.success("White label settings saved");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast.error(msg);
    } finally {
      setSaving(false);
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
        subtitle="Brand ShortStack as your own product — custom domain, logo, colors, and client portal copy."
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
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Settings
            </button>
          </div>
        }
      />

      {/* Live preview banner */}
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
                {(config.company_name || "S")[0]}
              </div>
            )}
            <div>
              <p className="text-white font-bold text-lg">
                {config.company_name || "Your Brand"}
              </p>
              {config.tagline && (
                <p className="text-white/60 text-sm">{config.tagline}</p>
              )}
            </div>
          </div>
          <p className="absolute top-3 right-4 text-[10px] text-white/30 uppercase tracking-widest">
            Preview
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Branding */}
        <div className="rounded-xl border border-white/8 bg-white/3 p-5 flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
            Branding
          </p>
          <Field label="Brand Name" hint="Replaces 'ShortStack' across the platform">
            <Input
              value={config.company_name}
              onChange={(v) => set("company_name", v)}
              placeholder="Acme Agency"
            />
          </Field>
          <Field label="Tagline" hint="Short description shown on the login page">
            <Input
              value={config.tagline}
              onChange={(v) => set("tagline", v)}
              placeholder="Grow faster with AI"
            />
          </Field>
          <Field label="Logo URL" hint="Direct link to your logo image (PNG/SVG recommended)">
            <div className="flex gap-2">
              <Input
                value={config.logo_url}
                onChange={(v) => set("logo_url", v)}
                placeholder="https://cdn.yourbrand.com/logo.png"
              />
              <Image className="w-5 h-5 text-white/30 shrink-0 self-center" />
            </div>
          </Field>
          <Field label="Favicon URL" hint="16×16 or 32×32 .ico or .png">
            <Input
              value={config.favicon_url}
              onChange={(v) => set("favicon_url", v)}
              placeholder="https://cdn.yourbrand.com/favicon.ico"
            />
          </Field>
        </div>

        {/* Colors */}
        <div className="rounded-xl border border-white/8 bg-white/3 p-5 flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
            Colors
          </p>
          <Field label="Primary Color" hint="Main accent color — buttons, highlights">
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={config.primary_color}
                onChange={(e) => set("primary_color", e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border border-white/10 bg-transparent"
              />
              <Input
                value={config.primary_color}
                onChange={(v) => set("primary_color", v)}
                placeholder="#C9A84C"
              />
            </div>
          </Field>
          <Field label="Background / Dark Color" hint="Used in hero gradients and dark surfaces">
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={config.accent_color}
                onChange={(e) => set("accent_color", e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border border-white/10 bg-transparent"
              />
              <Input
                value={config.accent_color}
                onChange={(v) => set("accent_color", v)}
                placeholder="#1a1611"
              />
            </div>
          </Field>

          {/* Custom login page toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/8">
            <div>
              <p className="text-sm text-white font-medium">Show "Powered by ShortStack"</p>
              <p className="text-xs text-white/40">Display attribution in the footer</p>
            </div>
            <button
              onClick={() => set("show_powered_by", !config.show_powered_by)}
              className="shrink-0"
            >
              {config.show_powered_by ? (
                <ToggleRight className="w-8 h-8 text-[#C9A84C]" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-white/30" />
              )}
            </button>
          </div>
        </div>

        {/* Domain */}
        <div className="rounded-xl border border-white/8 bg-white/3 p-5 flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
            Domain
          </p>
          <Field
            label="Custom Domain"
            hint="Point your CNAME to our infra — e.g. app.yourbrand.com"
          >
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={config.custom_domain}
                onChange={(e) => set("custom_domain", e.target.value)}
                placeholder="app.yourbrand.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#C9A84C]/50 transition-all"
              />
            </div>
          </Field>
          {config.custom_domain && (
            <div className="flex items-center gap-2 text-xs text-white/50 bg-white/5 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              Add a CNAME record: <span className="font-mono text-white/70">{config.custom_domain}</span> → <span className="font-mono text-white/70">proxy.shortstack.ai</span>
            </div>
          )}
        </div>

        {/* Email / Portal copy */}
        <div className="rounded-xl border border-white/8 bg-white/3 p-5 flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
            Email & Portal Copy
          </p>
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

      {/* Save row */}
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
