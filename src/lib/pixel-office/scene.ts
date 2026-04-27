/**
 * Pixel Agent Office — PixiJS scene controller.
 *
 * Owns:
 *   • The PixiJS Application + canvas mount.
 *   • Floor + wall rendering (TileSprites built from baked tiles).
 *   • Decor placement (desks, plants, water cooler).
 *   • The 10 AgentCharacter instances.
 *   • The action dispatch queue (events come in, get routed to the
 *     right character).
 *   • Day/night tint based on local hour.
 *   • Visibility-aware framerate throttle (30fps when tab unfocused).
 *
 * Doesn't own:
 *   • DB subscriptions — page component owns the Supabase channel and
 *     pushes payloads into `dispatchAction()`.
 *   • UI overlay — the legend strip, side panel, and stat tiles are
 *     React components painted on top of the canvas.
 */

import { Application, Container, Sprite, Graphics, Text } from "pixi.js";
import {
  ensureCharacterTextures,
  ensureDecorTextures,
  ensureTileTextures,
  getDecorTexture,
  getTileTexture,
  PALETTE,
  disposeAtlas,
} from "./sprite-atlas";
import { AGENTS, GRID, type PixelAgent } from "./agents";
import { AgentCharacter } from "./agent-character";
import type { AgentAction } from "./event-mapper";

const TILE = GRID.tile;

/**
 * Layout reservations for the 24×14 grid. Each entry tells the scene
 * what decor to draw at a tile. Tiles not listed get a floor texture.
 *
 * The layout was hand-tuned to:
 *   • Keep agent home tiles (and walk paths between home + work) clear.
 *   • Cluster props by functional zone (phones near comm row, easel
 *     near content studios, etc.).
 *   • Leave breathing room — never more than 2 props in a 3×3 area.
 */
const DECOR_LAYOUT: Array<{ x: number; y: number; kind: string }> = [
  // Comm row (Echo + Lyra)
  { x: 4, y: 3, kind: "desk" },
  { x: 8, y: 3, kind: "phone_bank" },
  { x: 14, y: 3, kind: "desk" },
  { x: 17, y: 3, kind: "desk" },

  // Lead pit (Sage + Reef)
  { x: 3, y: 7, kind: "desk" },
  { x: 7, y: 7, kind: "desk" },

  // Content studios (Casper + Pixel)
  { x: 14, y: 7, kind: "desk" },
  { x: 18, y: 7, kind: "easel" },

  // Outreach floor (Onyx + Nova)
  { x: 3, y: 12, kind: "desk" },
  { x: 7, y: 12, kind: "mailroom" },
  { x: 11, y: 12, kind: "newsdesk" },

  // Strategy office (Aria + Maven)
  { x: 18, y: 12, kind: "desk" },
  { x: 21, y: 8, kind: "server_rack" },

  // Common — water cooler, plants, whiteboard
  { x: 11, y: 3, kind: "water_cooler" },
  { x: 22, y: 3, kind: "plant" },
  { x: 1, y: 3, kind: "plant" },
  { x: 11, y: 7, kind: "whiteboard" },
  { x: 22, y: 12, kind: "cabinet" },
  { x: 1, y: 7, kind: "plant" },
  { x: 1, y: 12, kind: "cabinet" },
];

const ZONE_LABELS: Array<{ x: number; y: number; text: string; color: number }> = [
  { x: 8, y: 0, text: "COMMUNICATIONS", color: PALETTE.indigo },
  { x: 4, y: 4, text: "LEAD PIT", color: PALETTE.mint },
  { x: 14, y: 4, text: "STUDIO", color: PALETTE.amber },
  { x: 4, y: 9, text: "OUTREACH", color: PALETTE.lime },
  { x: 17, y: 9, text: "STRATEGY", color: PALETTE.coral },
];

/**
 * The scene controller.
 *
 * Use `await Scene.create(host)` (factory) since PixiJS v8 init is
 * async; the constructor is private.
 */
export class Scene {
  private readonly host: HTMLElement;
  readonly app: Application;
  private readonly worldLayer: Container;
  private readonly floorLayer: Container;
  private readonly decorLayer: Container;
  private readonly characterLayer: Container;
  private readonly fxLayer: Container;
  private readonly tintOverlay: Graphics;
  private characters = new Map<string, AgentCharacter>();
  private rafFrameId: number | null = null;
  private lastFrameMs = performance.now();
  /** Throttle: 60fps focused, 30fps unfocused. */
  private targetFrameMs = 1000 / 60;
  /** When document hidden, suspend rendering entirely. */
  private suspended = false;
  /** Listener cleanup callbacks. */
  private cleanups: Array<() => void> = [];

  /** Notify the React layer when a character picks up an action. */
  onActionResolved?: (agentKey: string, action: AgentAction) => void;
  /** Notify the React layer when a character is clicked. */
  onAgentSelected?: (agentKey: string) => void;
  private selectedKey: string | null = null;

  private constructor(host: HTMLElement, app: Application) {
    this.host = host;
    this.app = app;
    this.worldLayer = new Container();
    this.floorLayer = new Container();
    this.decorLayer = new Container();
    this.characterLayer = new Container();
    this.fxLayer = new Container();
    this.tintOverlay = new Graphics();
    this.tintOverlay.eventMode = "none";

    // Order matters: floor → decor → characters → fx → tint
    this.worldLayer.addChild(this.floorLayer);
    this.worldLayer.addChild(this.decorLayer);
    this.worldLayer.addChild(this.characterLayer);
    this.worldLayer.addChild(this.fxLayer);
    this.worldLayer.addChild(this.tintOverlay);
    app.stage.addChild(this.worldLayer);
  }

  static async create(host: HTMLElement): Promise<Scene> {
    const app = new Application();
    await app.init({
      width: GRID.cols * TILE,
      height: GRID.rows * TILE,
      backgroundColor: PALETTE.floorBase,
      antialias: false,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
      preference: "webgl",
    });
    // Ensure pixel-perfect rendering (no smoothing on scale).
    if ("roundPixels" in app.renderer) {
      (app.renderer as { roundPixels?: boolean }).roundPixels = true;
    }
    host.appendChild(app.canvas);
    app.canvas.style.imageRendering = "pixelated";
    app.canvas.style.width = "100%";
    app.canvas.style.height = "100%";
    app.canvas.style.display = "block";
    app.canvas.style.borderRadius = "16px";

    const scene = new Scene(host, app);
    scene.bakeAtlases();
    scene.buildFloor();
    scene.buildDecor();
    scene.buildCharacters();
    scene.applyDayNightTint();
    scene.bindVisibility();
    scene.startLoop();
    return scene;
  }

  /* ──────────────────────────────────────────────────────────── */
  /* Build phases                                                 */
  /* ──────────────────────────────────────────────────────────── */

  private bakeAtlases(): void {
    ensureTileTextures(this.app);
    ensureDecorTextures(this.app);
    for (const agent of AGENTS) {
      ensureCharacterTextures(this.app, agent);
    }
  }

  private buildFloor(): void {
    // Top wall row (always wall texture).
    for (let x = 0; x < GRID.cols; x++) {
      const t = (x === 6 || x === 12 || x === 19) ? "wall_poster" : "wall";
      const s = new Sprite(getTileTexture(t));
      s.x = x * TILE;
      s.y = 0;
      s.width = TILE;
      s.height = TILE;
      this.floorLayer.addChild(s);
    }
    // Floor tiles for the rest of the grid.
    for (let y = 1; y < GRID.rows; y++) {
      for (let x = 0; x < GRID.cols; x++) {
        const t = (x + y) % 2 === 0 ? "floor" : "floor_alt";
        const s = new Sprite(getTileTexture(t));
        s.x = x * TILE;
        s.y = y * TILE;
        s.width = TILE;
        s.height = TILE;
        this.floorLayer.addChild(s);
      }
    }
    // Subtle vignette overlay (radial darkening at edges) drawn into
    // floorLayer so it sits below decor.
    const vignette = new Graphics();
    const w = GRID.cols * TILE;
    const h = GRID.rows * TILE;
    // Top edge fade
    vignette.rect(0, 0, w, 24).fill({ color: 0x000000, alpha: 0.45 });
    // Side edges
    vignette.rect(0, 0, 16, h).fill({ color: 0x000000, alpha: 0.35 });
    vignette.rect(w - 16, 0, 16, h).fill({ color: 0x000000, alpha: 0.35 });
    vignette.rect(0, h - 12, w, 12).fill({ color: 0x000000, alpha: 0.4 });
    this.floorLayer.addChild(vignette);

    // Zone labels — small uppercase text overlays so the office reads
    // as a planned floor, not a random arrangement.
    for (const z of ZONE_LABELS) {
      const t = new Text({
        text: z.text,
        style: {
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 9,
          fontWeight: "700",
          fill: z.color,
          letterSpacing: 1.5,
        },
      });
      t.alpha = 0.55;
      t.resolution = 2;
      t.x = z.x * TILE + 4;
      t.y = z.y * TILE + 4;
      this.floorLayer.addChild(t);
    }
  }

  private buildDecor(): void {
    for (const d of DECOR_LAYOUT) {
      const s = new Sprite(getDecorTexture(d.kind));
      s.x = d.x * TILE;
      s.y = d.y * TILE;
      s.width = TILE;
      s.height = TILE;
      this.decorLayer.addChild(s);
    }
  }

  private buildCharacters(): void {
    for (const agent of AGENTS) {
      const ch = new AgentCharacter(this.app, agent);
      ch.setOnActionResolved((action) => {
        this.onActionResolved?.(agent.key, action);
      });
      ch.container.on("pointertap", () => {
        this.selectAgent(agent.key);
      });
      this.characters.set(agent.key, ch);
      this.characterLayer.addChild(ch.container);
    }
  }

  /* ──────────────────────────────────────────────────────────── */
  /* Day / night                                                  */
  /* ──────────────────────────────────────────────────────────── */

  private applyDayNightTint(): void {
    // Tint overlay strength based on local hour. Offices read as warm
    // amber at dusk, cool indigo at night, neutral mid-day.
    const hour = new Date().getHours();
    let color = 0x000000;
    let alpha = 0.0;
    if (hour < 6 || hour >= 22) {
      color = 0x0a0a18;
      alpha = 0.35;
    } else if (hour >= 18) {
      color = 0x2a1410;
      alpha = 0.18;
    } else if (hour < 9) {
      color = 0x10182a;
      alpha = 0.12;
    }
    this.tintOverlay.clear();
    this.tintOverlay
      .rect(0, 0, GRID.cols * TILE, GRID.rows * TILE)
      .fill({ color, alpha });
  }

  /* ──────────────────────────────────────────────────────────── */
  /* Action dispatch                                              */
  /* ──────────────────────────────────────────────────────────── */

  /**
   * Route an event-mapper action to the right character. No-op if the
   * agent key isn't one we instantiated (agents removed from the roster
   * mid-flight).
   */
  dispatchAction(action: AgentAction | null): void {
    if (!action) return;
    const ch = this.characters.get(action.agentKey);
    if (!ch) return;
    ch.enqueue(action);
  }

  /**
   * Hydrate an agent's history list from the snapshot endpoint. Called
   * once on mount so the side panel shows real recent events from the
   * server even before any realtime activity.
   */
  hydrateAgentHistory(agentKey: string, history: AgentAction[]): void {
    const ch = this.characters.get(agentKey);
    ch?.setHistory(history);
  }

  /**
   * Programmatic agent selection — used by the React layer to drive
   * the canvas focus from outside (e.g. the legend strip click handler).
   */
  selectAgent(agentKey: string | null): void {
    if (this.selectedKey && this.selectedKey !== agentKey) {
      this.characters.get(this.selectedKey)?.setHighlighted(false);
    }
    this.selectedKey = agentKey;
    if (agentKey) {
      const ch = this.characters.get(agentKey);
      if (ch) {
        ch.setHighlighted(true);
        this.onAgentSelected?.(agentKey);
      }
    }
  }

  getAgent(agentKey: string): PixelAgent | undefined {
    return this.characters.get(agentKey)?.agent;
  }

  getCharacterHistory(agentKey: string): AgentAction[] {
    return this.characters.get(agentKey)?.history ?? [];
  }

  getCharacterCurrent(agentKey: string): AgentAction | null {
    return this.characters.get(agentKey)?.currentAction ?? null;
  }

  /* ──────────────────────────────────────────────────────────── */
  /* Loop + lifecycle                                             */
  /* ──────────────────────────────────────────────────────────── */

  private bindVisibility(): void {
    const onVisibility = (): void => {
      if (document.visibilityState === "hidden") {
        this.suspended = true;
      } else {
        this.suspended = false;
        this.targetFrameMs = 1000 / 60;
        this.lastFrameMs = performance.now();
      }
    };
    const onBlur = (): void => {
      this.targetFrameMs = 1000 / 30;
    };
    const onFocus = (): void => {
      this.targetFrameMs = 1000 / 60;
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    this.cleanups.push(() => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    });
  }

  private startLoop(): void {
    const loop = (nowMs: number): void => {
      this.rafFrameId = requestAnimationFrame(loop);
      if (this.suspended) return;
      const elapsed = nowMs - this.lastFrameMs;
      if (elapsed < this.targetFrameMs) return;
      this.lastFrameMs = nowMs - (elapsed % this.targetFrameMs);
      this.tick(nowMs);
    };
    this.rafFrameId = requestAnimationFrame(loop);
  }

  private tick(nowMs: number): void {
    this.characters.forEach((ch) => ch.tick(nowMs));
  }

  destroy(): void {
    if (this.rafFrameId !== null) cancelAnimationFrame(this.rafFrameId);
    this.cleanups.forEach((c) => c());
    this.characters.forEach((ch) => ch.destroy());
    this.characters.clear();
    if (this.host.contains(this.app.canvas)) {
      this.host.removeChild(this.app.canvas);
    }
    this.app.destroy(true, { children: true, texture: true });
    disposeAtlas();
  }
}
