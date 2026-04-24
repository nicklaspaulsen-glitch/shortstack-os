"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  MessageSquare,
  Copy,
  Check,
  Palette,
  Sun,
  Moon,
  ExternalLink,
  Loader,
  Globe,
  RefreshCcw,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

/**
 * Chat-widget preview + embed-code copy page.
 *
 * Lists every chat_widgets row the user owns, renders the widget inside a
 * sandboxed iframe so host-page styles stay isolated, and provides a
 * one-click copy button for the <script> embed snippet.
 *
 * Users land here either from the hub-setup flow ("your widget is ready")
 * or from their own settings page to grab the embed code for a new site.
 */

interface ChatWidget {
  id: string;
  domain: string;
  token: string;
  embed_script: string | null;
  created_at: string;
}

type Theme = "light" | "dark";
type Position = "bottom-right" | "bottom-left";

export default function WidgetPreviewPage() {
  const supabase = useMemo(() => createClient(), []);
  const [widgets, setWidgets] = useState<ChatWidget[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<Theme>("light");
  const [primary, setPrimary] = useState("#C9A84C");
  const [position, setPosition] = useState<Position>("bottom-right");
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("chat_widgets")
        .select("id, domain, token, embed_script, created_at")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        toast.error(`Couldn't load widgets: ${error.message}`);
      } else {
        const rows = (data as ChatWidget[] | null) ?? [];
        setWidgets(rows);
        if (rows.length && !selectedToken) setSelectedToken(rows[0].token);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const selected = widgets.find(w => w.token === selectedToken) ?? null;

  // Build the snippet to copy. We regenerate it client-side so users can
  // tweak theme/primary/position without needing a round-trip to the API.
  const embedSnippet = useMemo(() => {
    if (!selected) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return [
      `<!-- ShortStack Chat Widget for ${selected.domain} -->`,
      `<script`,
      `  src="${origin}/widget/chat.js"`,
      `  data-token="${selected.token}"`,
      `  data-theme="${theme}"`,
      `  data-primary="${primary}"`,
      `  data-position="${position}"`,
      `  async`,
      `></script>`,
    ].join("\n");
  }, [selected, theme, primary, position]);

  // Full HTML document piped into the sandboxed iframe. The iframe loads
  // the real widget script so the preview is a true render, not a mock.
  const iframeHtml = useMemo(() => {
    if (!selected) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Widget preview</title>
<style>
  html,body{margin:0;padding:0;height:100%;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#334155}
  .stage{padding:40px 24px;max-width:640px;margin:0 auto}
  .stage h1{font-size:22px;margin:0 0 8px;color:#0f172a}
  .stage p{font-size:13px;line-height:1.6;color:#475569;margin:0 0 14px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-top:16px}
  .hint{font-size:11px;color:#94a3b8;text-align:center;margin-top:40px}
</style>
</head>
<body>
  <div class="stage">
    <h1>${escapeHtml(selected.domain)}</h1>
    <p>This is a simulated customer site. The chat bubble in the corner is the real widget your visitors will see.</p>
    <div class="card">
      <p>Click the bubble to expand the panel, type a message, and see how it behaves. Messages you send here land in your <strong>Conversations</strong> inbox.</p>
    </div>
    <p class="hint">Preview sandbox — styles isolated from the dashboard.</p>
  </div>
  <script
    src="${origin}/widget/chat.js"
    data-token="${escapeAttr(selected.token)}"
    data-theme="${escapeAttr(theme)}"
    data-primary="${escapeAttr(primary)}"
    data-position="${escapeAttr(position)}"
    async
  ></script>
</body>
</html>`;
  }, [selected, theme, primary, position]);

  function handleCopy() {
    if (!embedSnippet) return;
    navigator.clipboard.writeText(embedSnippet).then(
      () => {
        setCopied(true);
        toast.success("Embed code copied");
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("Copy failed — try again"),
    );
  }

  function handleReloadIframe() {
    setIframeKey(k => k + 1);
  }

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<MessageSquare size={28} />}
        title="Chat widget preview"
        subtitle="See the live widget, tweak the style, and copy the embed snippet when you're ready."
        gradient="ocean"
        actions={
          <Link href="/dashboard/domains/hub-setup" className="btn-ghost text-xs">
            Back to hub setup
          </Link>
        }
      />

      {loading && (
        <div className="card flex items-center gap-3">
          <Loader size={16} className="animate-spin text-gold" />
          <p className="text-xs text-muted">Loading your widgets…</p>
        </div>
      )}

      {!loading && widgets.length === 0 && (
        <div className="card text-center py-10">
          <MessageSquare size={28} className="mx-auto text-muted mb-3" />
          <p className="text-sm font-semibold mb-1">No chat widgets yet</p>
          <p className="text-xs text-muted mb-4">
            Provision a domain hub with chat enabled to generate your first widget.
          </p>
          <Link
            href="/dashboard/domains/hub-setup"
            className="btn-primary text-xs inline-flex items-center gap-2"
          >
            Set up a hub <ExternalLink size={12} />
          </Link>
        </div>
      )}

      {!loading && widgets.length > 0 && (
        <>
          {/* Widget selector */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2 mb-0">
              <Globe size={13} className="text-gold" /> Your chat widgets
            </h2>
            <div className="flex gap-2 flex-wrap mt-3">
              {widgets.map(w => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedToken(w.token)}
                  className={`px-3 py-1.5 rounded-lg border text-xs transition ${
                    selectedToken === w.token
                      ? "border-gold/60 bg-gold/10 text-gold"
                      : "border-border bg-surface-light text-muted hover:border-border/60"
                  }`}
                >
                  {w.domain}
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-5 items-start">
            {/* Live preview */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-header flex items-center gap-2 mb-0">
                  <MessageSquare size={13} className="text-gold" /> Live preview
                </h2>
                <button
                  type="button"
                  onClick={handleReloadIframe}
                  title="Reload preview"
                  className="text-[11px] text-muted hover:text-gold flex items-center gap-1"
                >
                  <RefreshCcw size={11} /> reload
                </button>
              </div>
              <div
                className="rounded-xl overflow-hidden border border-border"
                style={{ height: 520 }}
              >
                {selected && (
                  <iframe
                    key={iframeKey}
                    ref={iframeRef}
                    title="Chat widget preview sandbox"
                    sandbox="allow-scripts allow-same-origin"
                    srcDoc={iframeHtml}
                    className="w-full h-full border-0"
                  />
                )}
              </div>
              <p className="text-[10px] text-muted mt-2">
                This iframe runs the real widget script — messages you send here go to your Conversations inbox.
              </p>
            </div>

            {/* Customisation + embed */}
            <div className="space-y-4">
              <div className="card">
                <h2 className="section-header flex items-center gap-2 mb-0">
                  <Palette size={13} className="text-gold" /> Customise
                </h2>

                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wide block mb-1">
                      Theme
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTheme("light")}
                        className={`py-2 rounded-lg border text-xs flex items-center justify-center gap-2 ${
                          theme === "light"
                            ? "border-gold/60 bg-gold/10 text-gold"
                            : "border-border bg-surface-light text-muted"
                        }`}
                      >
                        <Sun size={12} /> Light
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme("dark")}
                        className={`py-2 rounded-lg border text-xs flex items-center justify-center gap-2 ${
                          theme === "dark"
                            ? "border-gold/60 bg-gold/10 text-gold"
                            : "border-border bg-surface-light text-muted"
                        }`}
                      >
                        <Moon size={12} /> Dark
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wide block mb-1">
                      Primary color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={primary}
                        onChange={e => setPrimary(e.target.value)}
                        className="h-9 w-12 rounded border border-border bg-transparent"
                      />
                      <input
                        type="text"
                        value={primary}
                        onChange={e => setPrimary(e.target.value)}
                        className="input flex-1 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wide block mb-1">
                      Position
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPosition("bottom-right")}
                        className={`py-2 rounded-lg border text-xs ${
                          position === "bottom-right"
                            ? "border-gold/60 bg-gold/10 text-gold"
                            : "border-border bg-surface-light text-muted"
                        }`}
                      >
                        Bottom-right
                      </button>
                      <button
                        type="button"
                        onClick={() => setPosition("bottom-left")}
                        className={`py-2 rounded-lg border text-xs ${
                          position === "bottom-left"
                            ? "border-gold/60 bg-gold/10 text-gold"
                            : "border-border bg-surface-light text-muted"
                        }`}
                      >
                        Bottom-left
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="section-header flex items-center gap-2 mb-0">
                    <Copy size={13} className="text-gold" /> Embed code
                  </h2>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="btn-primary text-[11px] px-3 py-1.5 inline-flex items-center gap-1.5"
                    disabled={!embedSnippet}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="text-[10px] leading-relaxed bg-surface-light border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                  {embedSnippet || "—"}
                </pre>
                <p className="text-[10px] text-muted mt-2">
                  Paste inside the <span className="font-mono">&lt;head&gt;</span> of your site. The script is async and under 15 KB.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
