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
import { motion } from "framer-motion";

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
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="glass rounded-xl overflow-hidden"
      >
        <div style={{ height: 3, background: "linear-gradient(90deg, #FF2D2D, #8b5cf6, #ec4899, #f97316, #FF2D2D)", borderRadius: "4px 4px 0 0" }} />
        <div className="p-1">
          <OutreachFeedClient mode="agency" />
        </div>
      </motion.div>
    </div>
  );
}
