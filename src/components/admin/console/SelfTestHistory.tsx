import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

interface SelfTestRun {
  run_id: string;
  started_at: string;
  pass: number;
  fail: number;
  total: number;
}

interface SelfTestHistoryProps {
  runs: SelfTestRun[] | null;
}

export default function SelfTestHistory({ runs }: SelfTestHistoryProps) {
  if (!runs) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-xs font-bold mb-3 text-foreground">Self-test history</h2>
        <p className="text-[11px] text-muted">Unavailable</p>
      </div>
    );
  }

  const maxTotal = Math.max(...runs.map((r) => r.total), 1);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-foreground">Self-test history</h2>
        <Link
          href="/dashboard/admin/self-test"
          className="text-[10px] text-accent hover:underline"
        >
          Full view →
        </Link>
      </div>

      {runs.length === 0 ? (
        <p className="text-[11px] text-muted">No runs yet.</p>
      ) : (
        <div className="space-y-2">
          {/* Sparkline */}
          <div className="flex items-end gap-1 h-10 mb-3">
            {runs.map((run) => {
              const failPct = run.total > 0 ? (run.fail / run.total) * 100 : 0;
              const heightPct = Math.max(12, (run.total / maxTotal) * 100);
              return (
                <div
                  key={run.run_id}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${heightPct}%`,
                    background:
                      failPct > 0
                        ? `linear-gradient(to top, rgb(239 68 68 / 0.6) ${failPct}%, rgb(34 197 94 / 0.45) ${failPct}%)`
                        : "rgb(34 197 94 / 0.45)",
                  }}
                  title={`${new Date(run.started_at).toLocaleString()} · ${run.pass}/${run.total} passed`}
                />
              );
            })}
          </div>

          {/* Run rows */}
          {runs.map((run) => {
            const allGreen = run.fail === 0;
            return (
              <div
                key={run.run_id}
                className="flex items-center gap-3 text-[11px] border-t border-border pt-2"
              >
                {allGreen ? (
                  <CheckCircle2 size={12} className="shrink-0 text-success" />
                ) : (
                  <XCircle size={12} className="shrink-0 text-danger" />
                )}
                <span className="text-muted flex-1">
                  {new Date(run.started_at).toLocaleString()}
                </span>
                <span className={`font-medium ${allGreen ? "text-success" : "text-danger"}`}>
                  {run.pass}/{run.total}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
