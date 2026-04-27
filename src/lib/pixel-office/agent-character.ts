/**
 * Pixel Agent Office — per-agent character state machine.
 *
 * Each `AgentCharacter` instance owns:
 *   • A PixiJS `Sprite` displaying the current frame.
 *   • A small particle Container for celebration sparkles + alert
 *     exclamation marks.
 *   • A finite-state machine: idle → walking → working → returning →
 *     celebrating → idle.
 *
 * The scene controller owns the canvas and the action queue; characters
 * only know their own state. This keeps animation logic isolated and
 * lets us add per-agent quirks (Lyra sips coffee, Onyx stamps an
 * envelope) without bloating the scene.
 *
 * Movement is grid-snapped: characters teleport between tiles in
 * 200 ms steps with frame swaps, not real per-pixel pathfinding. The
 * effect reads as pixel-art animation, not 3D motion.
 */

import { Container, Sprite, Graphics, type Application, Text } from "pixi.js";
import {
  getCharacterTexture,
  type Direction,
  PALETTE,
} from "./sprite-atlas";
import { GRID, type PixelAgent } from "./agents";
import type { AgentAction } from "./event-mapper";

type CharacterState =
  | "idle"
  | "walking_to_work"
  | "working"
  | "returning_home"
  | "celebrating"
  | "alerting";

interface QueuedAction {
  action: AgentAction;
  /** When the action becomes ready to play (we throttle bursts). */
  readyAt: number;
}

const TILE_PX = GRID.tile;
const STEP_MS = 200;
const WORK_FRAME_MS = 280;
const WORK_DURATION_MS = 4500;
const CELEBRATE_DURATION_MS = 1800;
const ALERT_DURATION_MS = 1200;
const IDLE_QUIRK_INTERVAL_MS = 6500;

export class AgentCharacter {
  readonly agent: PixelAgent;
  readonly container: Container;
  /**
   * Most recent action picked up from the queue. The side panel reads
   * this to render "current activity". Null until the first event.
   */
  currentAction: AgentAction | null = null;
  /** Recent action history (most recent first). Capped at 50. */
  history: AgentAction[] = [];

  /** Whether this character is currently lit up (clicked / hovered). */
  highlighted = false;

  private readonly app: Application;
  private readonly sprite: Sprite;
  private readonly halo: Graphics;
  private readonly speechBubble: Container;
  private readonly speechText: Text;
  private readonly nameLabel: Text;
  private state: CharacterState = "idle";
  private direction: Direction = "down";
  /** Current grid position. */
  private gridX: number;
  private gridY: number;
  /** Path for current walk (queue of tiles to visit, head consumed first). */
  private path: Array<{ x: number; y: number }> = [];
  /** Animation frame switching for walk + work. */
  private frameTimerMs = 0;
  private frameToggle = false;
  private stateTimerMs = 0;
  private idleQuirkTimerMs = 0;
  private particles: Container;
  private lastTickMs = performance.now();
  private actionQueue: QueuedAction[] = [];
  /** Callback fired when the character picks up + completes an action. */
  private onActionResolved?: (action: AgentAction) => void;

  constructor(app: Application, agent: PixelAgent) {
    this.app = app;
    this.agent = agent;
    this.gridX = agent.homeDesk.x;
    this.gridY = agent.homeDesk.y;

    this.container = new Container();
    this.container.eventMode = "static";
    this.container.cursor = "pointer";
    this.container.x = this.gridX * TILE_PX;
    this.container.y = this.gridY * TILE_PX;

    // Halo — drawn underneath the sprite, lit when highlighted or
    // mid-celebration. Uses brand color.
    this.halo = new Graphics();
    this.halo.alpha = 0;
    this.container.addChild(this.halo);

    this.sprite = new Sprite(getCharacterTexture(agent.key, "idle_down"));
    this.sprite.width = TILE_PX;
    this.sprite.height = TILE_PX;
    this.container.addChild(this.sprite);

    // Floating name label, only visible while hovered or celebrating.
    this.nameLabel = new Text({
      text: agent.name,
      style: {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 9,
        fontWeight: "700",
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 2, alpha: 0.85 },
      },
    });
    this.nameLabel.anchor.set(0.5, 1);
    this.nameLabel.x = TILE_PX / 2;
    this.nameLabel.y = -2;
    this.nameLabel.alpha = 0;
    this.nameLabel.resolution = 2;
    this.container.addChild(this.nameLabel);

    // Speech bubble — single-line summary of the active action.
    this.speechBubble = new Container();
    this.speechBubble.alpha = 0;
    this.speechBubble.x = TILE_PX / 2;
    this.speechBubble.y = -16;
    const bubbleBg = new Graphics();
    this.speechBubble.addChild(bubbleBg);
    this.speechText = new Text({
      text: "",
      style: {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 8,
        fontWeight: "600",
        fill: 0xeaeaf0,
        align: "center",
      },
    });
    this.speechText.anchor.set(0.5, 1);
    this.speechText.resolution = 2;
    this.speechBubble.addChild(this.speechText);
    this.container.addChild(this.speechBubble);

    this.particles = new Container();
    this.container.addChild(this.particles);

    // Hover behaviour — show name, slight brightness boost.
    this.container.on("pointerenter", () => {
      if (!this.highlighted) {
        this.nameLabel.alpha = 1;
      }
    });
    this.container.on("pointerleave", () => {
      if (!this.highlighted) {
        this.nameLabel.alpha = 0;
      }
    });
  }

  setOnActionResolved(cb: (action: AgentAction) => void): void {
    this.onActionResolved = cb;
  }

  setHighlighted(on: boolean): void {
    this.highlighted = on;
    this.nameLabel.alpha = on ? 1 : 0;
    if (on) {
      this.drawHalo(0.6);
    } else {
      this.halo.alpha = 0;
    }
  }

  /**
   * Replace the recent-history list. Used for hydration from the
   * server snapshot.
   */
  setHistory(events: AgentAction[]): void {
    this.history = events.slice(0, 50);
    this.currentAction = events[0] ?? null;
  }

  /**
   * Enqueue an action. We cap to 3 pending per character — overflow is
   * dropped to keep the scene responsive when a producer floods events.
   */
  enqueue(action: AgentAction): void {
    if (this.actionQueue.length >= 3) {
      // Drop the oldest pending so we always honour the latest event.
      this.actionQueue.shift();
    }
    this.actionQueue.push({ action, readyAt: performance.now() });
  }

  /**
   * Tick called from the scene's main loop. Advances the FSM, swaps
   * frames, drains the queue.
   */
  tick(nowMs: number): void {
    const dtMs = Math.min(64, nowMs - this.lastTickMs);
    this.lastTickMs = nowMs;
    this.frameTimerMs += dtMs;
    this.stateTimerMs += dtMs;
    this.idleQuirkTimerMs += dtMs;

    switch (this.state) {
      case "idle":
        this.tickIdle(dtMs);
        break;
      case "walking_to_work":
      case "returning_home":
        this.tickWalk(dtMs);
        break;
      case "working":
        this.tickWork(dtMs);
        break;
      case "celebrating":
        this.tickCelebrate(dtMs);
        break;
      case "alerting":
        this.tickAlert(dtMs);
        break;
    }

    // Speech bubble gentle bobbing
    if (this.speechBubble.alpha > 0.05) {
      this.speechBubble.y = -16 + Math.sin(nowMs / 320) * 1.2;
    }

    // Halo pulse while highlighted
    if (this.highlighted) {
      const pulse = 0.4 + Math.sin(nowMs / 320) * 0.2;
      this.drawHalo(pulse);
    }
  }

  /* ────────────────────────────────────────────────────────────── */
  /* State handlers                                                 */
  /* ────────────────────────────────────────────────────────────── */

  private tickIdle(_dt: number): void {
    // Pick up next action from queue.
    if (this.actionQueue.length > 0) {
      const next = this.actionQueue.shift();
      if (next) this.startAction(next.action);
      return;
    }

    // Idle frame — alternate slowly to suggest breathing.
    if (this.frameTimerMs > 700) {
      this.frameToggle = !this.frameToggle;
      this.frameTimerMs = 0;
      // Idle pose: just `idle_<direction>`. We re-set the texture
      // anyway so the sprite matches the agent's current direction
      // even if the FSM left it pointed elsewhere on a previous walk.
      this.sprite.texture = getCharacterTexture(
        this.agent.key,
        `idle_${this.direction}`,
      );
    }

    // Idle quirk — every IDLE_QUIRK_INTERVAL_MS, briefly play a short
    // "work" pose at the home desk to suggest fidgeting (sip coffee,
    // adjust headset, etc.). Cheap and effective.
    if (this.idleQuirkTimerMs > IDLE_QUIRK_INTERVAL_MS) {
      this.idleQuirkTimerMs = 0;
      this.frameToggle = !this.frameToggle;
      this.sprite.texture = getCharacterTexture(
        this.agent.key,
        this.frameToggle
          ? `work_${this.direction}_a`
          : `work_${this.direction}_b`,
      );
    }
  }

  private tickWalk(_dt: number): void {
    if (this.frameTimerMs >= STEP_MS) {
      this.frameTimerMs = 0;
      const next = this.path.shift();
      if (!next) {
        // Arrived.
        this.gridX = Math.round(this.container.x / TILE_PX);
        this.gridY = Math.round(this.container.y / TILE_PX);
        if (this.state === "walking_to_work") {
          this.state = "working";
          this.stateTimerMs = 0;
          // Face down toward the desk.
          this.direction = "down";
          this.sprite.texture = getCharacterTexture(
            this.agent.key,
            "work_down_a",
          );
        } else {
          this.state = "idle";
          this.frameToggle = false;
          this.direction = "down";
          this.sprite.texture = getCharacterTexture(
            this.agent.key,
            "idle_down",
          );
          // Reached home — fade the speech bubble out.
          this.fadeBubbleOut();
        }
        return;
      }
      // Compute direction from current → next.
      const dx = next.x - this.gridX;
      const dy = next.y - this.gridY;
      if (Math.abs(dx) >= Math.abs(dy)) {
        this.direction = dx > 0 ? "right" : "left";
      } else {
        this.direction = dy > 0 ? "down" : "up";
      }
      this.gridX = next.x;
      this.gridY = next.y;
      this.frameToggle = !this.frameToggle;
      this.sprite.texture = getCharacterTexture(
        this.agent.key,
        this.frameToggle
          ? `walk_${this.direction}_a`
          : `walk_${this.direction}_b`,
      );
    }
    // Tween container position smoothly between grid cells for the
    // last STEP_MS so movement reads as a step rather than teleport.
    const targetX = this.gridX * TILE_PX;
    const targetY = this.gridY * TILE_PX;
    const lerp = Math.min(1, this.frameTimerMs / STEP_MS);
    this.container.x = lerpScalar(this.container.x, targetX, lerp * 0.4);
    this.container.y = lerpScalar(this.container.y, targetY, lerp * 0.4);
    // Snap once we're close enough.
    if (
      Math.abs(this.container.x - targetX) < 0.5 &&
      Math.abs(this.container.y - targetY) < 0.5
    ) {
      this.container.x = targetX;
      this.container.y = targetY;
    }
  }

  private tickWork(_dt: number): void {
    if (this.frameTimerMs >= WORK_FRAME_MS) {
      this.frameTimerMs = 0;
      this.frameToggle = !this.frameToggle;
      this.sprite.texture = getCharacterTexture(
        this.agent.key,
        this.frameToggle ? "work_down_a" : "work_down_b",
      );
    }
    if (this.stateTimerMs >= WORK_DURATION_MS) {
      this.startReturnHome();
    }
  }

  private tickCelebrate(_dt: number): void {
    // Sparkle particles
    if (this.frameTimerMs > 90) {
      this.frameTimerMs = 0;
      this.spawnSparkle();
    }
    this.tickParticles();
    if (this.stateTimerMs >= CELEBRATE_DURATION_MS) {
      this.particles.removeChildren();
      this.startReturnHome();
    }
  }

  private tickAlert(_dt: number): void {
    this.tickParticles();
    if (this.stateTimerMs >= ALERT_DURATION_MS) {
      this.particles.removeChildren();
      this.state = "idle";
    }
  }

  /* ────────────────────────────────────────────────────────────── */
  /* Action plumbing                                                */
  /* ────────────────────────────────────────────────────────────── */

  private startAction(action: AgentAction): void {
    this.currentAction = action;
    this.history = [action, ...this.history].slice(0, 50);
    this.showSpeechBubble(action.summary);

    switch (action.kind) {
      case "walk_to_work": {
        const target = action.workTile ?? this.agent.workDesk ?? this.agent.homeDesk;
        this.path = makeStraightPath(
          this.gridX,
          this.gridY,
          target.x,
          target.y,
        );
        this.state = "walking_to_work";
        this.frameTimerMs = STEP_MS; // play first step immediately
        break;
      }
      case "play_work": {
        // Work in place at home desk.
        this.state = "working";
        this.frameTimerMs = 0;
        this.stateTimerMs = 0;
        this.direction = "down";
        this.sprite.texture = getCharacterTexture(
          this.agent.key,
          "work_down_a",
        );
        break;
      }
      case "celebrate": {
        this.state = "celebrating";
        this.stateTimerMs = 0;
        this.frameTimerMs = 0;
        this.direction = "down";
        this.sprite.texture = getCharacterTexture(
          this.agent.key,
          "celebrate",
        );
        this.drawHalo(0.85);
        break;
      }
      case "alert": {
        this.state = "alerting";
        this.stateTimerMs = 0;
        this.frameTimerMs = 0;
        this.spawnAlertMark();
        break;
      }
    }
    this.onActionResolved?.(action);
  }

  private startReturnHome(): void {
    this.fadeBubbleOut();
    if (
      this.gridX === this.agent.homeDesk.x &&
      this.gridY === this.agent.homeDesk.y
    ) {
      this.state = "idle";
      this.direction = "down";
      this.sprite.texture = getCharacterTexture(this.agent.key, "idle_down");
      return;
    }
    this.path = makeStraightPath(
      this.gridX,
      this.gridY,
      this.agent.homeDesk.x,
      this.agent.homeDesk.y,
    );
    this.state = "returning_home";
    this.frameTimerMs = STEP_MS;
  }

  /* ────────────────────────────────────────────────────────────── */
  /* Visual helpers                                                 */
  /* ────────────────────────────────────────────────────────────── */

  private drawHalo(alpha: number): void {
    this.halo.clear();
    this.halo.circle(TILE_PX / 2, TILE_PX - 4, TILE_PX / 2 - 2);
    this.halo.fill({ color: this.agent.brandColor, alpha: 0.18 });
    this.halo.circle(TILE_PX / 2, TILE_PX - 4, TILE_PX / 2 - 6);
    this.halo.fill({ color: this.agent.brandColor, alpha: 0.32 });
    this.halo.alpha = alpha;
  }

  private showSpeechBubble(text: string): void {
    this.speechText.text = text.length > 32 ? `${text.slice(0, 30)}…` : text;
    this.speechBubble.alpha = 1;
    // Re-draw bubble background to fit new text width.
    const bg = this.speechBubble.children[0] as Graphics;
    bg.clear();
    const padding = 4;
    const w = Math.max(40, this.speechText.width + padding * 2);
    const h = this.speechText.height + padding * 2;
    bg.roundRect(-w / 2, -h - 2, w, h, 4);
    bg.fill({ color: 0x0a0a0f, alpha: 0.92 });
    bg.stroke({ color: this.agent.brandColor, width: 1, alpha: 0.65 });
    // Speech tail
    bg.moveTo(-3, -2).lineTo(0, 2).lineTo(3, -2);
    bg.fill({ color: 0x0a0a0f, alpha: 0.92 });
    this.speechText.x = 0;
    this.speechText.y = -padding;
  }

  private fadeBubbleOut(): void {
    this.speechBubble.alpha = Math.max(0, this.speechBubble.alpha - 0.04);
  }

  private spawnSparkle(): void {
    const g = new Graphics();
    const colors = [this.agent.brandColor, PALETTE.lime, PALETTE.whiteHard];
    const c = colors[Math.floor(Math.random() * colors.length)] ?? PALETTE.lime;
    g.rect(-1, -1, 2, 2).fill(c);
    g.x = TILE_PX / 2 + (Math.random() - 0.5) * 18;
    g.y = TILE_PX / 2 - 2;
    // Velocity components stashed on the graphics for tickParticles
    (g as Graphics & { vx: number; vy: number; ageMs: number }).vx =
      (Math.random() - 0.5) * 1.6;
    (g as Graphics & { vx: number; vy: number; ageMs: number }).vy =
      -1.2 - Math.random() * 1.4;
    (g as Graphics & { vx: number; vy: number; ageMs: number }).ageMs = 0;
    this.particles.addChild(g);
  }

  private spawnAlertMark(): void {
    const g = new Graphics();
    g.rect(-1, -8, 2, 6).fill(PALETTE.coral);
    g.rect(-1, 0, 2, 2).fill(PALETTE.coral);
    g.x = TILE_PX / 2;
    g.y = 4;
    (g as Graphics & { vx: number; vy: number; ageMs: number }).vx = 0;
    (g as Graphics & { vx: number; vy: number; ageMs: number }).vy = -0.4;
    (g as Graphics & { vx: number; vy: number; ageMs: number }).ageMs = 0;
    this.particles.addChild(g);
  }

  private tickParticles(): void {
    const toRemove: number[] = [];
    this.particles.children.forEach((child, idx) => {
      const p = child as Graphics & {
        vx?: number;
        vy?: number;
        ageMs?: number;
      };
      p.ageMs = (p.ageMs ?? 0) + 16;
      p.vx = p.vx ?? 0;
      p.vy = p.vy ?? 0;
      p.vy += 0.05;
      p.x += p.vx;
      p.y += p.vy;
      p.alpha = Math.max(0, 1 - p.ageMs / 1200);
      if (p.alpha <= 0.02) toRemove.push(idx);
    });
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      if (idx === undefined) continue;
      const child = this.particles.children[idx];
      if (child) this.particles.removeChild(child);
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

/* ──────────────────────────────────────────────────────────────────── */
/* Path helpers                                                         */
/* ──────────────────────────────────────────────────────────────────── */

function lerpScalar(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Naive L-shape path: walk horizontally first, then vertically. The
 * office grid is wide-open (we deliberately don't place decor blocking
 * agent travel paths) so this is good enough — no need for A*.
 */
function makeStraightPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Array<{ x: number; y: number }> {
  const path: Array<{ x: number; y: number }> = [];
  let x = fromX;
  let y = fromY;
  while (x !== toX) {
    x += x < toX ? 1 : -1;
    path.push({ x, y });
  }
  while (y !== toY) {
    y += y < toY ? 1 : -1;
    path.push({ x, y });
  }
  return path;
}
