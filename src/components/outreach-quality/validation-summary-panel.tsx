"use client";
/**
 * ValidationSummaryPanel — runs a pre-flight email validation pass over a
 * cold-email job's recipient list and shows a "X valid / Y risky / Z invalid"
 * tile so the operator can see the deliverability cost of pressing Start.
 *
 * Invoked from the cold-email job page right above the Start button.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

interface ValidationResult {
  email: string;
  status: "valid" | "risky" | "invalid" | "unknown" | "skipped";
  provider: "abstractapi" | "hunter" | "skipped";
  deliverability?: "deliverable" | "undeliverable" | "risky" | "unknown";
}

interface Props {
  emails: string[];
  /** Optional: call when validation finishes so the parent can gate Start. */
  onValidated?: (summary: Summary) => void;
  /** Optional: skip the auto-fetch, render an idle state instead. */
  autoRun?: boolean;
}

interface Summary {
  total: number;
  valid: number;
  risky: number;
  invalid: number;
  unknown: number;
  skipped: number;
}

function emptySummary(total: number): Summary {
  return { total, valid: 0, risky: 0, invalid: 0, unknown: 0, skipped: 0 };
}

export function ValidationSummaryPanel({
  emails,
  onValidated,
  autoRun = true,
}: Props) {
  const uniqueEmails = useMemo(
    () => Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))),
    [emails],
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary>(emptySummary(uniqueEmails.length));

  const run = useCallback(async () => {
    if (uniqueEmails.length === 0) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/validate-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emails: uniqueEmails }),
      });
      if (!res.ok) {
        setError(`Validation API returned ${res.status}`);
        return;
      }
      const json = (await res.json()) as {
        results?: Record<string, ValidationResult>;
      };
      const next = emptySummary(uniqueEmails.length);
      for (const email of uniqueEmails) {
        const r = json.results?.[email];
        if (!r) {
          next.unknown++;
          continue;
        }
        next[r.status]++;
      }
      setSummary(next);
      onValidated?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [uniqueEmails, onValidated]);

  useEffect(() => {
    if (autoRun) void run();
  }, [autoRun, run]);

  if (uniqueEmails.length === 0) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface p-3 text-sm text-text-muted">
        No recipients to validate.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          Pre-send validation
        </h3>
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className="rounded border border-border-subtle px-2 py-0.5 text-xs text-text-muted hover:bg-[rgba(99,146,255,0.06)] hover:border-[rgba(99,146,255,0.25)] hover:text-text-primary transition-colors disabled:opacity-50"
        >
          {running ? "Validating..." : "Re-run"}
        </button>
      </div>
      {error && (
        <div className="mb-2 rounded px-2 py-1 text-xs text-[#F87171]" style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)" }}>
          {error}
        </div>
      )}
      <div className="grid grid-cols-5 gap-2 text-center">
        <SummaryTile label="Valid" value={summary.valid} tone="green" />
        <SummaryTile label="Risky" value={summary.risky} tone="amber" />
        <SummaryTile label="Invalid" value={summary.invalid} tone="red" />
        <SummaryTile label="Unknown" value={summary.unknown} tone="gray" />
        <SummaryTile label="Skipped" value={summary.skipped} tone="gray" />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
        {summary.invalid > 0 ? (
          <>
            <strong className="text-text-secondary">{summary.invalid}</strong> invalid address
            {summary.invalid === 1 ? "" : "es"} will be skipped on send.{" "}
          </>
        ) : null}
        Risky addresses are still sent unless EMAIL_VALIDATION_STRICT is on.
      </p>
    </div>
  );
}

interface TileProps {
  label: string;
  value: number;
  tone: "green" | "amber" | "red" | "gray";
}

function SummaryTile({ label, value, tone }: TileProps) {
  const toneStyles: Record<TileProps["tone"], { bg: string; text: string }> = {
    green:  { bg: "rgba(34,197,94,0.10)",    text: "#4ADE80" },
    amber:  { bg: "rgba(234,179,8,0.10)",    text: "#FDE047" },
    red:    { bg: "rgba(239,68,68,0.10)",    text: "#F87171" },
    gray:   { bg: "rgba(99,146,255,0.06)",   text: "#A8A8B2" },
  };
  const s = toneStyles[tone];
  return (
    <div
      className="rounded p-2 text-center"
      style={{ background: s.bg, border: `1px solid ${s.bg.replace("0.10", "0.20").replace("0.06", "0.12")}` }}
    >
      <div className="text-lg font-semibold" style={{ color: s.text }}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
    </div>
  );
}
