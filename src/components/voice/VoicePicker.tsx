"use client";

import { useEffect, useState } from "react";
import { Mic, Loader2 } from "lucide-react";
import Link from "next/link";

interface VoiceCloneOption {
  id: string;
  label: string;
  status: "training" | "ready" | "failed";
  owner_subject_kind: string;
  provider: string;
}

interface VoicePickerProps {
  value: string | null;
  onChange: (id: string | null) => void;
  /**
   * Surface the picker is rendered on. Used in `getDefaultClone` calls so
   * "Use my default" picks the right clone.
   */
  surface: "dialer" | "voicemail" | "sms" | "dm";
  /** Render compact vs full label. */
  compact?: boolean;
  className?: string;
}

/**
 * Reusable voice clone picker. Loads clones + presets from /api/voice/clones,
 * groups them in the select, and exposes a compact row that sits inline
 * inside the dialer / SMS / DM composers.
 */
export default function VoicePicker({
  value,
  onChange,
  surface,
  compact,
  className,
}: VoicePickerProps) {
  const [mine, setMine] = useState<VoiceCloneOption[]>([]);
  const [presets, setPresets] = useState<VoiceCloneOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/voice/clones");
        if (!res.ok) {
          throw new Error(`Load failed (${res.status})`);
        }
        const data = await res.json();
        if (cancelled) return;
        setMine(
          (data.mine || []).filter(
            (c: VoiceCloneOption) => c.status === "ready",
          ),
        );
        setPresets(data.presets || []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Voice list error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        className={`flex items-center gap-2 text-xs text-text-muted ${className || ""}`}
      >
        <Loader2 size={12} className="animate-spin" /> Loading voices...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-xs text-rose-600 ${className || ""}`}>{error}</div>
    );
  }

  const totalReady = mine.length + presets.length;
  if (totalReady === 0) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2 text-xs text-amber-700 ${className || ""}`}
      >
        <Mic size={12} />
        <span>No voices yet —</span>
        <Link
          href="/dashboard/voice-studio"
          className="font-medium underline hover:text-amber-100"
        >
          set up Voice Studio
        </Link>
      </div>
    );
  }

  const labelText = compact ? "Voice" : `Voice (${surface})`;

  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      <Mic size={12} className="text-text-muted" />
      <span className="text-xs uppercase tracking-wider text-text-muted">
        {labelText}
      </span>
      <select
        value={value || ""}
        onChange={(e) => {
          const next = e.target.value || null;
          onChange(next);
        }}
        className="rounded-lg border border-border-subtle bg-black/30 px-2 py-1 text-xs text-white focus:border-amber-400/60 focus:outline-none"
      >
        <option value="">Use my default</option>
        {mine.length > 0 && (
          <optgroup label="My clones">
            {mine.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </optgroup>
        )}
        {presets.length > 0 && (
          <optgroup label="Presets">
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </optgroup>
        )}
        <option value="__none__">No voice clone</option>
      </select>
    </div>
  );
}
