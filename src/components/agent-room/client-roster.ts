// Client-portal version of the agency Kumospace roster.
//
// Same engine as agent-room/roster.ts but recast for the client's POV:
//   - The 5 agency zones (Lead Gen HQ / Content Studio / Comms Desk / Ops Room
//     / Integrations Hub) collapse into 4 client-friendly zones (Your Leads /
//     Your Content / Your Comms / Your Reports). Integrations Hub is dropped
//     because clients shouldn't see infra-level avatars (Stripe, Supabase,
//     RunPod, etc.) — those are the agency's plumbing, not the client's
//     concern.
//   - Agent set is pruned to the worker agents that actually run on a per-
//     client basis. Infra/integration agents are dropped.
//
// The reason for keeping zones, types, and the absolutePosition() helper
// re-shaped (rather than imported from the agency roster) is so the agency
// view and the client portal can evolve independently — the agency view will
// likely grow more zones over time as we add agent classes, and we don't want
// every change there to leak into client-facing UI.

export type ClientAgentKind = "worker";

export type ClientZoneId = "leads" | "content" | "comms" | "reports";

export interface ClientAgentDef {
  id: string;
  name: string;
  kind: ClientAgentKind;
  zone: ClientZoneId;
  emoji: string;
  /** One-liner shown on hover + drawer. Written from the CLIENT's POV. */
  role: string;
  /** Page to jump to when the user clicks "Open" in the drawer.
   *  Always points at a /dashboard/portal/* route — never the agency view. */
  href?: string;
  /** Placement within the zone, 0–1 each. */
  offset: { x: number; y: number };
}

export interface ClientZoneDef {
  id: ClientZoneId;
  label: string;
  rect: { x: number; y: number; w: number; h: number };
  color: "emerald" | "purple" | "blue" | "amber" | "rose";
  icon: string;
  description: string;
}

export const CLIENT_ZONES: ClientZoneDef[] = [
  {
    id: "leads",
    label: "Your Leads",
    rect: { x: 2, y: 4, w: 47, h: 44 },
    color: "emerald",
    icon: "🎯",
    description: "Prospects scraped, scored, and queued for outreach.",
  },
  {
    id: "content",
    label: "Your Content",
    rect: { x: 51, y: 4, w: 47, h: 44 },
    color: "purple",
    icon: "🎨",
    description: "Posts, captions, video, and thumbnails being made for you.",
  },
  {
    id: "comms",
    label: "Your Comms",
    rect: { x: 2, y: 52, w: 47, h: 44 },
    color: "blue",
    icon: "📡",
    description: "Email, SMS, and inbound call activity on your accounts.",
  },
  {
    id: "reports",
    label: "Your Reports",
    rect: { x: 51, y: 52, w: 47, h: 44 },
    color: "amber",
    icon: "📊",
    description: "Weekly digests, KPIs, and AI insights on your project.",
  },
];

export const CLIENT_AGENTS: ClientAgentDef[] = [
  // ── Your Leads ──────────────────────────────────────────────────
  {
    id: "lead-engine",
    name: "Lead Finder",
    kind: "worker",
    zone: "leads",
    emoji: "🎯",
    role: "Finds prospects matching your ideal customer.",
    href: "/dashboard/portal/leads",
    offset: { x: 0.2, y: 0.3 },
  },
  {
    id: "outreach",
    name: "Outreach Agent",
    kind: "worker",
    zone: "leads",
    emoji: "📨",
    role: "Sends DMs and emails to your prospects, tracks replies.",
    href: "/dashboard/portal/outreach",
    offset: { x: 0.55, y: 0.25 },
  },
  {
    id: "scheduler",
    name: "Scheduler",
    kind: "worker",
    zone: "leads",
    emoji: "📅",
    role: "Books discovery calls when prospects reply yes.",
    href: "/dashboard/portal/calendar",
    offset: { x: 0.8, y: 0.55 },
  },

  // ── Your Content ────────────────────────────────────────────────
  {
    id: "content",
    name: "Content Writer",
    kind: "worker",
    zone: "content",
    emoji: "✍️",
    role: "Drafts posts, captions, and email copy in your voice.",
    href: "/dashboard/portal/content",
    offset: { x: 0.2, y: 0.3 },
  },
  {
    id: "thumbnail",
    name: "Thumbnail Pro",
    kind: "worker",
    zone: "content",
    emoji: "🖼️",
    role: "Creates scroll-stopping video thumbnails for you.",
    href: "/dashboard/portal/content",
    offset: { x: 0.55, y: 0.2 },
  },
  {
    id: "video-editor",
    name: "Video Editor",
    kind: "worker",
    zone: "content",
    emoji: "🎬",
    role: "Cuts your raw footage into Reels, TikToks, YouTube videos.",
    href: "/dashboard/portal/content",
    offset: { x: 0.8, y: 0.45 },
  },
  {
    id: "carousel",
    name: "Carousel Designer",
    kind: "worker",
    zone: "content",
    emoji: "🎞️",
    role: "Builds 10-slide carousels for IG and LinkedIn.",
    href: "/dashboard/portal/content",
    offset: { x: 0.4, y: 0.7 },
  },

  // ── Your Comms ──────────────────────────────────────────────────
  {
    id: "receptionist",
    name: "Voice Reception",
    kind: "worker",
    zone: "comms",
    emoji: "📞",
    role: "Answers your inbound calls 24/7, books qualified leads.",
    href: "/dashboard/portal/calendar",
    offset: { x: 0.2, y: 0.3 },
  },
  {
    id: "sms",
    name: "SMS Responder",
    kind: "worker",
    zone: "comms",
    emoji: "💬",
    role: "Replies to your inbound SMS with the right tone.",
    offset: { x: 0.55, y: 0.25 },
  },
  {
    id: "email-campaign",
    name: "Email Sender",
    kind: "worker",
    zone: "comms",
    emoji: "✉️",
    role: "Sends newsletters and drip campaigns to your list.",
    offset: { x: 0.8, y: 0.55 },
  },

  // ── Your Reports ────────────────────────────────────────────────
  {
    id: "reports",
    name: "Weekly Report",
    kind: "worker",
    zone: "reports",
    emoji: "📊",
    role: "Compiles your week into a digest you can read in 60 seconds.",
    href: "/dashboard/portal/reports",
    offset: { x: 0.2, y: 0.3 },
  },
  {
    id: "ads-manager",
    name: "Ads Watcher",
    kind: "worker",
    zone: "reports",
    emoji: "📈",
    role: "Watches your Meta and Google ad spend, flags anomalies.",
    offset: { x: 0.55, y: 0.25 },
  },
  {
    id: "automations",
    name: "Workflow Bot",
    kind: "worker",
    zone: "reports",
    emoji: "⚡",
    role: "Runs the automations your agency wired for you.",
    offset: { x: 0.8, y: 0.55 },
  },
];

export const CLIENT_ZONE_BY_ID: Record<ClientZoneId, ClientZoneDef> =
  Object.fromEntries(CLIENT_ZONES.map(z => [z.id, z])) as Record<
    ClientZoneId,
    ClientZoneDef
  >;

/** Resolve absolute (x,y) % position from zone + offset. Mirrors the agency
 *  helper but uses the client zone map so we don't leak agency zones in. */
export function clientAbsolutePosition(
  agent: ClientAgentDef,
): { x: number; y: number } {
  const zone = CLIENT_ZONE_BY_ID[agent.zone];
  const padX = zone.rect.w * 0.1;
  const padY = zone.rect.h * 0.18;
  const innerW = zone.rect.w - padX * 2;
  const innerH = zone.rect.h - padY * 2;
  return {
    x: zone.rect.x + padX + innerW * agent.offset.x,
    y: zone.rect.y + padY + innerH * agent.offset.y,
  };
}
