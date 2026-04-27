/**
 * Pixel Agent Office — agent roster.
 *
 * Each entry maps a logical agent (Echo, Lyra, Onyx, ...) to a position
 * in the 24×14 office grid, brand color, and the Supabase tables we
 * subscribe to so realtime DB events trigger their pixel character to
 * walk over to the relevant station and play a working animation.
 *
 * Grid coordinate system:
 *   • Origin (0, 0) is the top-left tile.
 *   • Tile size is 32 px in source resolution; the canvas is rendered at
 *     2× for retina, but coordinates are always in tile units here.
 *   • The grid is 24 wide × 14 tall = 768 × 448 source pixels =
 *     1536 × 896 retina render. ~16:9, fits desktop dashboards cleanly.
 *
 * Desk placement principle: cluster by domain.
 *   • Communications row (top): Echo (phones), Lyra (coaching booth).
 *   • Lead pit (middle-left): Sage (lead scoring), Reef (validation).
 *   • Content studios (middle-right): Pixel (easel), Casper (calendar).
 *   • Outreach floor (bottom-left): Onyx (mailroom), Nova (newsdesk).
 *   • Strategy office (right wing): Aria (Trinity), Maven (ad ops).
 */

export interface PixelAgent {
  /** Stable identifier used in `agent_activity_events.agent_key`. */
  key: string;
  /** Display name shown on hover, side-panel, legend. */
  name: string;
  /** Short role label rendered in the legend strip. */
  role: string;
  /**
   * Home desk tile (where the character idles when no events have fired).
   * Coordinate is the desk's anchor tile — characters render centred on
   * the tile they occupy.
   */
  homeDesk: { x: number; y: number };
  /**
   * Optional second station the character walks to when actively working.
   * For Echo this is the phone bank; for Onyx it's the mailroom dispatch
   * window. When null, work animations play at the home desk.
   */
  workDesk?: { x: number; y: number };
  /**
   * Idle quirks rotated through during long idle periods. The scene
   * controller picks one randomly every 6–10s of idle time so the
   * office never freezes into a static tableau.
   */
  idleQuirks: string[];
  /**
   * Brand-aligned tint used for the character's primary garment band,
   * the desk lamp glow, and the celebration particle burst. All values
   * derived from the ShortStack OS palette (lime, mint, indigo, coral,
   * amber, etc.) so the office reads as a brand-cohesive scene.
   */
  brandColor: number;
  /**
   * Supabase tables this agent monitors. INSERT / UPDATE events on these
   * tables trigger walks + work animations via `event-mapper.ts`. Order
   * doesn't matter — the realtime channel binds one filter per (table,
   * event-type) pair.
   */
  watchedTables: string[];
  /** Description used in the side panel header. */
  blurb: string;
}

/**
 * The 10-agent roster. Coordinates fit inside the 24×14 grid. The
 * canvas adds decor (plants, water cooler, cabinets) at remaining tiles
 * via the scene file — these positions are protected from decor
 * collisions automatically by `scene.reserveAgentTiles()`.
 */
export const AGENTS: readonly PixelAgent[] = [
  {
    key: "echo",
    name: "Echo",
    role: "Voice Receptionist",
    homeDesk: { x: 4, y: 2 },
    workDesk: { x: 8, y: 2 },
    idleQuirks: ["polish_phone", "stretch"],
    brandColor: 0x5e5bff,
    watchedTables: ["voice_calls"],
    blurb: "Picks up inbound calls, classifies intent, books or escalates.",
  },
  {
    key: "lyra",
    name: "Lyra",
    role: "AI Sales Coach",
    homeDesk: { x: 14, y: 2 },
    workDesk: { x: 17, y: 2 },
    idleQuirks: ["adjust_headset", "sip_coffee"],
    brandColor: 0xd4ff00,
    watchedTables: ["coach_analyses"],
    blurb: "Reviews recorded calls, scores rep performance, suggests fixes.",
  },
  {
    key: "sage",
    name: "Sage",
    role: "Lead Scorer",
    homeDesk: { x: 3, y: 6 },
    idleQuirks: ["crack_knuckles", "stretch"],
    brandColor: 0x7fe5b8,
    watchedTables: ["lead_scores", "lead_score_history"],
    blurb: "Reads every new lead and ranks intent + readiness.",
  },
  {
    key: "reef",
    name: "Reef",
    role: "Outreach Quality",
    homeDesk: { x: 7, y: 6 },
    idleQuirks: ["stamp_good", "stamp_bad"],
    brandColor: 0x3eddc7,
    watchedTables: ["contact_validations"],
    blurb: "Validates outreach contacts before any send happens.",
  },
  {
    key: "onyx",
    name: "Onyx",
    role: "Cold Email Runner",
    homeDesk: { x: 3, y: 11 },
    workDesk: { x: 7, y: 11 },
    idleQuirks: ["check_watch", "stamp_envelope"],
    brandColor: 0xff8a4c,
    watchedTables: ["cold_email_jobs", "outreach_log"],
    blurb: "Dispatches cold email batches with throttle + warmup awareness.",
  },
  {
    key: "nova",
    name: "Nova",
    role: "News Triggers",
    homeDesk: { x: 11, y: 11 },
    idleQuirks: ["read_newspaper", "gasp"],
    brandColor: 0xe8ff66,
    watchedTables: ["news_triggers"],
    blurb: "Watches the news beat for client-relevant intent signals.",
  },
  {
    key: "casper",
    name: "Casper",
    role: "Content Autopilot",
    homeDesk: { x: 14, y: 6 },
    idleQuirks: ["flip_calendar", "stretch"],
    brandColor: 0xffc062,
    watchedTables: ["scheduled_posts", "content_calendar"],
    blurb: "Schedules + publishes content across every connected channel.",
  },
  {
    key: "pixel",
    name: "Pixel",
    role: "Thumbnail Designer",
    homeDesk: { x: 18, y: 6 },
    idleQuirks: ["paint_easel"],
    brandColor: 0x7c5cff,
    watchedTables: ["thumbnail_jobs"],
    blurb: "Generates click-ready thumbnails on demand.",
  },
  {
    key: "maven",
    name: "Maven",
    role: "Ad Autopilot",
    homeDesk: { x: 18, y: 11 },
    idleQuirks: ["stare_at_dashboard", "sip_coffee"],
    brandColor: 0xf26063,
    watchedTables: ["ad_optimization_runs"],
    blurb: "Pulls campaign metrics and proposes optimisation moves.",
  },
  {
    key: "aria",
    name: "Aria",
    role: "Trinity Autonomous",
    homeDesk: { x: 21, y: 7 },
    idleQuirks: ["drop_sticky_note", "wander"],
    brandColor: 0xa78bfa,
    watchedTables: ["trinity_actions", "trinity_proposals"],
    blurb: "The autonomous orchestrator. Routes work, drafts proposals.",
  },
];

export type AgentKey = (typeof AGENTS)[number]["key"];

export const AGENT_BY_KEY: Record<string, PixelAgent> = AGENTS.reduce(
  (acc, agent) => {
    acc[agent.key] = agent;
    return acc;
  },
  {} as Record<string, PixelAgent>,
);

/** Set of every Supabase table the realtime channel needs to subscribe to. */
export const WATCHED_TABLES: readonly string[] = Array.from(
  new Set(AGENTS.flatMap((a) => a.watchedTables)),
).sort();

/** Office grid dimensions (in tile units). */
export const GRID = { cols: 24, rows: 14, tile: 32 } as const;

/** Render-time canvas size at retina (2x). Scene mounts at this resolution. */
export const CANVAS_SIZE = {
  width: GRID.cols * GRID.tile * 2, // 1536
  height: GRID.rows * GRID.tile * 2, // 896
} as const;
