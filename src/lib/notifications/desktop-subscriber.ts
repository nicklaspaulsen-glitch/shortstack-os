/**
 * desktop-subscriber — Supabase realtime → native OS notifications.
 *
 * Listens for three domain events and fires the matching `ssDesktop`
 * preset so the user gets a native toast even when the dashboard tab
 * is not focused:
 *   • leads INSERT                         → "leadScraped"
 *   • outreach_log UPDATE (opened_at set)  → "emailOpened"
 *   • trinity_log INSERT (completed)       → "agentReply"
 *
 * Only active when `isDesktop()` is true — the subscriber returns a
 * no-op unsubscribe on the web so the caller doesn't need to branch.
 *
 * NOTE on Supabase realtime: the three tables below must be in a
 * publication for these events to fire. If realtime is off for the
 * project, the subscriber silently no-ops. Enable with:
 *   alter publication supabase_realtime add table leads, outreach_log, trinity_log;
 */
"use client";

import { createClient } from "@/lib/supabase/client";
import { isDesktop, notifyPreset } from "@/lib/desktop-bridge";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface LeadRow {
  id: string;
  user_id: string;
  niche?: string | null;
}

interface OutreachRow {
  id: string;
  user_id?: string;
  opened_at: string | null;
  subject?: string | null;
}

interface TrinityRow {
  id: string;
  agent?: string | null;
  status?: string | null;
  summary?: string | null;
  user_id?: string;
}

// ── Lead INSERT throttling ────────────────────────────────────────────
// Scrapers can burst hundreds of rows in a second. We batch every burst
// into ONE native notification ("leadScraped: 12 new Fitness leads")
// instead of spamming the OS notification center.
interface LeadBurst {
  count: number;
  niche?: string;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Subscribe to Supabase realtime and fire desktop notifications.
 * Returns an unsubscribe function. No-op (returns () => {}) on the web.
 */
export function subscribeDesktopNotifications(ownerId: string): () => void {
  if (!isDesktop()) return () => {};
  if (!ownerId) return () => {};

  const supabase = createClient();
  const channels: RealtimeChannel[] = [];
  let disposed = false;

  // ── 1. Lead INSERT → batched leadScraped ────────────────────────────
  const burst: LeadBurst = { count: 0, niche: undefined, timer: null };
  const flushBurst = () => {
    if (disposed) return;
    if (burst.count < 1) return;
    void notifyPreset("leadScraped", {
      count: burst.count,
      niche: burst.niche,
    });
    burst.count = 0;
    burst.niche = undefined;
    burst.timer = null;
  };

  try {
    const leadsChannel = supabase
      .channel("desktop:leads")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "leads",
          filter: `user_id=eq.${ownerId}`,
        },
        (payload: { new: LeadRow }) => {
          if (disposed) return;
          burst.count += 1;
          if (!burst.niche && payload.new?.niche) {
            burst.niche = payload.new.niche;
          }
          if (burst.timer) clearTimeout(burst.timer);
          burst.timer = setTimeout(flushBurst, 1500);
        },
      )
      .subscribe();
    channels.push(leadsChannel);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[desktop-subscriber] leads subscribe failed", err);
  }

  // ── 2. outreach_log UPDATE → emailOpened ────────────────────────────
  // Fires when opened_at transitions null → set. No user-scoped filter
  // (outreach_log schema varies by install; we check the user_id column
  // in the callback when available).
  try {
    const outreachChannel = supabase
      .channel("desktop:outreach")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "outreach_log",
        },
        (payload: { new: OutreachRow; old: OutreachRow }) => {
          if (disposed) return;
          const prev = payload.old?.opened_at;
          const now = payload.new?.opened_at;
          if (prev || !now) return; // only on null → set
          // Best-effort tenant filter — if the row has a user_id and it
          // doesn't match the current owner, skip.
          const rowOwner = payload.new?.user_id;
          if (rowOwner && rowOwner !== ownerId) return;
          void notifyPreset("emailOpened", {
            subject: payload.new?.subject || "Your email",
          });
        },
      )
      .subscribe();
    channels.push(outreachChannel);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[desktop-subscriber] outreach_log subscribe failed", err);
  }

  // ── 3. trinity_log INSERT → agentReply ──────────────────────────────
  try {
    const trinityChannel = supabase
      .channel("desktop:trinity")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trinity_log",
        },
        (payload: { new: TrinityRow }) => {
          if (disposed) return;
          const row = payload.new;
          if (!row) return;
          if (row.agent && row.agent !== "trinity") return;
          if (row.status && row.status !== "completed") return;
          const rowOwner = row.user_id;
          if (rowOwner && rowOwner !== ownerId) return;
          void notifyPreset("agentReply", {
            summary: row.summary || "Agent task complete",
          });
        },
      )
      .subscribe();
    channels.push(trinityChannel);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[desktop-subscriber] trinity_log subscribe failed", err);
  }

  return () => {
    disposed = true;
    if (burst.timer) clearTimeout(burst.timer);
    for (const ch of channels) {
      try {
        supabase.removeChannel(ch);
      } catch {
        /* ignore */
      }
    }
  };
}
