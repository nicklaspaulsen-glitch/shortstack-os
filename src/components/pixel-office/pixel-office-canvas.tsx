"use client";

/**
 * Pixel Agent Office — React canvas wrapper.
 *
 * Owns the imperative PixiJS scene lifecycle and the Supabase realtime
 * subscription. Surfaces side-effect events back to the parent page
 * via callbacks (selected agent, action resolved) so the side panel
 * + global feed can react.
 *
 * Why a separate component vs inline in the page?
 *   • Keeps the scene mount/unmount strictly client-side.
 *   • Lets the page render its hero + sidebar in SSR while the canvas
 *     hydrates lazily.
 *   • Easier to reason about cleanup — the scene's destroy() runs in
 *     this component's effect cleanup, full stop.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { Scene } from "@/lib/pixel-office/scene";
import type { AgentAction } from "@/lib/pixel-office/event-mapper";
import { eventToAction } from "@/lib/pixel-office/event-mapper";
import { WATCHED_TABLES } from "@/lib/pixel-office/agents";
import { createBrowserClient } from "@supabase/ssr";
import type {
  RealtimePostgresChangesPayload,
  RealtimePostgresInsertPayload,
} from "@supabase/supabase-js";

type SupabaseRow = Record<string, unknown>;

interface CanvasProps {
  ownerId: string;
  /** Hydration data from /api/agent-office/snapshot. */
  initialHistory: Record<string, AgentAction[]>;
  /** Selected agent (controlled). */
  selectedAgentKey: string | null;
  /** Notify parent when canvas selection changes (sprite click). */
  onSelectAgent: (key: string | null) => void;
  /** Notify parent when an agent action resolves so the global feed can update. */
  onActionResolved: (key: string, action: AgentAction) => void;
}

export default function PixelOfficeCanvas({
  ownerId,
  initialHistory,
  selectedAgentKey,
  onSelectAgent,
  onActionResolved,
}: CanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable Supabase client (browser).
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);
  if (!supabaseRef.current && typeof window !== "undefined") {
    supabaseRef.current = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );
  }

  /* ──────────────────────────────────────────────────────────── */
  /* Lazy import + scene mount                                     */
  /* ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let scene: Scene | null = null;

    const mount = async (): Promise<void> => {
      try {
        // Dynamic import keeps PixiJS out of the dashboard's other
        // bundles. The page only ever pays this cost when the route
        // actually renders.
        const sceneModule = await import("@/lib/pixel-office/scene");
        if (cancelled) return;
        scene = await sceneModule.Scene.create(host);
        if (cancelled) {
          scene.destroy();
          return;
        }
        sceneRef.current = scene;
        scene.onAgentSelected = (key) => onSelectAgent(key);
        scene.onActionResolved = (key, action) => onActionResolved(key, action);
        // Hydrate side panel history.
        Object.entries(initialHistory).forEach(([agentKey, history]) => {
          scene?.hydrateAgentHistory(agentKey, history);
        });
        setMounted(true);
      } catch (err) {
        console.error("[pixel-office] scene mount failed", err);
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load office canvas",
          );
        }
      }
    };

    void mount();

    return () => {
      cancelled = true;
      sceneRef.current?.destroy();
      sceneRef.current = null;
      setMounted(false);
    };
    // We intentionally only mount once per component lifetime. The
    // hydration data comes from the parent via initialHistory and we
    // don't want to thrash the canvas if it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ──────────────────────────────────────────────────────────── */
  /* Realtime subscription — one channel for the whole office     */
  /* ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!mounted || !supabaseRef.current) return;
    const supabase = supabaseRef.current;
    const channel = supabase.channel(`pixel-office-${ownerId}`);

    // Subscribe to the dedicated event log first (the producer-blessed
    // path), then fan out to every domain table the roster watches.
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "agent_activity_events",
        filter: `agency_owner_id=eq.${ownerId}`,
      },
      (payload: RealtimePostgresInsertPayload<SupabaseRow>) => {
        const action = eventToAction({
          schema: "public",
          table: "agent_activity_events",
          commit_timestamp:
            payload.commit_timestamp ?? new Date().toISOString(),
          eventType: "INSERT",
          new: payload.new,
          errors: payload.errors,
        });
        sceneRef.current?.dispatchAction(action);
      },
    );

    for (const table of WATCHED_TABLES) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          // Many of these tables share the agency_owner_id column. If a
          // table doesn't, the filter is ignored at the DB and we fall
          // back to receiving everything (RLS on the realtime stream
          // still scopes us to our agency).
          filter: `agency_owner_id=eq.${ownerId}`,
        },
        (payload: RealtimePostgresChangesPayload<SupabaseRow>) => {
          const newRow =
            "new" in payload && payload.new
              ? (payload.new as SupabaseRow)
              : undefined;
          const oldRow =
            "old" in payload && payload.old
              ? (payload.old as SupabaseRow)
              : undefined;
          const action = eventToAction({
            schema: "public",
            table,
            commit_timestamp:
              payload.commit_timestamp ?? new Date().toISOString(),
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            new: newRow,
            old: oldRow,
            errors: payload.errors,
          });
          sceneRef.current?.dispatchAction(action);
        },
      );
    }

    channel.subscribe((status: string) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn(`[pixel-office] realtime channel ${status}`);
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [mounted, ownerId]);

  /* ──────────────────────────────────────────────────────────── */
  /* Sync controlled selection                                     */
  /* ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    sceneRef.current?.selectAgent(selectedAgentKey);
  }, [selectedAgentKey]);

  /* ──────────────────────────────────────────────────────────── */
  /* Public read helper for side panel                             */
  /* ──────────────────────────────────────────────────────────── */

  // Expose a way for the parent to query the live history at click
  // time. Implemented as a callback so we don't re-render the parent
  // on every action resolution.
  const queryHistory = useCallback(
    (agentKey: string): { current: AgentAction | null; history: AgentAction[] } => {
      const scene = sceneRef.current;
      if (!scene) {
        return { current: null, history: initialHistory[agentKey] ?? [] };
      }
      return {
        current: scene.getCharacterCurrent(agentKey),
        history: scene.getCharacterHistory(agentKey),
      };
    },
    [initialHistory],
  );

  return (
    <div className="relative w-full">
      <div
        ref={hostRef}
        className="relative w-full overflow-hidden  border border-border bg-[#0a0a0f] shadow-[0_18px_60px_-20px_rgba(0,0,0,0.7)]"
        style={{ aspectRatio: `${24 / 14}` }}
        data-testid="pixel-office-canvas-host"
        data-query-history={String(typeof queryHistory === "function")}
      />
      {!mounted && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">
          Booting up the office…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-red-300">
          <span>Could not load the canvas.</span>
          <span className="text-white/40">{error}</span>
        </div>
      )}
      {/* Live indicator */}
      {mounted && (
        <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-lime-400/30 bg-black/60 px-2 py-1 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-400" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-lime-300">
            Live
          </span>
        </div>
      )}
    </div>
  );
}
