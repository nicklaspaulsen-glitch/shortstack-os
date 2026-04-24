"use client";

import { Users } from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import RoomCanvas from "@/components/agent-room/room-canvas";

// Kumospace-inspired live agent room. Every in-app agent + every third-party
// integration is rendered as a drifting avatar inside a themed zone. Avatars
// pulse green when they've run in the last 5 minutes, amber for runs in
// the last hour, red when half or more recent runs failed, and slate when
// the integration's env vars aren't set at all.
//
// Click an avatar → side drawer with the latest run, error count, and a
// jump-link into that agent's page.
export default function AgentRoomPage() {
  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Users size={28} />}
        title="Agent Room"
        subtitle="Live view of every agent in your agency — their zones, status, and last runs."
        gradient="gold"
      />
      <RoomCanvas />
    </div>
  );
}
