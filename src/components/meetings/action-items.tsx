"use client";

import { useState } from "react";
import { CheckCircle2, Circle, User, Calendar } from "lucide-react";
import toast from "react-hot-toast";

export interface ActionItem {
  id?: string;
  assignee?: string;
  text: string;
  due?: string | null;
  done?: boolean;
}

interface Props {
  meetingId: string;
  initial: ActionItem[];
}

export default function ActionItems({ meetingId, initial }: Props) {
  const [items, setItems] = useState<ActionItem[]>(initial);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  async function persist(next: ActionItem[]) {
    const res = await fetch(`/api/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action_items: next }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Failed to save action items");
      return false;
    }
    return true;
  }

  async function toggle(i: number) {
    // Optimistic update.
    const prev = items;
    const next = items.map((it, idx) => (idx === i ? { ...it, done: !it.done } : it));
    setItems(next);
    setSavingIdx(i);
    const ok = await persist(next);
    setSavingIdx(null);
    if (!ok) setItems(prev);
  }

  if (!items.length) {
    return (
      <p className="text-[11px] text-muted">No action items yet. Run analysis on the transcript.</p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li
          key={item.id || i}
          className={`flex items-start gap-2 p-2 rounded-md transition-all ${
            item.done ? "bg-white/[0.02] opacity-60" : "bg-white/[0.03] hover:bg-white/[0.05]"
          }`}
        >
          <button
            onClick={() => toggle(i)}
            disabled={savingIdx === i}
            className="flex-shrink-0 mt-0.5 text-muted hover:text-gold transition-colors"
            aria-label={item.done ? "Mark not done" : "Mark done"}
          >
            {item.done ? (
              <CheckCircle2 size={14} className="text-green-400" />
            ) : (
              <Circle size={14} />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <p
              className={`text-[11px] leading-snug ${
                item.done ? "line-through text-muted" : "text-foreground"
              }`}
            >
              {item.text}
            </p>
            <div className="flex items-center gap-3 mt-0.5 text-[9px] text-muted">
              {item.assignee && (
                <span className="flex items-center gap-0.5">
                  <User size={9} /> {item.assignee}
                </span>
              )}
              {item.due && (
                <span className="flex items-center gap-0.5">
                  <Calendar size={9} /> {item.due}
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
