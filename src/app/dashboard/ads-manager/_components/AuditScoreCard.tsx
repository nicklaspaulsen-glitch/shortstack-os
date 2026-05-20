"use client";

/**
 * AuditScoreCard — compact account health scorecard powered by the claude-ads
 * 200+ check methodology. Rendered at the top of the InsightsPanel.
 *
 * Visual anatomy:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  [Grade circle]  Account Health Score          [Refresh] │
 *   │  74 / 100 · C   ■ 2 Critical  ■ 3 High  ■ 1 Medium     │
 *   │  ──── category mini-bars ────────────────────────────── │
 *   │  ▼ 5 failing checks (collapsible)                       │
 *   └─────────────────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useState } from "react";
import {
  ShieldAlert,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
} from "lucide-react";

// ─── Types (mirrors /api/ads-manager/audit response) ─────────────────────────

type Severity = "critical" | "high" | "medium" | "low";
type Category =
  | "structure"
  | "tracking"
  | "bidding"
  | "creative"
  | "audiences"
  | "competitive";
type Grade = "A" | "B" | "C" | "D" | "F";

interface FailingCheck {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  category: Category;
  platform: string;
  recommendation: string;
}

interface AuditScore {
  score: number;
  grade: Grade;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  byCategory: Record<Category, { passed: number; total: number }>;
  criticalIssues: unknown[];
  highIssues: unknown[];
  mediumIssues: unknown[];
}

interface AuditResponse {
  score: AuditScore;
  failingChecks: FailingCheck[];
}

// ─── Visual constants ─────────────────────────────────────────────────────────

const GRADE_STYLES: Record<
  Grade,
  { ring: string; text: string; bg: string; label: string }
> = {
  A: {
    ring: "border-brand-accent",
    text: "text-brand-accent",
    bg: "bg-brand-accent/10",
    label: "Excellent",
  },
  B: {
    ring: "border-emerald-500",
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    label: "Good",
  },
  C: {
    ring: "border-amber-500",
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    label: "Fair",
  },
  D: {
    ring: "border-orange-500",
    text: "text-orange-400",
    bg: "bg-orange-500/10",
    label: "Poor",
  },
  F: {
    ring: "border-red-500",
    text: "text-red-400",
    bg: "bg-red-500/10",
    label: "Critical",
  },
};

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "text-red-400 border-red-500/40 bg-red-500/10",
  high: "text-orange-400 border-orange-500/40 bg-orange-500/10",
  medium: "text-amber-400 border-amber-500/40 bg-amber-400/10",
  low: "text-slate-400 border-slate-500/30 bg-slate-500/10",
};

const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

const CATEGORY_LABEL: Record<Category, string> = {
  structure: "Structure",
  tracking: "Tracking",
  bidding: "Bidding",
  creative: "Creative",
  audiences: "Audiences",
  competitive: "Competitive",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function GradeCircle({
  grade,
  score,
}: {
  grade: Grade;
  score: number;
}) {
  const s = GRADE_STYLES[grade];
  return (
    <div
      className={`flex-shrink-0 w-14 h-14 rounded-full border-2 ${s.ring} ${s.bg} flex flex-col items-center justify-center`}
    >
      <span className={`text-lg font-bold leading-none ${s.text}`}>
        {grade}
      </span>
      <span className="text-[9px] text-text-muted leading-tight">{score}</span>
    </div>
  );
}

function CategoryBar({
  label,
  passed,
  total,
}: {
  label: string;
  passed: number;
  total: number;
}) {
  if (total === 0) return null;
  const pct = Math.round((passed / total) * 100);
  const color =
    pct >= 90
      ? "bg-brand-accent"
      : pct >= 70
      ? "bg-emerald-400"
      : pct >= 50
      ? "bg-amber-400"
      : "bg-red-400";

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-text-muted w-20 flex-shrink-0 capitalize">
        {label}
      </span>
      <div className="flex-1 h-1 rounded-full bg-[rgba(99,146,255,0.12)]">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-text-muted w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

function FailCheckItem({ check }: { check: FailingCheck }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = SEVERITY_COLOR[check.severity];

  return (
    <li className={`rounded border ${colorClass} text-xs`}>
      <button
        className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span
          className={`mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[check.severity]}`}
        />
        <span className="flex-1 font-medium leading-snug">{check.name}</span>
        <span className="flex-shrink-0 mt-0.5 text-text-muted">
          {expanded ? (
            <ChevronUp size={12} />
          ) : (
            <ChevronDown size={12} />
          )}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-current/20 pt-2 mt-0">
          <p className="text-text-muted leading-relaxed">{check.description}</p>
          <div className="flex items-start gap-1.5 text-brand-accent/80">
            <Info size={11} className="mt-0.5 flex-shrink-0" />
            <span className="leading-relaxed">{check.recommendation}</span>
          </div>
        </div>
      )}
    </li>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuditScoreCard() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/ads-manager/audit", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as AuditResponse;
      setData(payload);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load audit"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="glass-panel rounded-lg p-4 animate-pulse">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-14 h-14 rounded-full bg-[rgba(99,146,255,0.06)]" />
          <div className="space-y-2">
            <div className="h-3 w-32 bg-[rgba(99,146,255,0.06)] rounded" />
            <div className="h-2 w-48 bg-[rgba(99,146,255,0.06)] rounded" />
          </div>
        </div>
        <div className="space-y-2">
          {["structure", "tracking", "bidding"].map((k) => (
            <div key={k} className="h-2 bg-[rgba(99,146,255,0.06)] rounded" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="rounded border border-danger/40 bg-danger/10 px-4 py-3 text-xs text-danger flex items-center gap-2">
        <ShieldAlert size={14} />
        Failed to load audit score: {error}
      </div>
    );
  }

  const { score, failingChecks } = data;
  const gradeStyle = GRADE_STYLES[score.grade];
  const visibleChecks = showAll ? failingChecks : failingChecks.slice(0, 4);
  const categories = Object.entries(score.byCategory) as Array<
    [Category, { passed: number; total: number }]
  >;

  return (
    <div className="glass rounded-lg p-4 space-y-4">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <GradeCircle grade={score.grade} score={score.score} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div>
              <span className="text-sm font-medium">Account Health</span>
              <span
                className={`ml-2 text-xs ${gradeStyle.text} ${gradeStyle.bg} px-1.5 py-0.5 rounded`}
              >
                {gradeStyle.label}
              </span>
            </div>
            <button
              onClick={() => void load(true)}
              disabled={refreshing}
              title="Re-run audit"
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <RefreshCw
                size={12}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>
          </div>

          {/* Severity summary pills */}
          <div className="flex items-center gap-3 flex-wrap">
            {score.criticalIssues.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-red-400">
                <AlertTriangle size={10} />
                {score.criticalIssues.length} Critical
              </span>
            )}
            {score.highIssues.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-orange-400">
                <AlertTriangle size={10} />
                {score.highIssues.length} High
              </span>
            )}
            {score.mediumIssues.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400">
                <AlertTriangle size={10} />
                {score.mediumIssues.length} Medium
              </span>
            )}
            {score.failed === 0 && (
              <span className="text-[11px] text-brand-accent">
                All checks passing
              </span>
            )}
            <span className="text-[10px] text-text-muted ml-auto">
              {score.total} checks evaluated
            </span>
          </div>
        </div>
      </div>

      {/* Category bars */}
      {categories.some(([, v]) => v.total > 0) && (
        <div className="space-y-1.5">
          {categories
            .filter(([, v]) => v.total > 0)
            .map(([cat, v]) => (
              <CategoryBar
                key={cat}
                label={CATEGORY_LABEL[cat]}
                passed={v.passed}
                total={v.total}
              />
            ))}
        </div>
      )}

      {/* Failing checks */}
      {failingChecks.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-text-muted">
            Issues to fix
          </p>
          <ul className="space-y-1.5">
            {visibleChecks.map((check) => (
              <FailCheckItem key={check.id} check={check} />
            ))}
          </ul>
          {failingChecks.length > 4 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="w-full text-[11px] text-text-muted hover:text-text-primary transition-colors text-center py-1"
            >
              {showAll
                ? "Show fewer"
                : `Show ${failingChecks.length - 4} more issues`}
            </button>
          )}
        </div>
      )}

      {/* Footer attribution */}
      <p className="text-[9px] text-text-muted text-right">
        Powered by 200+ account health checks
      </p>
    </div>
  );
}
