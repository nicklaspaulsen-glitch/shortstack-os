"use client";

/**
 * SectionHub — shared layout for the 4 sidebar-section hub pages
 * (Sales, Create, Visual, Automate). Each hub is a dashboard-within-
 * a-dashboard: hero, quick actions, tools grid, recent activity,
 * stats strip. All data comes from /api/sections/[section].
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, ChevronRight, Clock, Sparkles } from "lucide-react";
import PageHero, { type HeroGradient } from "@/components/ui/page-hero";
import RollingPreview, { type RollingPreviewItem, type RollingPreviewProps } from "@/components/RollingPreview";
import { formatRelativeTime } from "@/lib/utils";

export interface HubTool {
  slug: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  comingSoon?: boolean;
}

export interface HubQuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface HubStat {
  label: string;
  key: string;
  icon: LucideIcon;
  /** "integer" (default), "currency", or "passthrough" to render as-is */
  format?: "integer" | "currency" | "passthrough";
  color?: string;
}

export interface SectionHubProps {
  section: "sales" | "create" | "visual" | "automate" | "manage" | "connect";
  title: string;
  subtitle: string;
  heroIcon: React.ReactNode;
  heroGradient: HeroGradient;
  eyebrow?: string;
  quickActions: HubQuickAction[];
  tools: HubTool[];
  stats: HubStat[];
  /**
   * Optional rolling preview shown between hero and quick actions. Pass
   * the items you want to showcase for this section (~12 items works best).
   */
  preview?: {
    items: RollingPreviewItem[];
    variant?: RollingPreviewProps["variant"];
    aspectRatio?: RollingPreviewProps["aspectRatio"];
    opacity?: RollingPreviewProps["opacity"];
    caption?: string;
  };
}

interface ApiResponse {
  section: string;
  stats: Record<string, number | string | null>;
  lastUsed: Record<string, string | null>;
  activity: Array<{
    id: string;
    description: string | null;
    action_type: string;
    created_at: string;
  }>;
}

function formatStat(value: number | string | null | undefined, format: HubStat["format"]): string {
  if (value === null || value === undefined) return "—";
  if (format === "currency") {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return "—";
    return n >= 1000
      ? `$${(n / 1000).toFixed(1)}k`
      : `$${n.toLocaleString()}`;
  }
  if (format === "passthrough") return String(value);
  // integer (default)
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

export default function SectionHub({
  section,
  title,
  subtitle,
  heroIcon,
  heroGradient,
  eyebrow,
  quickActions,
  tools,
  stats,
  preview,
}: SectionHubProps) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sections/${section}`, { cache: "no-store" });
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setData(json);
      }
    } catch {
      // Silent — UI shows "—" fallback
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="fade-in space-y-5 max-w-[1400px] mx-auto">
      {/* Hero */}
      <PageHero
        icon={heroIcon}
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        gradient={heroGradient}
      />

      {/* Rolling preview marquee (optional — each hub can pass its own set) */}
      {preview && preview.items.length > 0 && (
        <div className="relative rounded-2xl overflow-hidden border border-border bg-surface-light/30 py-5">
          <div className="absolute inset-0 pointer-events-none">
            <RollingPreview
              items={preview.items}
              variant={preview.variant || "image"}
              rows={2}
              aspectRatio={preview.aspectRatio || "16:9"}
              opacity={preview.opacity ?? 0.3}
              speed="medium"
            />
          </div>
          <div className="relative text-center px-4">
            <p className="text-[11px] uppercase tracking-widest text-gold/80 font-semibold">
              In this section
            </p>
            <h3 className="text-base font-bold text-foreground mt-1">
              {preview.caption || `Explore the ${title.toLowerCase()} toolkit`}
            </h3>
          </div>
        </div>
      )}

      {/* Quick actions row */}
      {quickActions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.label}
                href={a.href}
                className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface hover:bg-surface-light hover:border-gold/30 transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0 group-hover:bg-gold/15 transition-colors">
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-foreground leading-tight truncate">{a.label}</p>
                  <p className="text-[10px] text-muted leading-tight">Quick action</p>
                </div>
                <ChevronRight size={14} className="text-muted group-hover:text-gold transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {stats.map((s) => {
          const Icon = s.icon;
          const raw = data?.stats?.[s.key];
          const display = loading ? "…" : formatStat(raw, s.format);
          return (
            <div key={s.key} className="card !py-3 !px-3.5 flex items-center gap-3">
              <div className={s.color || "text-gold"}>
                <Icon size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-none">{display}</p>
                <p className="text-[10px] text-muted truncate">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Tools grid */}
        <div className="lg:col-span-2 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] font-semibold text-muted uppercase tracking-[0.18em]">Tools</h2>
            <span className="text-[10px] text-muted">{tools.length} in this section</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {tools.map((tool) => {
              const Icon = tool.icon;
              const ts = data?.lastUsed?.[tool.slug] || null;
              const disabled = !!tool.comingSoon;
              const content = (
                <>
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-foreground leading-tight truncate">
                        {tool.label}
                        {disabled && (
                          <span className="ml-1.5 text-[9px] text-muted font-medium uppercase tracking-wider">
                            Soon
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted leading-snug line-clamp-2 mt-0.5">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 mt-auto border-t border-border/50">
                    <span className="text-[9px] text-muted flex items-center gap-1">
                      <Clock size={9} /> {ts ? formatRelativeTime(ts) : "Not used yet"}
                    </span>
                    <ChevronRight size={12} className="text-muted" />
                  </div>
                </>
              );
              const cls =
                "group flex flex-col gap-2 p-3 rounded-xl border border-border bg-surface transition-all " +
                (disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-surface-light hover:border-gold/30 cursor-pointer");
              return disabled ? (
                <div key={tool.slug} className={cls} aria-disabled="true">
                  {content}
                </div>
              ) : (
                <Link key={tool.slug} href={tool.href} className={cls}>
                  {content}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent activity feed */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] font-semibold text-muted uppercase tracking-[0.18em]">
              Recent activity
            </h2>
          </div>
          <div className="card !p-0 overflow-hidden">
            {loading ? (
              <div className="p-4 text-[11px] text-muted text-center">Loading…</div>
            ) : !data?.activity?.length ? (
              <div className="p-6 text-center">
                <Activity size={18} className="mx-auto text-muted/50 mb-2" />
                <p className="text-[11px] text-muted">No activity yet</p>
                <p className="text-[10px] text-muted/70 mt-0.5">
                  Use a tool below to populate this feed
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-2.5 px-3 py-2.5">
                    <Sparkles size={12} className="text-gold/70 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-foreground leading-snug line-clamp-2">
                        {a.description || humanizeAction(a.action_type)}
                      </p>
                      <p className="text-[9px] text-muted mt-0.5">
                        {formatRelativeTime(a.created_at)} · {humanizeAction(a.action_type)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function humanizeAction(action: string): string {
  if (!action) return "Action";
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
