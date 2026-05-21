"use client";

import DashboardHeroMoment from "./dashboard-hero-moment";
import KpiStrip from "./kpi-strip";
import OwnerProfileTile from "./owner-profile-tile";
import RecentCallsTile from "./recent-calls-tile";
import RecentEmailsTile from "./recent-emails-tile";
import AgentActivityFeedTile from "./agent-activity-feed-tile";
import HotLeadsTile from "./hot-leads-tile";
import TodaysScheduleTile from "./todays-schedule-tile";
import type { BentoData } from "./types";

/**
 * BentoGrid — composition layer that places the 8 tiles on a 12-column grid.
 *
 *   Row 1+2:  [HeroMoment 8x2 ............] [Kpi 4x1] [Kpi 4x1]
 *                                            [Kpi 4x1] [Kpi 4x1]
 *
 *   Row 3:    [OwnerProfile 4x1] [RecentCalls 4x1] [RecentEmails 4x1]
 *
 *   Row 4+5:  [AgentActivity 4x2] [HotLeads 4x2] [TodaysSchedule 4x2]
 *
 * Stagger entrance handled per-tile via the `index` prop.
 */
interface Props {
  data: BentoData;
}

export default function BentoGrid({ data }: Props) {
  return (
    <div className="relative">
      {/* Blue ambient glow — renders behind tiles so frosted-glass treatment picks it up */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[50%] rounded-full"
          style={{
            background: "radial-gradient(closest-side, rgba(212,255,0,0.07) 0%, transparent 100%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute top-0 right-1/4 w-[40%] h-[30%] rounded-full"
          style={{
            background: "radial-gradient(closest-side, rgba(212,255,0,0.05) 0%, transparent 100%)",
            filter: "blur(80px)",
          }}
        />
      </div>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 auto-rows-[minmax(0,1fr)]">
      {/* Row 1+2 — Hero Moment + KPI strip */}
      <DashboardHeroMoment hero={data.hero} index={0} />
      <KpiStrip kpis={data.kpis} />

      {/* Row 3 — Owner profile + quick actions + recent calls + recent emails */}
      <OwnerProfileTile profile={data.profile} index={2} />
      <RecentCallsTile calls={data.recentCalls} index={3} />
      <RecentEmailsTile emails={data.recentEmails} index={4} />

      {/* Row 4+5 — Agent activity + hot leads + today's schedule */}
      <AgentActivityFeedTile
        ownerId={data.ownerId}
        initialEvents={data.agentEvents}
        index={5}
      />
      <HotLeadsTile leads={data.hotLeads} index={6} />
      <TodaysScheduleTile schedule={data.schedule} index={7} />
    </div>
    </div>
  );
}
