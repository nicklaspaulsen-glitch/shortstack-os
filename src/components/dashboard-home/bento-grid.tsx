"use client";

import DashboardHeroMoment from "./dashboard-hero-moment";
import KpiStrip from "./kpi-strip";
import QuickActionsGrid from "./quick-actions-grid";
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
 *   Row 3:    [QuickActions 4x1] [RecentCalls 4x1] [RecentEmails 4x1]
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 auto-rows-[minmax(0,1fr)]">
      {/* Row 1+2 — Hero Moment + KPI strip */}
      <DashboardHeroMoment hero={data.hero} index={0} />
      <KpiStrip kpis={data.kpis} />

      {/* Row 3 — Quick actions + recent calls + recent emails */}
      <QuickActionsGrid index={2} />
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
  );
}
