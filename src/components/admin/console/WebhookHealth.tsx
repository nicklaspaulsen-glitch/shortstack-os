import { AlertTriangle, CheckCircle2 } from "lucide-react";

export interface ProviderDedup {
  provider: string;
  done: number;
  processing: number;
  in_flight: number;
  stuck: boolean;
}

interface WebhookHealthProps {
  providers: ProviderDedup[] | null;
}

export default function WebhookHealth({ providers }: WebhookHealthProps) {
  if (!providers) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-xs font-bold mb-3 text-foreground">Webhook dedup health</h2>
        <p className="text-[11px] text-muted">Unavailable</p>
      </div>
    );
  }

  const stuckCount = providers.filter((p) => p.stuck).length;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-foreground">Webhook dedup health</h2>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            stuckCount === 0
              ? "bg-success/15 text-success"
              : "bg-danger/15 text-danger"
          }`}
        >
          {stuckCount === 0 ? "Healthy" : `${stuckCount} stuck`}
        </span>
      </div>

      {providers.length === 0 ? (
        <p className="text-[11px] text-muted">No processed_events rows found.</p>
      ) : (
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-muted border-b border-border">
              <th className="text-left pb-1.5 font-medium">Provider</th>
              <th className="text-right pb-1.5 font-medium">done</th>
              <th className="text-right pb-1.5 font-medium">processing</th>
              <th className="text-right pb-1.5 font-medium">in_flight</th>
              <th className="text-right pb-1.5 font-medium">status</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.provider} className="border-t border-border/50">
                <td className="py-1.5 font-mono text-foreground">{p.provider}</td>
                <td className="py-1.5 text-right text-muted">{p.done}</td>
                <td
                  className={`py-1.5 text-right font-medium ${
                    p.stuck ? "text-danger" : "text-foreground"
                  }`}
                >
                  {p.processing}
                </td>
                <td className="py-1.5 text-right text-muted">{p.in_flight}</td>
                <td className="py-1.5 text-right">
                  {p.stuck ? (
                    <span className="inline-flex items-center gap-1 text-danger">
                      <AlertTriangle size={10} /> stuck
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-success">
                      <CheckCircle2 size={10} /> ok
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
