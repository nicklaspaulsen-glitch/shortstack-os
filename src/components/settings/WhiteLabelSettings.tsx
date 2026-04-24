"use client";

/**
 * WhiteLabelSettings — company branding config (name, logo, colors, favicon,
 * login text) + live sidebar/button preview. Lazy-loaded because the logo
 * drop-zone + live preview DOM is heavy and only agency owners use this.
 */

import { useRef, useState } from "react";
import { Palette, Globe, Eye, Save, RotateCcw, Upload, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const LOGO_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export type WLState = {
  company_name: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
  favicon_url: string;
  login_text: string;
  show_powered_by: boolean;
  domain: string;
  support_email: string;
};

interface Props {
  whiteLabel: WLState;
  setWhiteLabel: React.Dispatch<React.SetStateAction<WLState>>;
  wlSaving: boolean;
  setWlSaving: (v: boolean) => void;
}

function LogoDropZone({
  logoUrl,
  onUploaded,
  onRemove,
}: {
  logoUrl: string;
  onUploaded: (url: string) => void;
  onRemove: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function validate(file: File): string | null {
    if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
      return `Unsupported file type "${file.type || "unknown"}". Allowed: PNG, JPEG, SVG.`;
    }
    if (file.size > LOGO_MAX_BYTES) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Max 2 MB.`;
    }
    if (file.size === 0) return "File is empty.";
    return null;
  }

  async function upload(file: File) {
    const v = validate(file);
    if (v) { setWarn(v); toast.error(v); return; }
    setWarn(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/white-label/logo-upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error || "Upload failed";
        setWarn(msg); toast.error(msg);
      } else if (data.logo_url) {
        onUploaded(data.logo_url); toast.success("Logo uploaded");
      } else { toast.error("Upload returned no URL"); }
    } catch {
      toast.error("Upload network error");
      setWarn("Network error during upload");
    } finally { setUploading(false); }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        className={`relative flex items-center gap-4 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          dragOver ? "border-gold bg-gold/[0.08]" : "border-border hover:border-gold/40 bg-surface-light/40"
        } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
      >
        <div className="w-14 h-14 rounded-lg border border-border bg-surface flex items-center justify-center overflow-hidden shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo preview" className="w-full h-full object-contain" />
          ) : (
            <Upload size={18} className="text-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium">
            {uploading ? "Uploading..." : logoUrl ? "Replace logo" : "Drop a logo here, or click to upload"}
          </p>
          <p className="text-[10px] text-muted mt-0.5">PNG, JPEG or SVG · max 2 MB</p>
          {warn && (
            <p className="text-[10px] text-danger mt-1 flex items-center gap-1">
              <AlertTriangle size={10} /> {warn}
            </p>
          )}
        </div>
        {uploading && <Loader2 size={16} className="text-gold animate-spin shrink-0" />}
        {logoUrl && !uploading && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setWarn(null); onRemove(); }}
            className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-md border border-border hover:border-danger/40 hover:text-danger text-muted shrink-0"
            title="Remove the current logo"
          >
            <Trash2 size={10} /> Remove logo
          </button>
        )}
        <input ref={inputRef} type="file" accept={LOGO_ALLOWED_TYPES.join(",")} onChange={onSelect} className="hidden" />
      </div>
    </div>
  );
}

export default function WhiteLabelSettings({ whiteLabel, setWhiteLabel, wlSaving, setWlSaving }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column — Config form */}
      <div className="lg:col-span-2 space-y-4">
        <div className="card">
          <h3 className="section-header flex items-center gap-2">
            <Palette size={14} className="text-gold" /> Branding
          </h3>
          <p className="text-xs text-muted mb-4">Rebrand ShortStack as your own platform. Changes apply across the sidebar, login page, and client portal.</p>

          <div className="space-y-4">
            {/* Company Name */}
            <div>
              <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Company Name</label>
              <input value={whiteLabel.company_name} onChange={e => setWhiteLabel({ ...whiteLabel, company_name: e.target.value })} placeholder="Your Agency Name (replaces ShortStack)" className="input w-full text-sm" />
              <p className="text-[9px] text-muted mt-1">Displayed in the sidebar, page titles, and client-facing UI</p>
            </div>

            {/* Logo Upload */}
            <div>
              <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Logo</label>
              <LogoDropZone
                logoUrl={whiteLabel.logo_url}
                onUploaded={(url) => setWhiteLabel({ ...whiteLabel, logo_url: url })}
                onRemove={() => setWhiteLabel({ ...whiteLabel, logo_url: "" })}
              />
              <label className="block text-[9px] text-muted uppercase tracking-wider mt-3 mb-1">Or paste a logo URL</label>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg border border-border bg-surface-light flex items-center justify-center overflow-hidden shrink-0">
                  {whiteLabel.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={whiteLabel.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Palette size={16} className="text-muted" />
                  )}
                </div>
                <input value={whiteLabel.logo_url} onChange={e => setWhiteLabel({ ...whiteLabel, logo_url: e.target.value })} placeholder="https://yourdomain.com/logo.png" className="input flex-1 text-sm" />
              </div>
              <p className="text-[9px] text-muted mt-1">Square image recommended (PNG/JPEG/SVG, at least 128x128px, max 2 MB)</p>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={whiteLabel.primary_color} onChange={e => setWhiteLabel({ ...whiteLabel, primary_color: e.target.value })} className="w-10 h-10 rounded-lg border border-border cursor-pointer" style={{ padding: 2 }} />
                  <input value={whiteLabel.primary_color} onChange={e => setWhiteLabel({ ...whiteLabel, primary_color: e.target.value })} className="input flex-1 text-sm font-mono" placeholder="#C9A84C" />
                </div>
                <p className="text-[9px] text-muted mt-1">Replaces gold (#C9A84C) across buttons, links, active states</p>
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Accent Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={whiteLabel.accent_color} onChange={e => setWhiteLabel({ ...whiteLabel, accent_color: e.target.value })} className="w-10 h-10 rounded-lg border border-border cursor-pointer" style={{ padding: 2 }} />
                  <input value={whiteLabel.accent_color} onChange={e => setWhiteLabel({ ...whiteLabel, accent_color: e.target.value })} className="input flex-1 text-sm font-mono" placeholder="#B8942F" />
                </div>
                <p className="text-[9px] text-muted mt-1">Secondary accent for hover states and highlights</p>
              </div>
            </div>

            {/* Favicon */}
            <div>
              <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Favicon URL</label>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded border border-border bg-surface-light flex items-center justify-center overflow-hidden shrink-0">
                  {whiteLabel.favicon_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={whiteLabel.favicon_url} alt="Favicon" className="w-full h-full object-contain" />
                  ) : (
                    <Globe size={12} className="text-muted" />
                  )}
                </div>
                <input value={whiteLabel.favicon_url} onChange={e => setWhiteLabel({ ...whiteLabel, favicon_url: e.target.value })} placeholder="https://yourdomain.com/favicon.ico" className="input flex-1 text-sm" />
              </div>
            </div>

            {/* Login Page Text */}
            <div>
              <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Custom Login Page Text</label>
              <textarea
                value={whiteLabel.login_text}
                onChange={e => setWhiteLabel({ ...whiteLabel, login_text: e.target.value })}
                placeholder="Welcome to your agency dashboard. Sign in to manage your campaigns, analytics, and more."
                rows={3}
                className="input w-full text-sm resize-none"
              />
              <p className="text-[9px] text-muted mt-1">Shown on the login page below your logo</p>
            </div>

            {/* Powered By toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-border">
              <div>
                <p className="text-xs font-medium">Show &quot;Powered by ShortStack&quot;</p>
                <p className="text-[10px] text-muted">Display attribution footer in sidebar and client portal</p>
              </div>
              <button onClick={() => setWhiteLabel({ ...whiteLabel, show_powered_by: !whiteLabel.show_powered_by })}
                className={`w-10 h-5 rounded-full transition-colors ${whiteLabel.show_powered_by ? "bg-gold" : "bg-surface-light border border-border"}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${whiteLabel.show_powered_by ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-5 pt-4 border-t border-border">
            <button
              disabled={wlSaving}
              onClick={async () => {
                setWlSaving(true);
                try {
                  const res = await fetch("/api/white-label", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      company_name: whiteLabel.company_name || null,
                      logo_url: whiteLabel.logo_url || null,
                      primary_color: whiteLabel.primary_color || null,
                      accent_color: whiteLabel.accent_color || null,
                      favicon_url: whiteLabel.favicon_url || null,
                      login_text: whiteLabel.login_text || null,
                      show_powered_by: whiteLabel.show_powered_by,
                    }),
                  });
                  if (res.ok) {
                    if (whiteLabel.primary_color && whiteLabel.primary_color !== "#C9A84C") {
                      document.documentElement.style.setProperty("--color-accent", whiteLabel.primary_color);
                      document.documentElement.style.setProperty("--wl-primary", whiteLabel.primary_color);
                    } else {
                      document.documentElement.style.removeProperty("--wl-primary");
                    }
                    if (whiteLabel.accent_color && whiteLabel.accent_color !== "#B8942F") {
                      document.documentElement.style.setProperty("--wl-accent", whiteLabel.accent_color);
                    } else {
                      document.documentElement.style.removeProperty("--wl-accent");
                    }
                    localStorage.setItem("ss_white_label", JSON.stringify(whiteLabel));
                    window.dispatchEvent(new Event("white-label-update"));
                    toast.success("White label branding saved");
                  } else {
                    toast.error("Failed to save — try again");
                  }
                } catch {
                  toast.error("Connection error");
                }
                setWlSaving(false);
              }}
              className="btn-primary text-xs flex items-center gap-2"
            >
              <Save size={12} /> {wlSaving ? "Saving..." : "Save White Label"}
            </button>
            <button
              onClick={() => {
                setWhiteLabel({ company_name: "", logo_url: "", primary_color: "#C9A84C", accent_color: "#B8942F", favicon_url: "", login_text: "", show_powered_by: true, domain: "", support_email: "" });
                toast.success("Reset to defaults — click Save to apply");
              }}
              className="btn-secondary text-xs flex items-center gap-2"
            >
              <RotateCcw size={12} /> Reset to Defaults
            </button>
          </div>
        </div>
      </div>

      {/* Right column — Live Preview */}
      <div className="space-y-4">
        <div className="card-static">
          <h3 className="section-header flex items-center gap-2">
            <Eye size={14} className="text-gold" /> Live Preview
          </h3>
          <p className="text-[9px] text-muted mb-3">How your branding will appear</p>

          {/* Sidebar preview */}
          <div className="rounded-xl border border-border overflow-hidden bg-surface-light">
            <div className="p-3 border-b border-border flex items-center gap-2" style={{ background: "var(--color-surface)" }}>
              {whiteLabel.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={whiteLabel.logo_url} alt="" className="w-6 h-6 rounded object-contain" />
              ) : (
                <div className="w-6 h-6 rounded bg-gold/10 flex items-center justify-center">
                  <Palette size={10} style={{ color: whiteLabel.primary_color || "#C9A84C" }} />
                </div>
              )}
              <span className="text-xs font-bold truncate" style={{ color: "var(--color-foreground)" }}>
                {whiteLabel.company_name || "ShortStack"}
              </span>
            </div>
            <div className="p-2 space-y-0.5">
              {["Dashboard", "Analytics", "CRM", "Clients"].map((item, i) => (
                <div key={item}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] flex items-center gap-2"
                  style={i === 0 ? {
                    color: whiteLabel.primary_color || "#C9A84C",
                    background: `${whiteLabel.primary_color || "#C9A84C"}10`,
                    fontWeight: 600,
                  } : { color: "var(--color-muted)" }}
                >
                  <div className="w-3 h-3 rounded" style={i === 0 ? { background: `${whiteLabel.primary_color || "#C9A84C"}20` } : { background: "var(--color-border)" }} />
                  {item}
                </div>
              ))}
            </div>
            {whiteLabel.show_powered_by && (
              <div className="px-3 py-2 border-t border-border text-center">
                <span className="text-[8px] text-muted">Powered by ShortStack</span>
              </div>
            )}
          </div>

          {/* Button preview */}
          <div className="mt-4 space-y-2">
            <p className="text-[9px] text-muted uppercase tracking-wider font-medium">Buttons</p>
            <div className="flex gap-2">
              <span className="text-[10px] font-semibold px-3 py-1.5 rounded-lg text-white inline-block" style={{ background: whiteLabel.primary_color || "#C9A84C" }}>
                Primary
              </span>
              <span className="text-[10px] font-medium px-3 py-1.5 rounded-lg border inline-block" style={{ borderColor: `${whiteLabel.primary_color || "#C9A84C"}40`, color: whiteLabel.primary_color || "#C9A84C" }}>
                Secondary
              </span>
            </div>
          </div>

          {/* Color swatches */}
          <div className="mt-4 space-y-2">
            <p className="text-[9px] text-muted uppercase tracking-wider font-medium">Accents</p>
            <div className="flex gap-2 items-center">
              <div className="w-4 h-4 rounded-full" style={{ background: whiteLabel.primary_color || "#C9A84C" }} />
              <span className="text-[10px] font-mono" style={{ color: whiteLabel.primary_color || "#C9A84C" }}>{whiteLabel.primary_color || "#C9A84C"}</span>
            </div>
            <div className="flex gap-2 items-center">
              <div className="w-4 h-4 rounded-full" style={{ background: whiteLabel.accent_color || "#B8942F" }} />
              <span className="text-[10px] font-mono" style={{ color: whiteLabel.accent_color || "#B8942F" }}>{whiteLabel.accent_color || "#B8942F"}</span>
            </div>
          </div>

          {/* Login preview */}
          {whiteLabel.login_text && (
            <div className="mt-4 space-y-2">
              <p className="text-[9px] text-muted uppercase tracking-wider font-medium">Login Page</p>
              <div className="p-3 rounded-lg border border-border bg-surface text-center">
                {whiteLabel.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={whiteLabel.logo_url} alt="" className="w-8 h-8 rounded mx-auto mb-2 object-contain" />
                )}
                <p className="text-[10px] text-muted leading-relaxed">{whiteLabel.login_text}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
