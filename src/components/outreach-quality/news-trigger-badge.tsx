"use client";
/**
 * NewsTriggerBadge — fire-emoji chip rendered on a lead card when the lead has
 * at least one unacknowledged news_triggers row. Click reveals headline +
 * acknowledge button.
 *
 * Lazily fetches its own data so it can be dropped onto any lead card without
 * the parent having to thread props.
 */
import { useCallback, useEffect, useState } from "react";

interface NewsTriggerRow {
  id: string;
  lead_id: string | null;
  company: string;
  headline: string;
  url: string;
  published_at: string;
  source: string;
  trigger_type:
    | "funding"
    | "hiring"
    | "product_launch"
    | "acquisition"
    | "news_general";
  summary: string;
  acknowledged_at: string | null;
}

interface Props {
  leadId: string;
  /** Optional: render compact (chip-only) for table rows. */
  compact?: boolean;
}

const TRIGGER_LABEL: Record<NewsTriggerRow["trigger_type"], string> = {
  funding: "Funding",
  hiring: "New hire",
  product_launch: "Launch",
  acquisition: "Acquisition",
  news_general: "News",
};

export function NewsTriggerBadge({ leadId, compact = false }: Props) {
  const [triggers, setTriggers] = useState<NewsTriggerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const fetchTriggers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/integrations/news-triggers?lead_id=${encodeURIComponent(leadId)}&unacknowledged=true&limit=10`,
      );
      if (!res.ok) return;
      const json = (await res.json()) as { triggers?: NewsTriggerRow[] };
      setTriggers(json.triggers ?? []);
    } catch (err) {
      console.warn(
        "[NewsTriggerBadge] fetch failed",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void fetchTriggers();
  }, [fetchTriggers]);

  const acknowledge = useCallback(async (id: string) => {
    try {
      await fetch(`/api/integrations/news-triggers/${id}/acknowledge`, {
        method: "POST",
      });
      setTriggers((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.warn(
        "[NewsTriggerBadge] ack failed",
        err instanceof Error ? err.message : String(err),
      );
    }
  }, []);

  if (loading || triggers.length === 0) return null;

  const top = triggers[0];

  if (compact) {
    return (
      <button
        type="button"
        title={`${TRIGGER_LABEL[top.trigger_type]}: ${top.headline}`}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-800 hover:bg-orange-200"
      >
        <span aria-hidden>🔥</span>
        <span>{triggers.length}</span>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="inline-flex items-center gap-2 font-medium text-orange-900">
          <span aria-hidden>🔥</span>
          <span>
            {triggers.length} fresh news trigger
            {triggers.length === 1 ? "" : "s"}
          </span>
        </span>
        <span className="text-xs text-orange-700">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <ul className="mt-3 space-y-3">
          {triggers.map((t) => (
            <li
              key={t.id}
              className="rounded-md border border-orange-200 bg-white p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-orange-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-orange-800">
                  {TRIGGER_LABEL[t.trigger_type]}
                </span>
                <span className="text-[11px] text-gray-500">
                  {new Date(t.published_at).toLocaleDateString()}
                </span>
              </div>
              <a
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-sm font-medium text-gray-900 hover:underline"
              >
                {t.headline}
              </a>
              {t.summary && (
                <p className="mt-1 text-xs leading-relaxed text-gray-600">
                  {t.summary}
                </p>
              )}
              <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                <span>{t.source}</span>
                <button
                  type="button"
                  onClick={() => acknowledge(t.id)}
                  className="rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-100"
                >
                  Mark seen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
