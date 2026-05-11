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

import { MessagesSquare } from "lucide-react";
import OutreachFeedClient from "@/components/outreach/outreach-feed-client";
import { motion } from "framer-motion";
import { MotionPage } from "@/components/motion/motion-page";

export default function OutreachFeedPage() {
  return (
    <MotionPage className="space-y-4">{/* -- Outreach Feed command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">LIVE FEED</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Outreach Feed</h1>
      </div>
    </div><motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="glass rounded-xl overflow-hidden"
            >
              <div style={{ height: 3, background: "linear-gradient(90deg, #2563EB, #8b5cf6, #ec4899, #f97316, #2563EB)", borderRadius: "4px 4px 0 0" }} />
              <div className="p-1">
                <OutreachFeedClient mode="agency" />
              </div>
            </motion.div></MotionPage>
  );
}
