/**
 * DesktopBadge — keeps the OS tray / taskbar unread count in sync with
 * the `notifications` table. Mount once in the dashboard layout; it
 * renders nothing (null) and only has effect when running inside the
 * Electron shell.
 *
 * Feature-detected: on the web build `isDesktop()` is false and the
 * effect short-circuits, so there's zero overhead for browser users.
 */
"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { isDesktop, updateUnreadBadge } from "@/lib/desktop-bridge";

export default function DesktopBadge() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!isDesktop()) return;
    if (!profile?.id) return;

    const supabase = createClient();
    let cancelled = false;

    async function recount() {
      if (cancelled) return;
      try {
        const { count } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", profile!.id)
          .eq("read", false);
        if (cancelled) return;
        updateUnreadBadge(count || 0);
      } catch {
        /* best-effort — don't spam console */
      }
    }

    // Initial sync
    void recount();

    // Realtime — recount on any change to this user's notifications.
    // (Batching happens inside `updateUnreadBadge`, so it's fine to
    // trigger aggressively.)
    const channel = supabase
      .channel("desktop-badge")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          void recount();
        },
      )
      .subscribe();

    // Fallback poll every 60s for environments where realtime is off
    const poll = setInterval(recount, 60_000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      try {
        supabase.removeChannel(channel);
      } catch {
        /* ignore */
      }
      // Clear the badge when the dashboard unmounts (user signed out, etc.)
      updateUnreadBadge(0);
    };
  }, [profile?.id]);

  return null;
}
