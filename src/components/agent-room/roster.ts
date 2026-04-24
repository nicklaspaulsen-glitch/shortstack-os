// Static roster for the Kumospace-style agent room. Keeps the cast stable
// even when nothing has logged yet — the live /api/agent-room/status
// endpoint only tells us WHO ran recently, not who exists.
//
// Coordinates are percentages of the room canvas (x,y 0–100). Zones carve
// up the room into themed "areas" — leadgen HQ bottom-left, content studio
// top-right, etc. Avatars drift inside their zone so the room feels alive
// without having to track real positions.

export type AgentKind = "worker" | "integration" | "infra";

export interface AgentDef {
  id: string;
  name: string;
  kind: AgentKind;
  zone: ZoneId;
  emoji: string;
  /** One-liner shown on hover + in the side drawer. */
  role: string;
  /** Page to jump to when the user clicks "Open" in the drawer. */
  href?: string;
  /** Placement within the zone, 0–1 each — just spreads avatars out. */
  offset: { x: number; y: number };
}

export type ZoneId = "leadgen" | "content" | "comms" | "ops" | "integrations";

export interface ZoneDef {
  id: ZoneId;
  label: string;
  /** Top-left + bottom-right of zone as % of room. */
  rect: { x: number; y: number; w: number; h: number };
  /** Tailwind color family. */
  color: "emerald" | "purple" | "blue" | "amber" | "rose";
  icon: string;
  description: string;
}

export const ZONES: ZoneDef[] = [
  {
    id: "leadgen",
    label: "Lead Gen HQ",
    rect: { x: 2, y: 4, w: 30, h: 42 },
    color: "emerald",
    icon: "🎯",
    description: "Scraping, scoring, outreach and booking.",
  },
  {
    id: "content",
    label: "Content Studio",
    rect: { x: 34, y: 4, w: 32, h: 42 },
    color: "purple",
    icon: "🎨",
    description: "Writing, design, video and thumbnails.",
  },
  {
    id: "comms",
    label: "Comms Desk",
    rect: { x: 68, y: 4, w: 30, h: 42 },
    color: "blue",
    icon: "📡",
    description: "Email, SMS, voice and chat relays.",
  },
  {
    id: "ops",
    label: "Ops Room",
    rect: { x: 2, y: 50, w: 46, h: 46 },
    color: "amber",
    icon: "⚙️",
    description: "Onboarding, invoicing, CRM and reports.",
  },
  {
    id: "integrations",
    label: "Integrations Hub",
    rect: { x: 50, y: 50, w: 48, h: 46 },
    color: "rose",
    icon: "🔌",
    description: "Third-party services the agency depends on.",
  },
];

export const AGENTS: AgentDef[] = [
  // ── Lead Gen HQ ────────────────────────────────────────────────────
  {
    id: "lead-engine",
    name: "Lead Engine",
    kind: "worker",
    zone: "leadgen",
    emoji: "🎯",
    role: "Scrapes and scores prospects.",
    href: "/dashboard/leads",
    offset: { x: 0.2, y: 0.3 },
  },
  {
    id: "outreach",
    name: "Outreach",
    kind: "worker",
    zone: "leadgen",
    emoji: "📨",
    role: "Sends cold DMs, tracks replies.",
    href: "/dashboard/outreach-hub",
    offset: { x: 0.55, y: 0.25 },
  },
  {
    id: "proposal",
    name: "Proposal",
    kind: "worker",
    zone: "leadgen",
    emoji: "📋",
    role: "Writes and sends proposals on reply.",
    href: "/dashboard/proposals",
    offset: { x: 0.75, y: 0.55 },
  },
  {
    id: "scheduler",
    name: "Scheduler",
    kind: "worker",
    zone: "leadgen",
    emoji: "📅",
    role: "Books discovery calls from replies.",
    href: "/dashboard/calendar",
    offset: { x: 0.3, y: 0.7 },
  },

  // ── Content Studio ─────────────────────────────────────────────────
  {
    id: "content",
    name: "Content Writer",
    kind: "worker",
    zone: "content",
    emoji: "✍️",
    role: "Drafts posts, captions, email copy.",
    href: "/dashboard/content",
    offset: { x: 0.2, y: 0.3 },
  },
  {
    id: "thumbnail",
    name: "Thumbnail Pro",
    kind: "worker",
    zone: "content",
    emoji: "🖼️",
    role: "Photoshop-grade thumbnails + AI fill.",
    href: "/dashboard/thumbnail-generator",
    offset: { x: 0.55, y: 0.2 },
  },
  {
    id: "video-editor",
    name: "Video Editor",
    kind: "worker",
    zone: "content",
    emoji: "🎬",
    role: "Premiere-style multi-track NLE + auto-edit.",
    href: "/dashboard/video-editor",
    offset: { x: 0.8, y: 0.45 },
  },
  {
    id: "carousel",
    name: "Carousel",
    kind: "worker",
    zone: "content",
    emoji: "🎞️",
    role: "10-slide IG/LinkedIn carousel generator.",
    href: "/dashboard/carousel-generator",
    offset: { x: 0.25, y: 0.7 },
  },
  {
    id: "brand-kit",
    name: "Brand Kit",
    kind: "worker",
    zone: "content",
    emoji: "🎨",
    role: "Per-client palette + voice + logo.",
    href: "/dashboard/brand-kit",
    offset: { x: 0.6, y: 0.75 },
  },

  // ── Comms Desk ─────────────────────────────────────────────────────
  {
    id: "receptionist",
    name: "Voice Reception",
    kind: "worker",
    zone: "comms",
    emoji: "📞",
    role: "ElevenLabs agent handling inbound calls.",
    href: "/dashboard/eleven-agents",
    offset: { x: 0.2, y: 0.25 },
  },
  {
    id: "sms",
    name: "SMS Responder",
    kind: "worker",
    zone: "comms",
    emoji: "💬",
    role: "Twilio SMS with AI reply.",
    href: "/dashboard/conversations",
    offset: { x: 0.55, y: 0.2 },
  },
  {
    id: "email-campaign",
    name: "Email Blaster",
    kind: "worker",
    zone: "comms",
    emoji: "✉️",
    role: "Drip + broadcast sender via Resend.",
    href: "/dashboard/email-composer",
    offset: { x: 0.8, y: 0.5 },
  },
  {
    id: "chatbot",
    name: "Chat Widget",
    kind: "worker",
    zone: "comms",
    emoji: "💭",
    role: "Site-embedded visitor bot.",
    // No standalone page yet — drawer shows data panel but no Open button.
    offset: { x: 0.25, y: 0.7 },
  },
  {
    id: "meeting-recorder",
    name: "Meeting Recorder",
    kind: "worker",
    zone: "comms",
    emoji: "🎙️",
    role: "Records + transcribes + summarises.",
    href: "/dashboard/meetings",
    offset: { x: 0.6, y: 0.7 },
  },

  // ── Ops Room ───────────────────────────────────────────────────────
  {
    id: "onboarding",
    name: "Onboarding",
    kind: "worker",
    zone: "ops",
    emoji: "🚀",
    role: "New-client kickoff flow.",
    href: "/dashboard/onboard",
    offset: { x: 0.15, y: 0.25 },
  },
  {
    id: "invoice",
    name: "Invoicing",
    kind: "worker",
    zone: "ops",
    emoji: "💵",
    role: "Smart invoicing + Stripe payment links.",
    href: "/dashboard/invoices",
    offset: { x: 0.4, y: 0.2 },
  },
  {
    id: "crm",
    name: "CRM",
    kind: "worker",
    zone: "ops",
    emoji: "👥",
    role: "Deals, pipeline, activity log.",
    href: "/dashboard/crm",
    offset: { x: 0.65, y: 0.25 },
  },
  {
    id: "reports",
    name: "Client Reports",
    kind: "worker",
    zone: "ops",
    emoji: "📊",
    role: "Weekly auto-generated PDF reports.",
    href: "/dashboard/client-reports",
    offset: { x: 0.85, y: 0.2 },
  },
  {
    id: "ads-manager",
    name: "Ads Manager",
    kind: "worker",
    zone: "ops",
    emoji: "📈",
    role: "Meta + Google Ads control panel.",
    href: "/dashboard/ads-manager",
    offset: { x: 0.2, y: 0.6 },
  },
  {
    id: "automations",
    name: "Automations",
    kind: "worker",
    zone: "ops",
    emoji: "⚡",
    role: "Workflow triggers + chains.",
    href: "/dashboard/automations",
    offset: { x: 0.5, y: 0.65 },
  },
  {
    id: "chief",
    name: "Chief Agent",
    kind: "worker",
    zone: "ops",
    emoji: "🧠",
    role: "Orchestrates the rest.",
    href: "/dashboard/agent-supervisor",
    offset: { x: 0.85, y: 0.6 },
  },

  // ── Integrations Hub ───────────────────────────────────────────────
  {
    id: "resend",
    name: "Resend",
    kind: "integration",
    zone: "integrations",
    emoji: "📮",
    role: "Transactional email provider.",
    offset: { x: 0.1, y: 0.25 },
  },
  {
    id: "twilio",
    name: "Twilio",
    kind: "integration",
    zone: "integrations",
    emoji: "📱",
    role: "SMS + voice.",
    offset: { x: 0.3, y: 0.2 },
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    kind: "integration",
    zone: "integrations",
    emoji: "🎤",
    role: "Voice AI agent.",
    offset: { x: 0.5, y: 0.25 },
  },
  {
    id: "stripe",
    name: "Stripe",
    kind: "integration",
    zone: "integrations",
    emoji: "💳",
    role: "Payments + Connect.",
    offset: { x: 0.7, y: 0.2 },
  },
  {
    id: "anthropic",
    name: "Anthropic",
    kind: "infra",
    zone: "integrations",
    emoji: "🤖",
    role: "Claude LLM.",
    offset: { x: 0.9, y: 0.25 },
  },
  {
    id: "openai",
    name: "OpenAI",
    kind: "infra",
    zone: "integrations",
    emoji: "🔮",
    role: "Whisper + fallback LLM.",
    offset: { x: 0.15, y: 0.65 },
  },
  {
    id: "supabase",
    name: "Supabase",
    kind: "infra",
    zone: "integrations",
    emoji: "🗄️",
    role: "Postgres + Auth + Storage.",
    offset: { x: 0.35, y: 0.7 },
  },
  {
    id: "runpod",
    name: "RunPod",
    kind: "infra",
    zone: "integrations",
    emoji: "⚡",
    role: "GPU inference (FLUX + Hyperframes).",
    offset: { x: 0.55, y: 0.65 },
  },
  {
    id: "telegram",
    name: "Telegram",
    kind: "integration",
    zone: "integrations",
    emoji: "✈️",
    role: "Bot + admin notifications.",
    offset: { x: 0.75, y: 0.7 },
  },
  {
    id: "discord",
    name: "Discord",
    kind: "integration",
    zone: "integrations",
    emoji: "🎮",
    role: "Team + community ops.",
    offset: { x: 0.9, y: 0.65 },
  },
];

// Convenience map.
export const ZONE_BY_ID: Record<ZoneId, ZoneDef> = Object.fromEntries(
  ZONES.map(z => [z.id, z]),
) as Record<ZoneId, ZoneDef>;

// Resolve each agent's absolute position in the room from its zone + offset.
export function absolutePosition(agent: AgentDef): { x: number; y: number } {
  const zone = ZONE_BY_ID[agent.zone];
  // Keep a bit of padding inside the zone so avatars don't hug borders.
  const padX = zone.rect.w * 0.1;
  const padY = zone.rect.h * 0.2;
  const innerW = zone.rect.w - padX * 2;
  const innerH = zone.rect.h - padY * 2;
  return {
    x: zone.rect.x + padX + innerW * agent.offset.x,
    y: zone.rect.y + padY + innerH * agent.offset.y,
  };
}
