"use client";

import { Briefcase, DollarSign, Target, TrendingUp } from "lucide-react";
import StatCard from "@/components/ui/stat-card";
import type { KpiBlock } from "./types";

/**
 * KpiStrip — the right-rail of the bento hero row.
 *
 * Renders 4 stacked StatCards (pipeline value, leads this week, deals won
 * this month, MRR). Sits on the right of the hero moment in a 4-col span.
 * Each card uses the existing <StatCard size="bento-1x1" /> primitive so we
 * inherit the PRISM_CYCLE accent system (blue → sky → indigo → teal),
 * count-up animation, and sparkline render.
 *
 * Accent colours are intentionally NOT overridden here — StatCard's PRISM_CYCLE
 * uses the `index` prop to assign a distinct hue per tile.
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
  /** Goal thresholds for each KPI — used to compute progress bar percent. */
  const GOALS = {
    pipeline: Math.max(kpis.pipelineValue, 10000),
    leadsPerWeek: 20,
    dealsPerMonth: 5,
    mrr: 5000,
  } as const;

  const cards = [
    {
      label: "Pipeline",
      value: fmtMoney(kpis.pipelineValue),
      sparkline: kpis.pipelineSpark,
      icon: <Target size={14} />,
      progress: Math.round((kpis.pipelineValue / GOALS.pipeline) * 100),
    },
    {
      label: "Leads / week",
      value: kpis.leadsThisWeek,
      sparkline: kpis.leadsSpark,
      icon: <TrendingUp size={14} />,
      progress: Math.round((kpis.leadsThisWeek / GOALS.leadsPerWeek) * 100),
    },
    {
      label: "Deals / month",
      value: kpis.dealsWonThisMonth,
      sparkline: kpis.dealsSpark,
      icon: <Briefcase size={14} />,
      progress: Math.round((kpis.dealsWonThisMonth / GOALS.dealsPerMonth) * 100),
    },
    {
      label: "MRR",
      value: fmtMoney(kpis.mrr),
      sparkline: kpis.mrrSpark,
      icon: <DollarSign size={14} />,
      progress: Math.round((kpis.mrr / GOALS.mrr) * 100),
    },
  ];

  return (
    <div className="lg:col-span-4 lg:row-span-2 grid grid-cols-2 lg:grid-cols-1 gap-3">
      {cards.map((c, i) => (
        <StatCard
          key={c.label}
          label={c.label}
          value={c.value}
          icon={c.icon}
          size="bento-1x1"
          index={i}
          sparkline={c.sparkline.length > 1 ? c.sparkline : undefined}
          progress={c.progress}
        />
      ))}
    </div>
  );
}
