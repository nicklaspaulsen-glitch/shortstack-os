"use client";
import { ArrowCounterClockwise, CircleNotch, CodeSimple, Envelope, Eye, FloppyDisk, Info, PaperPlaneTilt, Sparkle } from "@phosphor-icons/react";

/**
 * Settings → Branded email templates editor.
 *
 * Per-agency editor for the five transactional emails clients/team members
 * receive. Defaults ship pre-filled — every kind always has working copy.
 * The agency can override subject, preview text, HTML, plain text, CTA
 * label, and CTA URL template; reverting clears the row and restores the
 * default.
 *
 * Layout:
 *   - PageHero (plum) with title + actions
 *   - Tab strip across the five kinds
 *   - Two-pane editor: form on the left, live preview iframe on the right
 *   - Actions: Reset to default, PaperPlaneTilt test (to caller's email), FloppyDisk
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { MotionPage } from "@/components/motion/motion-page";

// ── Types ────────────────────────────────────────────────────────────────

type EmailTemplateKind =
  | "client_welcome"
  | "team_invite"
  | "trial_signup"
  | "plan_purchase"
  | "plan_cancelled"
  | "magic_link"
  | "password_reset";

interface EmailTemplate {
  id?: string;
  kind: EmailTemplateKind;
  subject: string;
  preview_text: string | null;
  html_body: string;
  plain_body: string;
  cta_label: string | null;
  cta_url_template: string | null;
  is_default: boolean;
  updated_at?: string;
}

const KIND_LABELS: Record<EmailTemplateKind, string> = {
  client_welcome: "Client Welcome",
  team_invite: "Team Invite",
  trial_signup: "Trial Signup",
  plan_purchase: "Plan Purchased",
  plan_cancelled: "Plan Cancelled",
  magic_link: "Magic Link",
  password_reset: "Password Reset",
};

const KIND_DESCRIPTIONS: Record<EmailTemplateKind, string> = {
  client_welcome:
    "Sent the moment you add a new client. First impression — keep it warm and concrete.",
  team_invite:
    "Sent when you invite a teammate. They click the button, they're in.",
  trial_signup:
    "Sent when a prospect starts a trial. Nudge them to actually try the product.",
  plan_purchase:
    "Sent when a client picks a payment plan. Congratulate them and get them oriented fast.",
  plan_cancelled:
    "Sent when a client's subscription is cancelled. Warm off-ramp — keeps the door open.",
  magic_link:
    "Passwordless sign-in email. Overrides Supabase's default template.",
  password_reset:
    "Password reset email. Overrides Supabase's default template.",
};

const AVAILABLE_VARS: { key: string; example: string; note: string }[] = [
  { key: "agency_name", example: "Your Agency", note: "Your branded name" },
  { key: "logo_url", example: "https://...", note: "Agency logo URL" },
  { key: "brand_color", example: "#5E5BFF", note: "Hex color for buttons + links" },
  { key: "owner_first_name", example: "Sam", note: "Your first name" },
  { key: "owner_email", example: "you@youragency.com", note: "Your reply-to email" },
  { key: "client_first_name", example: "Alex", note: "Client first name" },
  { key: "client_email", example: "alex@clientco.com", note: "Client email" },
  { key: "client_business_name", example: "Client Co", note: "Client's business" },
  { key: "team_member_first_name", example: "Jordan", note: "Team member first name" },
  { key: "portal_url", example: "https://app.../portal", note: "Their portal URL" },
  { key: "login_url", example: "https://app.../login", note: "Sign-in URL" },
  { key: "getting_started_url", example: "https://app.../getting-started/...", note: "Public docs page" },
  { key: "magic_link_url", example: "https://...", note: "One-shot sign-in URL" },
  { key: "reset_url", example: "https://...", note: "One-shot password reset URL" },
  { key: "invite_url", example: "https://...", note: "One-shot team invite URL" },
  { key: "plan_name", example: "Pro", note: "Plan tier name (plan_purchase + plan_cancelled)" },
  { key: "plan_amount", example: "$297/mo", note: "Formatted plan price" },
  { key: "billing_cycle", example: "monthly", note: "monthly or yearly" },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Main component ───────────────────────────────────────────────────────

export default function EmailTemplatesPage() {
  const [activeKind, setActiveKind] = useState<EmailTemplateKind>("client_welcome");
  const [templates, setTemplates] = useState<Record<EmailTemplateKind, EmailTemplate> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showVars, setShowVars] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "html">("preview");

  // Edit buffer — what's in the form right now (may not match `templates[activeKind]` yet).
  const [draft, setDraft] = useState<EmailTemplate | null>(null);
  const debouncedDraft = useDebouncedValue(draft, 350);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewSubject, setPreviewSubject] = useState<string>("");

  // ── Load all templates on mount ──────────────────────────────────────
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/branded-emails", { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as { templates: EmailTemplate[] };
      const map = json.templates.reduce<Record<string, EmailTemplate>>((acc, t) => {
        acc[t.kind] = t;
        return acc;
      }, {});
      setTemplates(map as Record<EmailTemplateKind, EmailTemplate>);
    } catch (err) {
      console.error("[email-templates] load failed", err);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // ── Sync draft when active kind changes ──────────────────────────────
  useEffect(() => {
    if (templates?.[activeKind]) {
      setDraft({ ...templates[activeKind] });
    }
  }, [activeKind, templates]);

  // ── Live preview render ──────────────────────────────────────────────
  useEffect(() => {
    if (!debouncedDraft) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/branded-emails/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html_body: debouncedDraft.html_body,
            plain_body: debouncedDraft.plain_body,
            subject: debouncedDraft.subject,
            preview_text: debouncedDraft.preview_text,
            cta_label: debouncedDraft.cta_label,
            cta_url_template: debouncedDraft.cta_url_template,
          }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setPreviewHtml(json.html as string);
          setPreviewSubject(json.subject as string);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[email-templates] preview failed", err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedDraft]);

  // ── Actions ──────────────────────────────────────────────────────────
  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/branded-emails/${activeKind}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: draft.subject,
          html_body: draft.html_body,
          plain_body: draft.plain_body,
          preview_text: draft.preview_text,
          cta_label: draft.cta_label,
          cta_url_template: draft.cta_url_template,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `status ${res.status}`);
      }
      toast.success("Template saved");
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "FloppyDisk failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("Revert this template to the default? Your customizations will be lost.")) {
      return;
    }
    setResetting(true);
    try {
      const res = await fetch(`/api/branded-emails/${activeKind}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success("Reverted to default");
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      toast.error(msg);
    } finally {
      setResetting(false);
    }
  }

  async function handleTestSend() {
    if (!draft) return;
    setTestSending(true);
    try {
      const res = await fetch(`/api/branded-emails/${activeKind}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: draft.subject,
          html_body: draft.html_body,
          plain_body: draft.plain_body,
          preview_text: draft.preview_text,
          cta_label: draft.cta_label,
          cta_url_template: draft.cta_url_template,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `status ${res.status}`);
      }
      toast.success(`Test sent to ${json.to}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Test send failed";
      toast.error(msg);
    } finally {
      setTestSending(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────
  const isCustomized = useMemo(() => draft && !draft.is_default, [draft]);

  return (
    <MotionPage className="min-h-screen pb-16">{/* -- Branded email templates command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">Settings</p>
        <h1 className="text-2xl font-display font-bold text-text-primary">Branded email templates</h1>
      </div>
    </div><div className="px-6 lg:px-10 mt-6">
              {/* Tab strip */}
              <div className="flex flex-wrap gap-2 mb-6">
                {(Object.keys(KIND_LABELS) as EmailTemplateKind[]).map((kind) => {
                  const tmpl = templates?.[kind];
                  const customized = tmpl && !tmpl.is_default;
                  const active = kind === activeKind;
                  return (
                    <button
                      key={kind}
                      onClick={() => setActiveKind(kind)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all border
                  ${active
                          ? "bg-brand-lime text-black border-brand-lime"
                          : "bg-surface-1 text-text-secondary border-border-subtle hover:border-border-strong hover:text-text-primary"}`}
                    >
                      {KIND_LABELS[kind]}
                      {customized && (
                        <span className={`ml-2 inline-block w-1.5 h-1.5 rounded-full ${active ? "bg-black" : "bg-brand-lime"}`} />
                      )}
                    </button>
                  );
                })}
              </div>

              {loading || !draft ? (
                <div className="flex items-center justify-center py-24 text-text-secondary">
                  <CircleNotch className="w-5 h-5 animate-spin mr-2" />
                  Loading templates...
                </div>
              ) : (
                <>
                  <div className=" bg-surface-1 border border-border-subtle p-5 mb-6">
                    <p className="text-sm text-text-secondary leading-relaxed">
                      <Info size={14} className="inline mr-1.5 -mt-0.5" />
                      {KIND_DESCRIPTIONS[activeKind]}
                      {isCustomized ? (
                        <span className="ml-2 text-brand-lime font-medium">Customized</span>
                      ) : (
                        <span className="ml-2 text-text-muted">Using default</span>
                      )}
                    </p>
                  </div>

                  {/* Two-pane editor */}
                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left: form */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
                          Subject line
                        </label>
                        <input
                          type="text"
                          value={draft.subject}
                          onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-lg bg-surface-1 border border-border-subtle text-text-primary text-sm focus:border-brand-lime focus:outline-none"
                          maxLength={200}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
                          Preview text (inbox preview)
                        </label>
                        <input
                          type="text"
                          value={draft.preview_text || ""}
                          onChange={(e) => setDraft({ ...draft, preview_text: e.target.value })}
                          placeholder="A quick tour to help you get oriented."
                          className="w-full px-3 py-2.5 rounded-lg bg-surface-1 border border-border-subtle text-text-primary text-sm focus:border-brand-lime focus:outline-none"
                          maxLength={200}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
                            CTA label
                          </label>
                          <input
                            type="text"
                            value={draft.cta_label || ""}
                            onChange={(e) => setDraft({ ...draft, cta_label: e.target.value })}
                            placeholder="Open your portal"
                            className="w-full px-3 py-2.5 rounded-lg bg-surface-1 border border-border-subtle text-text-primary text-sm focus:border-brand-lime focus:outline-none"
                            maxLength={80}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
                            CTA URL template
                          </label>
                          <input
                            type="text"
                            value={draft.cta_url_template || ""}
                            onChange={(e) => setDraft({ ...draft, cta_url_template: e.target.value })}
                            placeholder="{{portal_url}}"
                            className="w-full px-3 py-2.5 rounded-lg bg-surface-1 border border-border-subtle text-text-primary font-mono text-sm focus:border-brand-lime focus:outline-none"
                            maxLength={500}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
                          HTML body
                        </label>
                        <textarea
                          value={draft.html_body}
                          onChange={(e) => setDraft({ ...draft, html_body: e.target.value })}
                          className="w-full h-72 px-3 py-2.5 rounded-lg bg-surface-1 border border-border-subtle text-text-primary font-mono text-xs leading-relaxed focus:border-brand-lime focus:outline-none"
                          spellCheck={false}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
                          Plain text fallback
                        </label>
                        <textarea
                          value={draft.plain_body}
                          onChange={(e) => setDraft({ ...draft, plain_body: e.target.value })}
                          className="w-full h-32 px-3 py-2.5 rounded-lg bg-surface-1 border border-border-subtle text-text-primary font-mono text-xs leading-relaxed focus:border-brand-lime focus:outline-none"
                          spellCheck={false}
                        />
                      </div>

                      {/* Variable reference */}
                      <button
                        onClick={() => setShowVars(!showVars)}
                        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                      >
                        <Sparkle size={14} />
                        Available variables ({AVAILABLE_VARS.length})
                        <span className="text-xs">{showVars ? "▼" : "▶"}</span>
                      </button>
                      {showVars && (
                        <div className="rounded-lg bg-surface-1 border border-border-subtle p-3 max-h-64 overflow-y-auto">
                          <table className="w-full text-xs">
                            <tbody>
                              {AVAILABLE_VARS.map((v) => (
                                <tr key={v.key} className="border-b border-border-subtle last:border-0">
                                  <td className="py-1.5 pr-3 font-mono text-brand-lime">
                                    {`{{${v.key}}}`}
                                  </td>
                                  <td className="py-1.5 pr-3 text-text-secondary">{v.example}</td>
                                  <td className="py-1.5 text-text-muted">{v.note}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-border-subtle">
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-lime text-black text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {saving ? <CircleNotch size={14} className="animate-spin" /> : <FloppyDisk size={14} />}
                          FloppyDisk
                        </button>
                        <button
                          onClick={handleTestSend}
                          disabled={testSending}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-2 border border-border-subtle text-text-primary text-sm font-medium hover:border-border-strong transition-colors disabled:opacity-50"
                        >
                          {testSending ? <CircleNotch size={14} className="animate-spin" /> : <PaperPlaneTilt size={14} />}
                          PaperPlaneTilt test to me
                        </button>
                        {isCustomized && (
                          <button
                            onClick={handleReset}
                            disabled={resetting}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-2 border border-border-subtle text-text-secondary text-sm font-medium hover:border-border-strong transition-colors disabled:opacity-50"
                          >
                            {resetting ? <CircleNotch size={14} className="animate-spin" /> : <ArrowCounterClockwise size={14} />}
                            Reset to default
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right: live preview */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-text-primary">Live preview</h3>
                        <div className="flex gap-1 p-0.5 rounded-lg bg-surface-1 border border-border-subtle">
                          <button
                            onClick={() => setViewMode("preview")}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all
                        ${viewMode === "preview" ? "bg-surface-3 text-text-primary" : "text-text-muted hover:text-text-secondary"}`}
                          >
                            <Eye size={12} /> Rendered
                          </button>
                          <button
                            onClick={() => setViewMode("html")}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all
                        ${viewMode === "html" ? "bg-surface-3 text-text-primary" : "text-text-muted hover:text-text-secondary"}`}
                          >
                            <CodeSimple size={12} /> HTML
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg bg-surface-1 border border-border-subtle overflow-hidden">
                        {/* Email-client-style header */}
                        <div className="px-4 py-3 border-b border-border-subtle">
                          <p className="text-xs text-text-muted mb-0.5">Subject</p>
                          <p className="text-sm font-semibold text-text-primary truncate">
                            {previewSubject || draft.subject || "(no subject)"}
                          </p>
                        </div>

                        {viewMode === "preview" ? (
                          <PreviewIframe html={previewHtml} />
                        ) : (
                          <pre className="p-4 text-xs font-mono text-text-primary whitespace-pre-wrap break-all max-h-[640px] overflow-auto">
                            {previewHtml}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div></MotionPage>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function PreviewIframe({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [html]);

  return (
    <iframe
      ref={ref}
      title="Email preview"
      sandbox="allow-same-origin"
      className="w-full bg-white"
      style={{ height: "640px", border: 0 }}
    />
  );
}
