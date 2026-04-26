"use client";

import { useCallback, useState } from "react";
import {
  Send, Sparkles, Loader2, AlertTriangle, CheckCircle,
  AtSign, Hash, Globe, MessageCircle, Share2,
} from "lucide-react";
import StatCard from "@/components/ui/stat-card";

// Platform metadata — kept inline so we don't pull in an entire
// integration registry just for the icon + label. Lucide doesn't ship
// brand icons (Instagram/Facebook/etc), so we use generic glyphs.
const PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: <AtSign size={14} /> },
  { value: "facebook", label: "Facebook", icon: <Share2 size={14} /> },
  { value: "linkedin", label: "LinkedIn", icon: <Globe size={14} /> },
  { value: "twitter", label: "Twitter / X", icon: <Hash size={14} /> },
  { value: "tiktok", label: "TikTok", icon: <MessageCircle size={14} /> },
] as const;

type PlatformValue = (typeof PLATFORMS)[number]["value"];

interface SendResult {
  ok: boolean;
  text: string;
}

export default function DMComposerTab() {
  const [platform, setPlatform] = useState<PlatformValue>("instagram");
  const [handle, setHandle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [resultBanner, setResultBanner] = useState<SendResult | null>(null);
  const [stats, setStats] = useState({ sent: 0, queued: 0, failed: 0 });

  // ── AI polish ─────────────────────────────────────────────────────
  // Channel="dm" so the system prompt biases toward longer, low-pressure
  // copy than the SMS variant. Same Haiku model (cheap).
  const polishMessage = useCallback(async () => {
    if (!message.trim() || polishing) return;
    setPolishing(true);
    setResultBanner(null);
    try {
      const res = await fetch("/api/dialer/ai-polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: message,
          channel: "dm",
          platform,
          context: handle ? `recipient handle: @${handle}` : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.text) {
        setMessage(data.text);
      } else {
        setResultBanner({ ok: false, text: data.error || "Polish failed" });
      }
    } catch (err) {
      console.error("[dm-composer] polish failed:", err);
      setResultBanner({ ok: false, text: "Polish failed" });
    }
    setPolishing(false);
  }, [message, platform, handle, polishing]);

  // ── Send ──────────────────────────────────────────────────────────
  const sendDm = useCallback(async () => {
    if (!handle.trim() || !message.trim() || sending) return;
    setSending(true);
    setResultBanner(null);
    try {
      const res = await fetch("/api/dm/send-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          handle: handle.replace(/^@/, ""),
          message,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStats((s) => ({ ...s, sent: s.sent + 1 }));
        setResultBanner({ ok: true, text: `Sent DM to @${data.handle} on ${platform}` });
        setMessage("");
        setHandle("");
      } else if (data.queued) {
        setStats((s) => ({ ...s, queued: s.queued + 1 }));
        setResultBanner({
          ok: true,
          text: data.reason || "DM queued for later send",
        });
      } else {
        setStats((s) => ({ ...s, failed: s.failed + 1 }));
        setResultBanner({ ok: false, text: data.error || "Send failed" });
      }
    } catch (err) {
      setStats((s) => ({ ...s, failed: s.failed + 1 }));
      setResultBanner({ ok: false, text: String(err).slice(0, 200) });
    }
    setSending(false);
  }, [platform, handle, message, sending]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="DMs sent" value={stats.sent} icon={<Send size={16} />} />
        <StatCard label="Queued" value={stats.queued} icon={<Loader2 size={16} />} />
        <StatCard label="Failed" value={stats.failed} icon={<AlertTriangle size={16} />} />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-sm font-semibold text-white">Compose direct message</h3>
        <p className="mt-1 text-xs text-white/50">
          Sends via Zernio. When ZERNIO_API_KEY is missing the DM is queued in
          outreach_log so you can replay it later.
        </p>

        <div className="mt-4">
          <label className="text-xs uppercase tracking-wider text-white/40">Platform</label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {PLATFORMS.map((p) => {
              const isActive = platform === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPlatform(p.value)}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-orange-400/60 bg-orange-500/10 text-orange-100"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {p.icon}
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-wider text-white/40">
              Recipient handle
            </label>
            <div className="mt-1 flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-3">
              <span className="text-white/40">@</span>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="username"
                className="flex-1 bg-transparent py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs uppercase tracking-wider text-white/40">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hey, I came across your profile and..."
            rows={6}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-orange-400/50 focus:outline-none"
          />
          <div className="mt-1 text-xs text-white/40">{message.length} / 2000 chars</div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={polishMessage}
            disabled={!message.trim() || polishing}
            className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
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
            onClick={sendDm}
            disabled={sending || !handle.trim() || !message.trim()}
            className="ml-auto flex items-center gap-2 rounded-lg bg-orange-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/40"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send DM
          </button>
        </div>

        {resultBanner && (
          <div
            className={`mt-3 flex items-start gap-2 rounded-lg border p-3 text-sm ${
              resultBanner.ok
                ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-200"
                : "border-rose-500/30 bg-rose-950/40 text-rose-200"
            }`}
          >
            {resultBanner.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            <span>{resultBanner.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
