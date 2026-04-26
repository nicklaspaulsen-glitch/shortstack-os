"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";

export interface TrinityErrorRow {
  id: string;
  created_at: string;
  action_type: string | null;
  description: string | null;
  user_id: string | null;
  result: unknown;
  metadata: unknown;
}

interface ErrorLogProps {
  rows: TrinityErrorRow[] | null;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function ExpandableRow({ row }: { row: TrinityErrorRow }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-border/50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-2 py-2 px-1 text-left hover:bg-surface-light transition-colors rounded"
      >
        <span className="mt-0.5 shrink-0 text-muted">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-2 items-start">
          <div className="min-w-0">
            <span className="font-mono text-[10px] text-danger truncate block">
              {row.action_type ?? "unknown"}
            </span>
            <span className="text-[11px] text-foreground truncate block">
              {row.description ?? "No description"}
            </span>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] text-muted block">
              {new Date(row.created_at).toLocaleDateString()}
            </span>
            <span className="text-[10px] text-muted block">
              {new Date(row.created_at).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-2">
          {row.user_id && (
            <div className="text-[10px] text-muted">
              User: <span className="font-mono text-foreground">{row.user_id}</span>
            </div>
          )}
          <div>
            <div className="text-[10px] text-muted mb-1">result</div>
            <pre className="bg-background rounded p-2 text-[10px] font-mono text-foreground overflow-x-auto max-h-32">
              {safeJson(row.result)}
            </pre>
          </div>
          <div>
            <div className="text-[10px] text-muted mb-1">metadata</div>
            <pre className="bg-background rounded p-2 text-[10px] font-mono text-foreground overflow-x-auto max-h-32">
              {safeJson(row.metadata)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ErrorLog({ rows }: ErrorLogProps) {
  if (!rows) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-xs font-bold mb-3 text-foreground">Recent error log</h2>
        <p className="text-[11px] text-muted">Unavailable</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={14} className="text-danger" />
        <h2 className="text-xs font-bold text-foreground">
          Recent error log
          <span className="ml-2 text-muted font-normal">({rows.length})</span>
        </h2>
      </div>

      {rows.length === 0 ? (
        <p className="text-[11px] text-muted">No errors logged.</p>
      ) : (
        <div>
          {rows.map((row) => (
            <ExpandableRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
