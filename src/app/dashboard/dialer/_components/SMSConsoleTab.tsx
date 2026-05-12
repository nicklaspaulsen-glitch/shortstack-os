"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MessageCircle, Send, Sparkles, Loader2, AlertTriangle, CheckCircle,
  Plus, Trash2, Zap, Mic,
} from "lucide-react";
import StatCard from "@/components/ui/stat-card";
import VoicePicker from "@/components/voice/VoicePicker";

interface SMSTemplate {
  id: string;
  name: string;
  body: string;
  variables: string[];
  category: string | null;
}

type Mode = "single" | "bulk";

interface BulkRecipient {
  to: string;
  first_name?: string;
  company?: string;
}

interface SendResult {
  ok: boolean;
  text: string;
}

const MAX_BULK = 250;

// Insert a {{var}} at the textarea cursor position so the user can compose
// templates fluidly without manual typing.
function insertAtCursor(
  ref: HTMLTextAreaElement | null,
  current: string,
  setValue: (v: string) => void,
  insert: string,
) {
  if (!ref) {
    setValue(current + insert);
    return;
  }
  const start = ref.selectionStart;
  const end = ref.selectionEnd;
  const before = current.slice(0, start);
  const after = current.slice(end);
  setValue(`${before}${insert}${after}`);
  // Restore cursor after the inserted token. Defer to next tick so React
  // has applied the new value.
  requestAnimationFrame(() => {
    if (ref) {
      ref.focus();
      const pos = start + insert.length;
      ref.setSelectionRange(pos, pos);
    }
  });
}

export default function SMSConsoleTab() {
  const [mode, setMode] = useState<Mode>("single");

  // Single
  const [singleTo, setSingleTo] = useState("");
  const [singleName, setSingleName] = useState("");
  const [body, setBody] = useState("");
  const [bodyRef, setBodyRef] = useState<HTMLTextAreaElement | null>(null);

  // Bulk
  const [bulkPaste, setBulkPaste] = useState("");
  const [bulkRecipients, setBulkRecipients] = useState<BulkRecipient[]>([]);
  const [throttleMs, setThrottleMs] = useState(1000);

  // Templates
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Send state
  const [sending, setSending] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [resultBanner, setResultBanner] = useState<SendResult | null>(null);
  const [stats, setStats] = useState({ sent: 0, failed: 0 });

  // Voice MMS toggle
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceCloneId, setVoiceCloneId] = useState<string | null>(null);

  // ── Load templates ────────────────────────────────────────────────
  const loadTemplates = useCallback(async () => {
    setTemplateLoading(true);
    setTemplateError(null);
    try {
      const res = await fetch("/api/sms-templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data.templates) ? data.templates : []);
      } else if (res.status === 404) {
        // Templates endpoint may not exist yet — silent fallback.
        setTemplates([]);
      } else {
        setTemplateError(`Failed to load templates (${res.status})`);
      }
    } catch (err) {
      console.error("[sms-console] template load failed:", err);
      setTemplateError("Failed to load templates");
    }
    setTemplateLoading(false);
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ── Apply template ────────────────────────────────────────────────
  const applyTemplate = useCallback((tpl: SMSTemplate) => {
    setBody(tpl.body);
  }, []);

  // ── Parse bulk recipients ─────────────────────────────────────────
  // Format: "phone, first_name, company" or just "phone" per line.
  const parseBulk = useCallback(() => {
    const lines = bulkPaste
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const next: BulkRecipient[] = [];
    for (const line of lines) {
      const parts = line.split(/[,;\t]/).map((s) => s.trim());
      const phone = parts[0];
      if (!phone) continue;
      next.push({
        to: phone,
        first_name: parts[1] || undefined,
        company: parts[2] || undefined,
      });
    }
    if (next.length > MAX_BULK) {
      setResultBanner({
        ok: false,
        text: `Too many recipients (${next.length}). Max ${MAX_BULK}.`,
      });
      return;
    }
    setBulkRecipients(next);
    setBulkPaste("");
  }, [bulkPaste]);

  // ── Polish body via Claude Haiku ──────────────────────────────────
  const polishBody = useCallback(async () => {
    if (!body.trim() || polishing) return;
    setPolishing(true);
    setResultBanner(null);
    try {
      const res = await fetch("/api/dialer/ai-polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body, channel: "sms" }),
      });
      const data = await res.json();
      if (res.ok && data.text) {
        setBody(data.text);
      } else {
        setResultBanner({ ok: false, text: data.error || "Polish failed" });
      }
    } catch (err) {
      console.error("[sms-console] polish failed:", err);
      setResultBanner({ ok: false, text: "Polish failed" });
    }
    setPolishing(false);
  }, [body, polishing]);

  // ── Send single SMS ───────────────────────────────────────────────
  const sendSingle = useCallback(async () => {
    if (!singleTo.trim() || !body.trim() || sending) return;
    setSending(true);
    setResultBanner(null);
    try {
      const endpoint = voiceMode ? "/api/sms/send-voice" : "/api/sms/send-manual";
      const payload = voiceMode
        ? {
            to: singleTo,
            text: body,
            clone_id: voiceCloneId === "__none__" ? null : voiceCloneId,
            fallback_text: body,
          }
        : {
            to: singleTo,
            body: body,
            contact_name: singleName || undefined,
          };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStats((s) => ({ ...s, sent: s.sent + 1 }));
        setResultBanner({
          ok: true,
          text: voiceMode
            ? `Voice MMS sent to ${data.to}`
            : `Sent to ${data.to}`,
        });
        setBody("");
      } else {
        setStats((s) => ({ ...s, failed: s.failed + 1 }));
        setResultBanner({ ok: false, text: data.error || "Send failed" });
      }
    } catch (err) {
      setStats((s) => ({ ...s, failed: s.failed + 1 }));
      setResultBanner({ ok: false, text: String(err).slice(0, 200) });
    }
    setSending(false);
  }, [singleTo, singleName, body, sending, voiceMode, voiceCloneId]);

  // ── Send bulk SMS ─────────────────────────────────────────────────
  const sendBulk = useCallback(async () => {
    if (bulkRecipients.length === 0 || !body.trim() || sending) return;
    setSending(true);
    setResultBanner(null);
    try {
      const res = await fetch("/api/sms/send-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: bulkRecipients,
          template: body,
          throttle_ms: throttleMs,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStats((s) => ({ ...s, sent: s.sent + data.sent, failed: s.failed + data.failed }));
        setResultBanner({
          ok: true,
          text: `Sent ${data.sent}, failed ${data.failed} (${data.total} total).`,
        });
      } else {
        setResultBanner({ ok: false, text: data.error || "Bulk send failed" });
      }
    } catch (err) {
      setResultBanner({ ok: false, text: String(err).slice(0, 200) });
    }
    setSending(false);
  }, [bulkRecipients, body, throttleMs, sending]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Sent" value={stats.sent} icon={<Send size={16} />} />
        <StatCard label="Failed" value={stats.failed} icon={<AlertTriangle size={16} />} />
        <StatCard label="Templates" value={templates.length} icon={<MessageCircle size={16} />} />
      </div>

      <div className="flex gap-2">
        <ModeToggle mode={mode} setMode={setMode} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Compose pane */}
        <section className="lg:col-span-2">
          <div className="rounded-xl border border-black/[0.06] bg-white p-5">
            {mode === "single" ? (
              <>
                <h3 className="text-sm font-semibold text-[#111827]">Single SMS</h3>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="tel"
                    value={singleTo}
                    onChange={(e) => setSingleTo(e.target.value)}
                    placeholder="+1 555 123 4567"
                    className="rounded-lg border border-black/[0.08] bg-[#F8FAFC] px-3 py-2 text-sm text-[#111827] placeholder:text-text-muted focus:border-orange-400/50 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    placeholder="Recipient name (optional)"
                    className="rounded-lg border border-black/[0.08] bg-[#F8FAFC] px-3 py-2 text-sm text-[#111827] placeholder:text-text-muted focus:border-orange-400/50 focus:outline-none"
                  />
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-[#111827]">Bulk SMS</h3>
                <p className="mt-1 text-xs text-[#6B7280]">
                  Throttle is enforced server-side (min 100ms). Max {MAX_BULK} recipients per send.
                </p>
                <textarea
                  value={bulkPaste}
                  onChange={(e) => setBulkPaste(e.target.value)}
                  placeholder="One per line: phone, first_name, company"
                  rows={4}
                  className="mt-3 w-full rounded-lg border border-black/[0.08] bg-[#F8FAFC] px-3 py-2 text-sm text-[#111827] placeholder:text-text-muted focus:border-orange-400/50 focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={parseBulk}
                    disabled={!bulkPaste.trim()}
                    className="flex items-center gap-2 rounded-lg bg-orange-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-black/[0.04] disabled:text-text-muted"
                  >
                    <Plus size={12} /> Add {bulkPaste.split(/\r?\n/).filter(Boolean).length} recipient(s)
                  </button>
                  {bulkRecipients.length > 0 && (
                    <span className="text-xs text-[#6B7280]">
                      Loaded: <span className="text-[#111827]">{bulkRecipients.length}</span>
                    </span>
                  )}
                  {bulkRecipients.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBulkRecipients([])}
                      className="ml-auto flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#111827]"
                    >
                      <Trash2 size={12} /> Clear
                    </button>
                  )}
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs text-[#6B7280]">
                  <Zap size={12} /> Throttle (ms between sends):
                  <input
                    type="number"
                    value={throttleMs}
                    min={100}
                    step={100}
                    onChange={(e) => setThrottleMs(Math.max(100, Number(e.target.value) || 1000))}
                    className="w-24 rounded-md border border-black/[0.08] bg-[#F8FAFC] px-2 py-1 font-mono text-[#111827]"
                  />
                </label>
              </>
            )}

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs uppercase tracking-wider text-text-muted">
                  {mode === "single" ? "Message" : "Template"}
                </label>
                <div className="flex items-center gap-1">
                  <PersonalizeButton
                    onClick={() =>
                      insertAtCursor(bodyRef, body, setBody, "{{first_name}}")
                    }
                  >
                    {"{{first_name}}"}
                  </PersonalizeButton>
                  <PersonalizeButton
                    onClick={() =>
                      insertAtCursor(bodyRef, body, setBody, "{{company}}")
                    }
                  >
                    {"{{company}}"}
                  </PersonalizeButton>
                </div>
              </div>
              <textarea
                ref={(el) => setBodyRef(el)}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={
                  mode === "single"
                    ? "Type your SMS message..."
                    : "Use {{first_name}} and {{company}} for personalisation."
                }
                rows={6}
                className="w-full rounded-lg border border-black/[0.08] bg-[#F8FAFC] px-3 py-2 text-sm text-[#111827] placeholder:text-text-muted focus:border-orange-400/50 focus:outline-none"
              />
              <div className="mt-1 flex items-center justify-between text-xs text-text-muted">
                <span>{body.length} chars</span>
                <span>
                  {body.length <= 160 ? "1 segment" : `${Math.ceil(body.length / 153)} segments`}
                </span>
              </div>

              {/* Voice MMS toggle — synthesises body via voice clone + sends MMS audio. */}
              {mode === "single" && (
                <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-50 p-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-amber-700">
                    <input
                      type="checkbox"
                      checked={voiceMode}
                      onChange={(e) => setVoiceMode(e.target.checked)}
                      className="h-3 w-3 rounded border border-black/[0.08] bg-[#F8FAFC] text-amber-500 focus:ring-amber-400"
                    />
                    <Mic size={12} />
                    Send as voice MMS (carrier-dependent)
                  </label>
                  {voiceMode && (
                    <div className="mt-2">
                      <VoicePicker
                        value={voiceCloneId}
                        onChange={setVoiceCloneId}
                        surface="sms"
                        compact
                      />
                      <p className="mt-2 text-[11px] text-amber-600">
                        We&apos;ll synthesise the message above with the chosen voice
                        and send it as an audio MMS. Some carriers reject MMS audio
                        — when that happens we send the text as a fallback.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={polishBody}
                disabled={!body.trim() || polishing}
                className="flex items-center gap-2 rounded-lg border border-black/[0.06] bg-[rgba(0,0,0,0.06)] px-3 py-2 text-sm font-medium text-[#111827] hover:bg-[rgba(0,0,0,0.10)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {polishing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                Polish with AI
              </button>
              <button
                type="button"
                onClick={mode === "single" ? sendSingle : sendBulk}
                disabled={
                  sending ||
                  !body.trim() ||
                  (mode === "single" ? !singleTo.trim() : bulkRecipients.length === 0)
                }
                className="ml-auto flex items-center gap-2 rounded-lg bg-orange-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-black/[0.04] disabled:text-text-muted"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {mode === "single" ? "Send SMS" : `Send to ${bulkRecipients.length}`}
              </button>
            </div>

            {resultBanner && (
              <div
                className={`mt-3 flex items-start gap-2 rounded-lg border p-3 text-sm ${
                  resultBanner.ok
                    ? "border-emerald-500/30 bg-emerald-50 text-emerald-700"
                    : "border-rose-500/30 bg-rose-50 text-rose-700"
                }`}
              >
                {resultBanner.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                <span>{resultBanner.text}</span>
              </div>
            )}
          </div>
        </section>

        {/* Templates pane */}
        <section className="lg:col-span-1">
          <div className="rounded-xl border border-black/[0.06] bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111827]">Templates</h3>
              <button
                type="button"
                onClick={loadTemplates}
                className="text-xs text-[#6B7280] hover:text-[#111827]"
              >
                Refresh
              </button>
            </div>
            {templateLoading && (
              <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                <Loader2 size={12} className="animate-spin" /> Loading...
              </div>
            )}
            {templateError && (
              <div className="text-xs text-rose-600">{templateError}</div>
            )}
            {!templateLoading && templates.length === 0 && !templateError && (
              <div className="text-xs text-[#6B7280]">
                No templates yet. Create them on{" "}
                <a
                  href="/dashboard/sms-templates"
                  className="text-orange-500 hover:underline"
                >
                  /dashboard/sms-templates
                </a>
                .
              </div>
            )}
            <ul className="space-y-2">
              {templates.map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="w-full rounded-lg border border-black/[0.06] bg-black/[0.04] p-2 text-left text-xs hover:border-orange-400/40 hover:bg-orange-500/5"
                  >
                    <div className="text-sm font-medium text-[#111827]">{tpl.name}</div>
                    <div className="mt-1 line-clamp-2 text-[#6B7280]">{tpl.body}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  setMode,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-black/[0.06] bg-black/[0.04] p-1">
      <button
        type="button"
        onClick={() => setMode("single")}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          mode === "single"
            ? "bg-white text-[#111827] shadow-sm"
            : "text-[#6B7280] hover:text-[#111827]"
        }`}
      >
        Single
      </button>
      <button
        type="button"
        onClick={() => setMode("bulk")}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          mode === "bulk"
            ? "bg-white text-[#111827] shadow-sm"
            : "text-[#6B7280] hover:text-[#111827]"
        }`}
      >
        Bulk
      </button>
    </div>
  );
}

function PersonalizeButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-black/[0.06] bg-black/[0.04] px-2 py-0.5 font-mono text-[10px] text-[#374151] hover:border-orange-400/40 hover:text-[#111827]"
    >
      {children}
    </button>
  );
}
