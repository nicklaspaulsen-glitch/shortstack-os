import { Chats } from "@phosphor-icons/react";
﻿"use client";

/**
 * Client-portal Outreach Feed.
 *
 * Read-only by default — clients see every cold call, email, SMS, and DM
 * the agency has done on their behalf, with AI-generated outcome labels,
 * but cannot reply unless the agency has flipped `client_can_reply` in
 * their white-label settings.
 *
 * Scoping is enforced server-side in /api/outreach/conversations and
 * /api/outreach/conversations/[contactId] — the client's own client_id
 * is forced regardless of the query string.
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import OutreachFeedClient from "@/components/outreach/outreach-feed-client";
import { MotionPage } from "@/components/motion/motion-page";

interface WhiteLabelSettings {
  client_can_reply: boolean;
}

export default function ClientOutreachFeedPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<WhiteLabelSettings>({ client_can_reply: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("clients")
          .select("metadata")
          .eq("profile_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        const meta = (data?.metadata || {}) as Record<string, unknown>;
        const canReply = Boolean(meta.client_can_reply);
        setSettings({ client_can_reply: canReply });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <MotionPage
                className="rounded-xl border border-border-subtle p-10 text-center text-text-muted text-sm bg-white/[0.04]"
              >Loading…
              </MotionPage>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="glass rounded-xl border border-border-subtle px-6 py-5 sm:py-6"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-[rgba(99,102,241,0.10)] border border-[rgba(99,102,241,0.20)] text-indigo-400">
            <Chats size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
              Your conversations
            </div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight mt-1">Outreach Feed</h1>
            <p className="text-sm text-text-secondary mt-1.5 max-w-2xl">
              Every conversation your agency has had with leads on your behalf — calls, emails, SMS,
              and social DMs. AI summarizes each interaction so you can see what&apos;s working at a glance.
            </p>
          </div>
        </div>
      </div>

      <OutreachFeedClient mode="portal" clientCanReply={settings.client_can_reply} />
    </div>
  );
}

