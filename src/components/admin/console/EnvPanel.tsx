"use client";

import { CheckCircle2, XCircle } from "lucide-react";

export interface EnvPresenceItem {
  name: string;
  present: boolean;
}

interface EnvPanelProps {
  items: EnvPresenceItem[] | null;
}

export default function EnvPanel({ items }: EnvPanelProps) {
  if (!items) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-xs font-bold mb-3 text-foreground">Env-var presence</h2>
        <p className="text-[11px] text-muted">Unavailable</p>
      </div>
    );
  }

  const missing = items.filter((i) => !i.present);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-foreground">Env-var presence</h2>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            missing.length === 0
              ? "bg-success/15 text-success"
              : "bg-danger/15 text-danger"
          }`}
        >
          {missing.length === 0
            ? "All set"
            : `${missing.length} missing`}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {items.map((item) => (
          <div
            key={item.name}
            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-light transition-colors"
          >
            {item.present ? (
              <CheckCircle2 size={13} className="shrink-0 text-success" />
            ) : (
              <XCircle size={13} className="shrink-0 text-danger" />
            )}
            <span className="font-mono text-[11px] text-foreground truncate">
              {item.name}
            </span>
            <span
              className={`ml-auto shrink-0 text-[10px] font-medium ${
                item.present ? "text-success" : "text-danger"
              }`}
            >
              {item.present ? "set" : "missing"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
