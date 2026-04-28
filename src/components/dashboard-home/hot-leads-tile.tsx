"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import { tokens, themeTokens } from "@/lib/brand/tokens";
import { formatRelativeTime } from "@/lib/utils";
import { BentoTile, BentoEmpty } from "./bento-tile";
import type { HotLeadRow } from "./types";

interface Props {
  leads: HotLeadRow[];
  index?: number;
}

function scoreBadge(score: number | null): { color: string; bg: string; label: string } {
  if (score == null) return { color: themeTokens.text.muted, bg: `${tokens.text.muted}22`, label: "—" };
  if (score >= 80) {
    return {
      color: tokens.brand.lime,
      bg: `${tokens.brand.lime}1c`,
      label: String(score),
    };
  }
  if (score >= 60) {
    return {
      color: tokens.brand.plumHover,
      bg: `${tokens.brand.plum}55`,
      label: String(score),
    };
  }
  return {
    color: themeTokens.text.muted,
    bg: `${tokens.text.muted}22`,
    label: String(score),
  };
}

export default function HotLeadsTile({ leads, index = 0 }: Props) {
  return (
    <BentoTile
      title="Hot leads"
      icon={<Flame size={14} />}
      span="lg:col-span-4 lg:row-span-2"
      link={{ href: "/dashboard/leads", label: "All leads" }}
      index={index}
    >
      {leads.length === 0 ? (
        <BentoEmpty
          copy="No scored leads yet. Run a scrape and let Sage score the funnel."
          cta={{ label: "Find leads", href: "/dashboard/scraper" }}
        />
      ) : (
        <ul className="space-y-1">
          {leads.map((lead) => {
            const badge = scoreBadge(lead.lead_score);
            return (
              <li key={lead.id}>
                <Link
                  href={`/dashboard/leads/${lead.id}`}
                  className="flex items-center justify-between gap-3 py-2 px-2 -mx-2 rounded-lg transition-colors"
                  style={{ borderColor: tokens.border.subtle }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = themeTokens.bg.surface2;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[12px] font-medium truncate"
                      style={{ color: themeTokens.text.primary }}
                    >
                      {lead.business_name || "(unnamed lead)"}
                    </p>
                    <p
                      className="text-[10px] truncate"
                      style={{ color: themeTokens.text.muted }}
                    >
                      {lead.industry || "Unknown industry"}
                      {lead.scraped_at && (
                        <>
                          <span className="mx-1.5 opacity-30">·</span>
                          {formatRelativeTime(lead.scraped_at)}
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-[10px] font-mono font-bold px-2 py-1 rounded-md tabular-nums"
                    style={{
                      color: badge.color,
                      background: badge.bg,
                      border: `1px solid ${badge.color}33`,
                    }}
                  >
                    {badge.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </BentoTile>
  );
}
