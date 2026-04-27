"use client";

import { Briefcase, DollarSign, Target, TrendingUp } from "lucide-react";
import StatCard from "@/components/ui/stat-card";
import { tokens } from "@/lib/brand/tokens";
import type { KpiBlock } from "./types";

/**
 * KpiStrip — the right-rail of the bento hero row.
 *
 * Renders 4 stacked StatCards (pipeline value, leads this week, deals won
 * this month, MRR). Sits on the right of the hero moment in a 4-col span.
 * Each card uses the existing <StatCard size="bento-1x1" /> primitive so we
 * inherit the lime-accent surface, count-up animation, and sparkline render.
 */
interface Props {
  kpis: KpiBlock;
}

function fmtMoney(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

export default function KpiStrip({ kpis }: Props) {
  const cards = [
    {
      label: "Pipeline",
      value: kpis.pipelineValue,
      sparkline: kpis.pipelineSpark,
      icon: <Target size={14} />,
      accent: tokens.brand.lime,
    },
    {
      label: "Leads / week",
      value: kpis.leadsThisWeek,
      sparkline: kpis.leadsSpark,
      icon: <TrendingUp size={14} />,
      accent: tokens.brand.lime,
    },
    {
      label: "Deals / month",
      value: kpis.dealsWonThisMonth,
      sparkline: kpis.dealsSpark,
      icon: <Briefcase size={14} />,
      accent: tokens.brand.lime,
    },
    {
      label: "MRR",
      value: fmtMoney(kpis.mrr),
      sparkline: kpis.mrrSpark,
      icon: <DollarSign size={14} />,
      accent: tokens.brand.lime,
    },
  ];

  return (
    <div className="lg:col-span-4 lg:row-span-2 grid grid-cols-2 lg:grid-cols-1 gap-3">
      {cards.map((c) => (
        <StatCard
          key={c.label}
          label={c.label}
          value={c.value}
          icon={c.icon}
          size="bento-1x1"
          accentColor={c.accent}
          sparkline={c.sparkline.length > 1 ? c.sparkline : undefined}
        />
      ))}
    </div>
  );
}
