/**
 * Shared types for the editorial-bento dashboard home (Phase 2B).
 *
 * Each tile component consumes a subset of `BentoData`. Keeping the shape
 * here means the API route, the page, and every tile agree on the data
 * contract — no implicit casting.
 */

export interface VoiceCallRow {
  id: string;
  duration_seconds: number | null;
  from_number: string | null;
  to_number: string | null;
  started_at: string;
  outcome: string | null;
}

export interface OutreachEmailRow {
  id: string;
  recipient: string | null;
  subject: string | null;
  status: string;
  sent_at: string;
}

export interface HotLeadRow {
  id: string;
  business_name: string | null;
  industry: string | null;
  lead_score: number | null;
  scraped_at: string | null;
  status: string | null;
}

export interface ScheduledItem {
  id: string;
  kind: "post" | "meeting" | "calendar";
  title: string;
  scheduled_at: string;
  detail: string | null;
}

export interface AgentEventRow {
  id: string;
  agent_key: string;
  event_type: string;
  summary: string;
  ref_table: string | null;
  ref_id: string | null;
  created_at: string;
}

export interface KpiBlock {
  pipelineValue: number;
  leadsThisWeek: number;
  dealsWonThisMonth: number;
  mrr: number;
  pipelineSpark: number[];
  leadsSpark: number[];
  dealsSpark: number[];
  mrrSpark: number[];
}

export interface HeroBlock {
  headline: string;
  subhead: string;
  progressPct: number;
  cta: { label: string; href: string };
}

export interface OwnerProfile {
  firstName: string;
  avatarUrl: string | null;
  planTier: string | null;
  clientCount: number;
  mrr: number;
}

export interface BentoData {
  ownerId: string;
  hero: HeroBlock;
  kpis: KpiBlock;
  profile: OwnerProfile;
  recentCalls: VoiceCallRow[];
  recentEmails: OutreachEmailRow[];
  hotLeads: HotLeadRow[];
  schedule: ScheduledItem[];
  agentEvents: AgentEventRow[];
  microStats: { calls: number; leads: number; hot: number };
}
