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
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
        No recipients to validate.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Pre-send validation
        </h3>
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100 disabled:opacity-50"
        >
          {running ? "Validating..." : "Re-run"}
        </button>
      </div>
      {error && (
        <div className="mb-2 rounded bg-red-50 px-2 py-1 text-xs text-red-800">
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
      <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
        {summary.invalid > 0 ? (
          <>
            <strong>{summary.invalid}</strong> invalid address
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
  const toneClasses: Record<TileProps["tone"], string> = {
    green: "bg-green-50 text-green-800",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-800",
    gray: "bg-gray-50 text-gray-700",
  };
  return (
    <div className={`rounded p-2 ${toneClasses[tone]}`}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[11px] uppercase tracking-wide">{label}</div>
    </div>
  );
}
