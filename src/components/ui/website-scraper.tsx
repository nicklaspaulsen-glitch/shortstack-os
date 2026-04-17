"use client";

import { useState } from "react";
import {
  Globe,
  Loader2,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Tag,
  ImageIcon,
  Building,
  Megaphone,
  Users,
  Zap,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";

/* ─── Types (mirror /api/scrape/website response) ────────────────────── */
export interface ScrapedSocialLink { platform: string; url: string }

export interface ScrapedExtraction {
  businessName: string;
  description: string;
  logo: string;
  primaryColor: string | null;
  ogImage: string;
  socialLinks: ScrapedSocialLink[];
  phones: string[];
  emails: string[];
  address: string | null;
  keywords: string[];
  services: string[];
  techStack: string[];
}

export interface ScrapedAIAnalysis {
  industry: string;
  audience: string;
  valueProposition: string;
  services: string[];
  brandVoice: string;
  estimatedSize: string;
}

export interface WebsiteScrapeResult {
  url: string;
  extracted: ScrapedExtraction;
  ai: ScrapedAIAnalysis | null;
}

interface WebsiteScraperProps {
  /** Optional initial URL value */
  defaultUrl?: string;
  /** Called when the user clicks "Use this data" */
  onExtract?: (data: WebsiteScrapeResult) => void;
  /** Optional CTA label (default: "Use this data") */
  ctaLabel?: string;
  /** Compact mode hides the descriptive header text */
  compact?: boolean;
  /** Optional className for wrapper */
  className?: string;
}

/**
 * Reusable website data extractor card.
 * Posts to /api/scrape/website and renders the extraction + AI analysis.
 */
export default function WebsiteScraper({
  defaultUrl = "",
  onExtract,
  ctaLabel = "Use this data",
  compact = false,
  className = "",
}: WebsiteScraperProps) {
  const [url, setUrl] = useState(defaultUrl);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WebsiteScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("Enter a website URL");
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/scrape/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const msg = data?.error || `Analysis failed (${res.status})`;
        setError(msg);
        toast.error(msg);
      } else {
        setResult({
          url: data.url,
          extracted: data.extracted,
          ai: data.ai ?? null,
        });
        toast.success("Website analyzed");
      }
    } catch {
      const msg = "Network error — couldn't reach the analyzer";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`card space-y-4 ${className}`}>
      {!compact && (
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center text-gold shrink-0">
            <Globe size={16} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">Extract data from a website</h3>
            <p className="text-[10px] text-muted mt-0.5">
              Paste any business URL — we&apos;ll pull contact info, social links, brand colors, and infer industry, audience and brand voice.
            </p>
          </div>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !loading) void analyze(); }}
            placeholder="https://example.com"
            disabled={loading}
            className="input w-full pl-9 text-sm"
          />
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="btn-primary text-xs px-4 py-2 flex items-center gap-2 disabled:opacity-60"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-danger/10 border border-danger/20 text-[11px] text-danger">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <ResultCard
          result={result}
          onUse={onExtract ? () => onExtract(result) : undefined}
          ctaLabel={ctaLabel}
        />
      )}
    </div>
  );
}

/* ─── Result Card ───────────────────────────────────────────────────── */
function ResultCard({
  result,
  onUse,
  ctaLabel,
}: {
  result: WebsiteScrapeResult;
  onUse?: () => void;
  ctaLabel: string;
}) {
  const { extracted: x, ai } = result;

  return (
    <div className="rounded-xl border border-border bg-surface-light/40 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        {x.logo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={x.logo}
            alt="Logo"
            className="w-12 h-12 rounded-lg object-contain bg-surface border border-border/30"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-surface border border-border/30 flex items-center justify-center">
            <Building size={16} className="text-muted" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{x.businessName || "Unknown business"}</p>
          {x.description && (
            <p className="text-[11px] text-muted leading-snug line-clamp-2 mt-0.5">{x.description}</p>
          )}
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-gold hover:underline mt-1"
          >
            {result.url} <ExternalLink size={9} />
          </a>
        </div>
        {x.primaryColor && (
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div
              className="w-7 h-7 rounded-md border border-border/40 shadow-inner"
              style={{ background: x.primaryColor }}
              title={`Primary color: ${x.primaryColor}`}
            />
            <p className="text-[8px] font-mono text-muted">{x.primaryColor}</p>
          </div>
        )}
      </div>

      {/* AI summary */}
      {ai && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field icon={<Megaphone size={11} />} label="Industry" value={ai.industry} />
          <Field icon={<Users size={11} />} label="Audience" value={ai.audience} />
          <Field icon={<Sparkles size={11} />} label="Value prop" value={ai.valueProposition} className="md:col-span-2" />
          <Field icon={<Tag size={11} />} label="Brand voice" value={ai.brandVoice} />
          <Field icon={<Building size={11} />} label="Estimated size" value={ai.estimatedSize} />
          {ai.services.length > 0 && (
            <div className="md:col-span-2">
              <p className="text-[9px] uppercase tracking-wider text-muted mb-1">AI-detected services</p>
              <div className="flex flex-wrap gap-1.5">
                {ai.services.map((s, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contact + socials */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
        <ListBlock icon={<Phone size={11} />} label="Phones" items={x.phones} empty="No phone found" />
        <ListBlock icon={<Mail size={11} />} label="Emails" items={x.emails} empty="No email found" />
        <ListBlock
          icon={<MapPin size={11} />}
          label="Address"
          items={x.address ? [x.address] : []}
          empty="No address found"
        />
      </div>

      {x.socialLinks.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted mb-1">Socials</p>
          <div className="flex flex-wrap gap-1.5">
            {x.socialLinks.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] px-2 py-0.5 rounded-md bg-surface border border-border hover:border-gold/30 capitalize"
              >
                {s.platform}
              </a>
            ))}
          </div>
        </div>
      )}

      {x.techStack.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted mb-1">Tech stack</p>
          <div className="flex flex-wrap gap-1.5">
            {x.techStack.map((t, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-info/10 text-info border border-info/20">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {x.keywords.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted mb-1">Keywords</p>
          <div className="flex flex-wrap gap-1">
            {x.keywords.slice(0, 12).map((k, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-surface border border-border/30 text-muted">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {x.ogImage && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted mb-1 flex items-center gap-1">
            <ImageIcon size={10} /> Open Graph image
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={x.ogImage}
            alt="OG"
            className="rounded-lg max-h-32 border border-border/30"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      {onUse && (
        <div className="flex justify-end pt-2 border-t border-border/30">
          <button onClick={onUse} className="btn-primary text-xs px-4 py-1.5 flex items-center gap-2">
            <Zap size={12} /> {ctaLabel}
          </button>
        </div>
      )}

      {!ai && (
        <p className="text-[10px] text-muted flex items-center gap-1">
          <CheckCircle2 size={10} className="text-success" /> Extracted without AI summary (analysis unavailable).
        </p>
      )}
    </div>
  );
}

/* ─── Tiny presentational helpers ───────────────────────────────────── */
function Field({
  icon,
  label,
  value,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`p-2.5 rounded-lg bg-surface border border-border/30 ${className}`}>
      <p className="text-[9px] uppercase tracking-wider text-muted flex items-center gap-1 mb-0.5">
        {icon} {label}
      </p>
      <p className="text-[11px] capitalize-first">{value}</p>
    </div>
  );
}

function ListBlock({
  icon,
  label,
  items,
  empty,
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="p-2.5 rounded-lg bg-surface border border-border/30">
      <p className="text-[9px] uppercase tracking-wider text-muted flex items-center gap-1 mb-1">
        {icon} {label}
      </p>
      {items.length === 0 ? (
        <p className="text-[10px] text-muted/70">{empty}</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((it, i) => (
            <li key={i} className="text-[10px] truncate" title={it}>{it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
