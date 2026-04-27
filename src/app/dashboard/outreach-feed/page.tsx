"use client";

/**
 * Unified Outreach Feed — agency surface.
 *
 * Aggregates every conversation the agency has had with a prospect or
 * client across all channels (cold calls, email, SMS, Instagram/LinkedIn
 * DMs) into a single chat-bubble timeline. Replays the full history per
 * contact and surfaces one-click reply / call-back actions.
 *
 * The data + interaction logic lives in <OutreachFeedClient> so the portal
 * page can re-use it with a different scope (read-only by default,
 * client-id filtered).
 */

import PageHero from "@/components/ui/page-hero";
import { MessagesSquare } from "lucide-react";
import OutreachFeedClient from "@/components/outreach/outreach-feed-client";

export default function OutreachFeedPage() {
  return (
    <div className="space-y-4">
      <PageHero
        title="Outreach Feed"
        subtitle="Every call, email, SMS, and DM with each prospect — replayed as one chat thread, with AI outcome labels and one-click follow-ups."
        eyebrow="Unified timeline"
        icon={<MessagesSquare size={22} />}
        gradient="purple"
      />
      <OutreachFeedClient mode="agency" />
    </div>
  );
}
