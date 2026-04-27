/**
 * Pixel Agent Office — procedural sprite atlas.
 *
 * All sprites are drawn at runtime via PixiJS Graphics primitives, then
 * baked into RenderTextures. This avoids shipping any binary sprite
 * sheets (zero bundle weight for art) and keeps every sprite 100%
 * original — explicitly licensed CC0 by the project for any future
 * reuse. See ASSET_CREDITS.md.
 *
 * Why procedural instead of imported pixel art?
 *   • Zero bundle bytes for sprites (the asset budget is <500 KB; we
 *     spend it elsewhere if ever needed).
 *   • Per-agent brand-color tinting at the source — no PixiJS color
 *     matrix at runtime, so animations stay 60fps even with 10 agents
 *     walking simultaneously.
 *   • Easy to evolve: adding a new agent is a 1-row change in
 *     `agents.ts`; no asset pipeline needed.
 *
 * Sprite dimensions:
 *   • Character: 32×32 source pixels (matches grid tile). 4 directions
 *     × 4 walk frames + 2 work frames + 1 celebrate frame = 19 frames
 *     per character.
 *   • Tile: 64×64 source pixels (one rendered tile = 2×2 grid spaces in
 *     drawing terms; the floor uses a 2×2 visual repeating pattern).
 *   • Decor: 64×64.
 */

import {
  Application,
  Container,
  Graphics,
  RenderTexture,
  Texture,
  Sprite,
} from "pixi.js";
import { GRID, type PixelAgent } from "./agents";

/* ──────────────────────────────────────────────────────────────────── */
/* Palette                                                              */
/* ──────────────────────────────────────────────────────────────────── */

/**
 * ShortStack OS — pixel office palette. All colors derived from the
 * brand system (lime hero, indigo tools, mint accents, OLED dark base)
 * but flattened to a tighter 5-step pixel-art ramp per zone so the
 * screen reads as crisp pixel art, not a gradient soup.
 */
export const PALETTE = {
  // Floor — warm dark base with a barely-perceptible grid for depth.
  floorBase: 0x141416,
  floorAlt: 0x191920,
  floorGrid: 0x222230,
  floorAccent: 0x2a2840,

  // Wall — slightly cooler, with a single accent strip near floor level.
  wallBase: 0x0d0d12,
  wallTop: 0x0a0a0f,
  wallTrim: 0x1f1f2a,

  // Desk wood — warm walnut so the agents pop off it.
  deskTop: 0x4a3520,
  deskSide: 0x2e2014,
  deskShine: 0x6b4d2e,

  // Computer / monitor — OLED black with lime power LED.
  monitorBezel: 0x0a0a0a,
  monitorScreen: 0x0d141f,
  monitorScreenOn: 0x1d2b4f,

  // Brand
  lime: 0xd4ff00,
  limeDark: 0x9bbf00,
  indigo: 0x5e5bff,
  mint: 0x7fe5b8,
  coral: 0xf26063,
  amber: 0xffc062,

  // Character base
  skinDark: 0x4a3a30,
  skinLight: 0x7a5e4a,
  shadow: 0x000000,

  // Highlights
  whiteSoft: 0xeaeaf0,
  whiteHard: 0xffffff,
} as const;

/* ──────────────────────────────────────────────────────────────────── */
/* Frame definitions                                                    */
/* ──────────────────────────────────────────────────────────────────── */

export type Direction = "down" | "up" | "left" | "right";
export const DIRECTIONS: readonly Direction[] = ["down", "up", "left", "right"];

export type CharacterFrameKey =
  | `idle_${Direction}`
  | `walk_${Direction}_a`
  | `walk_${Direction}_b`
  | `work_${Direction}_a`
  | `work_${Direction}_b`
  | "celebrate";

/** Cached textures keyed by `${agentKey}/${frameKey}`. */
const CHARACTER_TEXTURES = new Map<string, Texture>();
let TILES: Map<string, Texture> | null = null;
let DECOR: Map<string, Texture> | null = null;

/* ──────────────────────────────────────────────────────────────────── */
/* Character rendering                                                  */
/* ──────────────────────────────────────────────────────────────────── */

interface CharacterDrawOptions {
  body: number;
  hair: number;
  skin: number;
  /** Frame variant: a/b for walk cycle, work pose A/B, idle, celebrate. */
  variant: "idle" | "walk_a" | "walk_b" | "work_a" | "work_b" | "celebrate";
  direction: Direction;
}

/**
 * Draw a 32×32 chibi pixel character with brand-color body, neutral
 * skin, and direction-sensitive face dots. The character occupies
 * roughly the bottom 28 px of the 32-px tile so they sit on top of the
 * floor grid line.
 *
 * Pixel layout (downward-facing reference):
 *
 *   row 8–11   head (5×5) with hair cap
 *   row 12–13  shoulders + brand-band stripe
 *   row 14–19  torso
 *   row 20–24  legs (with walk-frame offset)
 *   row 25–27  shadow ellipse
 *
 * Sub-pixel strokes are the signature of intentional pixel art, so each
 * shape uses 1 px outlines rather than smooth fills.
 */
function drawCharacter(
  g: Graphics,
  opts: CharacterDrawOptions,
): void {
  const { body, hair, skin, variant, direction } = opts;

  // Drop shadow — soft, off-axis. Drawn first so the character
  // overlays it.
  g.ellipse(16, 28, 7, 2).fill({ color: PALETTE.shadow, alpha: 0.45 });

  // ── Legs ──
  // Walk frames swap which leg is forward via a 1-px y offset.
  const legSwap = variant === "walk_a";
  const legSwapB = variant === "walk_b";
  const lLegY = legSwap ? 21 : legSwapB ? 22 : 21;
  const rLegY = legSwap ? 22 : legSwapB ? 21 : 21;

  // Pant block
  g.rect(13, lLegY, 2, 4).fill(0x1a1a22);
  g.rect(17, rLegY, 2, 4).fill(0x1a1a22);
  // Boots
  g.rect(13, 25, 2, 1).fill(0x080810);
  g.rect(17, 25, 2, 1).fill(0x080810);

  // ── Torso (brand color) ──
  g.rect(11, 14, 10, 7).fill(body);
  // Subtle highlight strip on left edge for shape
  g.rect(11, 14, 1, 7).fill({ color: PALETTE.whiteSoft, alpha: 0.18 });
  // Brand-band stripe at chest
  g.rect(11, 17, 10, 1).fill({ color: PALETTE.whiteSoft, alpha: 0.35 });

  // ── Arms ──
  const armSwapDown = variant === "walk_a" ? -1 : variant === "walk_b" ? 1 : 0;
  const armSwapUp = -armSwapDown;
  // Left arm
  g.rect(10, 15 + armSwapDown, 1, 5).fill(body);
  g.rect(10, 19 + armSwapDown, 1, 1).fill(skin); // hand
  // Right arm
  g.rect(21, 15 + armSwapUp, 1, 5).fill(body);
  g.rect(21, 19 + armSwapUp, 1, 1).fill(skin); // hand

  // Work pose — both arms forward at desk level
  if (variant === "work_a" || variant === "work_b") {
    g.rect(10, 15, 1, 4).fill(body);
    g.rect(11, 18, 1, 1).fill(skin);
    g.rect(21, 15, 1, 4).fill(body);
    g.rect(20, 18, 1, 1).fill(skin);
    // Typing bounce — work_b raises hands 1 px
    if (variant === "work_b") {
      g.rect(11, 17, 1, 1).fill(skin);
      g.rect(20, 17, 1, 1).fill(skin);
    }
  }

  // Celebrate pose — arms up
  if (variant === "celebrate") {
    g.rect(10, 11, 1, 5).fill(body);
    g.rect(10, 10, 1, 1).fill(skin);
    g.rect(21, 11, 1, 5).fill(body);
    g.rect(21, 10, 1, 1).fill(skin);
  }

  // ── Head ──
  // Skin block 6×6
  g.rect(13, 8, 6, 6).fill(skin);
  // Hair cap — direction-dependent shape
  if (direction === "down" || direction === "left" || direction === "right") {
    g.rect(13, 7, 6, 2).fill(hair);
    g.rect(12, 8, 1, 2).fill(hair);
    g.rect(19, 8, 1, 2).fill(hair);
  }
  if (direction === "up") {
    // Back of head — fully covered
    g.rect(13, 7, 6, 4).fill(hair);
    g.rect(12, 8, 1, 3).fill(hair);
    g.rect(19, 8, 1, 3).fill(hair);
  }

  // Face — eyes only when facing down/left/right.
  if (direction === "down") {
    g.rect(14, 11, 1, 1).fill(PALETTE.shadow);
    g.rect(17, 11, 1, 1).fill(PALETTE.shadow);
  }
  if (direction === "left") {
    g.rect(13, 11, 1, 1).fill(PALETTE.shadow);
    g.rect(15, 11, 1, 1).fill(PALETTE.shadow);
  }
  if (direction === "right") {
    g.rect(16, 11, 1, 1).fill(PALETTE.shadow);
    g.rect(18, 11, 1, 1).fill(PALETTE.shadow);
  }

  // Subtle body outline so the character separates from the desk
  g.rect(11, 14, 10, 1).fill({ color: PALETTE.shadow, alpha: 0.35 });
  g.rect(11, 20, 10, 1).fill({ color: PALETTE.shadow, alpha: 0.35 });
}

/**
 * Bake every frame for a single agent into a texture cache. Idempotent
 * — re-calling for the same agent is a no-op.
 */
export function ensureCharacterTextures(
  app: Application,
  agent: PixelAgent,
): void {
  const cacheKey = `${agent.key}/idle_down`;
  if (CHARACTER_TEXTURES.has(cacheKey)) return;

  const skin = pickSkinForAgent(agent.key);
  const hair = pickHairForAgent(agent.key);

  const variants: Array<{
    key: string;
    variant: CharacterDrawOptions["variant"];
    direction: Direction;
  }> = [];

  for (const direction of DIRECTIONS) {
    variants.push({ key: `idle_${direction}`, variant: "idle", direction });
    variants.push({
      key: `walk_${direction}_a`,
      variant: "walk_a",
      direction,
    });
    variants.push({
      key: `walk_${direction}_b`,
      variant: "walk_b",
      direction,
    });
    variants.push({
      key: `work_${direction}_a`,
      variant: "work_a",
      direction,
    });
    variants.push({
      key: `work_${direction}_b`,
      variant: "work_b",
      direction,
    });
  }
  variants.push({ key: "celebrate", variant: "celebrate", direction: "down" });

  for (const v of variants) {
    const g = new Graphics();
    drawCharacter(g, {
      body: agent.brandColor,
      hair,
      skin,
      variant: v.variant,
      direction: v.direction,
    });
    const tx = RenderTexture.create({
      width: GRID.tile,
      height: GRID.tile,
      antialias: false,
      resolution: 2,
    });
    app.renderer.render({ container: g, target: tx });
    g.destroy();
    CHARACTER_TEXTURES.set(`${agent.key}/${v.key}`, tx);
  }
}

export function getCharacterTexture(
  agentKey: string,
  frameKey: CharacterFrameKey,
): Texture {
  const tx = CHARACTER_TEXTURES.get(`${agentKey}/${frameKey}`);
  if (!tx) {
    // Fallback to idle_down — should never happen under normal use, but
    // this keeps the canvas alive instead of throwing during a hot-
    // reload race.
    return CHARACTER_TEXTURES.get(`${agentKey}/idle_down`) ?? Texture.EMPTY;
  }
  return tx;
}

/* ──────────────────────────────────────────────────────────────────── */
/* Tile rendering — floor, wall, accent strips                          */
/* ──────────────────────────────────────────────────────────────────── */

export function ensureTileTextures(app: Application): Map<string, Texture> {
  if (TILES) return TILES;
  TILES = new Map();

  // Floor base — checkerboard with a 1-px grid line per tile so the
  // grid reads as designed flooring rather than CSS background.
  const floor = new Graphics();
  floor.rect(0, 0, GRID.tile, GRID.tile).fill(PALETTE.floorBase);
  floor.rect(0, 0, GRID.tile, 1).fill(PALETTE.floorGrid);
  floor.rect(0, 0, 1, GRID.tile).fill(PALETTE.floorGrid);
  // Subtle inner glow (tiny dot pattern, low alpha)
  floor.rect(8, 8, 1, 1).fill({ color: PALETTE.floorAccent, alpha: 0.4 });
  floor.rect(24, 22, 1, 1).fill({ color: PALETTE.floorAccent, alpha: 0.3 });
  TILES.set("floor", bake(app, floor, GRID.tile, GRID.tile));
  floor.destroy();

  // Floor alt — slightly different gridless tile for variety.
  const floorAlt = new Graphics();
  floorAlt.rect(0, 0, GRID.tile, GRID.tile).fill(PALETTE.floorAlt);
  floorAlt.rect(0, 0, GRID.tile, 1).fill(PALETTE.floorGrid);
  floorAlt.rect(0, 0, 1, GRID.tile).fill(PALETTE.floorGrid);
  floorAlt.rect(16, 16, 1, 1).fill({ color: PALETTE.floorAccent, alpha: 0.5 });
  TILES.set("floor_alt", bake(app, floorAlt, GRID.tile, GRID.tile));
  floorAlt.destroy();

  // Wall — top-row tile (used for the office back wall).
  const wall = new Graphics();
  wall.rect(0, 0, GRID.tile, GRID.tile).fill(PALETTE.wallBase);
  // Top brick line
  wall.rect(0, 0, GRID.tile, 2).fill(PALETTE.wallTop);
  // Trim strip near floor
  wall.rect(0, GRID.tile - 4, GRID.tile, 1).fill(PALETTE.wallTrim);
  wall.rect(0, GRID.tile - 3, GRID.tile, 1).fill({ color: PALETTE.lime, alpha: 0.18 });
  TILES.set("wall", bake(app, wall, GRID.tile, GRID.tile));
  wall.destroy();

  // Wall with poster — accent variant
  const wallPoster = new Graphics();
  wallPoster.rect(0, 0, GRID.tile, GRID.tile).fill(PALETTE.wallBase);
  wallPoster.rect(0, 0, GRID.tile, 2).fill(PALETTE.wallTop);
  wallPoster.rect(0, GRID.tile - 4, GRID.tile, 1).fill(PALETTE.wallTrim);
  // Poster frame
  wallPoster.rect(8, 6, 16, 18).fill(PALETTE.lime);
  wallPoster.rect(9, 7, 14, 16).fill(0x141422);
  // Mini lime sparkle inside
  wallPoster.rect(14, 13, 4, 1).fill(PALETTE.lime);
  wallPoster.rect(15, 12, 2, 3).fill(PALETTE.lime);
  TILES.set("wall_poster", bake(app, wallPoster, GRID.tile, GRID.tile));
  wallPoster.destroy();

  return TILES;
}

export function getTileTexture(key: string): Texture {
  return TILES?.get(key) ?? Texture.EMPTY;
}

/* ──────────────────────────────────────────────────────────────────── */
/* Decor rendering — desks, monitors, plants, water cooler              */
/* ──────────────────────────────────────────────────────────────────── */

export function ensureDecorTextures(app: Application): Map<string, Texture> {
  if (DECOR) return DECOR;
  DECOR = new Map();

  // Desk — 32×32, contains monitor + keyboard + mug
  const desk = new Graphics();
  // Desk top
  desk.rect(2, 18, 28, 6).fill(PALETTE.deskTop);
  desk.rect(2, 18, 28, 1).fill(PALETTE.deskShine);
  // Desk side / legs
  desk.rect(3, 24, 4, 6).fill(PALETTE.deskSide);
  desk.rect(25, 24, 4, 6).fill(PALETTE.deskSide);
  // Monitor
  desk.rect(8, 8, 16, 11).fill(PALETTE.monitorBezel);
  desk.rect(9, 9, 14, 8).fill(PALETTE.monitorScreenOn);
  // Lime power LED
  desk.rect(22, 17, 1, 1).fill(PALETTE.lime);
  // Screen content lines
  desk.rect(11, 11, 6, 1).fill({ color: PALETTE.lime, alpha: 0.7 });
  desk.rect(11, 13, 9, 1).fill({ color: PALETTE.whiteSoft, alpha: 0.4 });
  desk.rect(11, 15, 5, 1).fill({ color: PALETTE.whiteSoft, alpha: 0.4 });
  // Keyboard
  desk.rect(8, 20, 13, 2).fill(0x101010);
  desk.rect(9, 21, 11, 1).fill({ color: PALETTE.whiteSoft, alpha: 0.2 });
  // Mug with steam
  desk.rect(23, 19, 3, 3).fill(PALETTE.coral);
  desk.rect(26, 20, 1, 1).fill(PALETTE.coral);
  // Steam pixels
  desk.rect(24, 17, 1, 1).fill({ color: PALETTE.whiteSoft, alpha: 0.6 });
  DECOR.set("desk", bake(app, desk, GRID.tile, GRID.tile));
  desk.destroy();

  // Phone bank — Echo's work station
  const phones = new Graphics();
  phones.rect(2, 16, 28, 8).fill(PALETTE.deskTop);
  phones.rect(2, 16, 28, 1).fill(PALETTE.deskShine);
  phones.rect(3, 24, 4, 6).fill(PALETTE.deskSide);
  phones.rect(25, 24, 4, 6).fill(PALETTE.deskSide);
  // Two phones
  phones.rect(6, 11, 8, 8).fill(PALETTE.indigo);
  phones.rect(7, 12, 6, 4).fill(0x141424);
  phones.rect(8, 13, 4, 1).fill({ color: PALETTE.lime, alpha: 0.8 });
  phones.rect(8, 14, 4, 1).fill({ color: PALETTE.whiteSoft, alpha: 0.3 });
  phones.rect(18, 11, 8, 8).fill(PALETTE.indigo);
  phones.rect(19, 12, 6, 4).fill(0x141424);
  phones.rect(20, 13, 4, 1).fill({ color: PALETTE.lime, alpha: 0.8 });
  phones.rect(20, 14, 4, 1).fill({ color: PALETTE.whiteSoft, alpha: 0.3 });
  // Headset rest
  phones.rect(14, 18, 4, 1).fill(PALETTE.shadow);
  DECOR.set("phone_bank", bake(app, phones, GRID.tile, GRID.tile));
  phones.destroy();

  // Mailroom — Onyx's work station
  const mail = new Graphics();
  mail.rect(2, 14, 28, 10).fill(PALETTE.deskTop);
  mail.rect(2, 14, 28, 1).fill(PALETTE.deskShine);
  mail.rect(3, 24, 4, 6).fill(PALETTE.deskSide);
  mail.rect(25, 24, 4, 6).fill(PALETTE.deskSide);
  // Stacked envelopes
  for (let i = 0; i < 4; i++) {
    const y = 16 - i;
    const x = 6 + i;
    mail.rect(x, y, 8, 4).fill(PALETTE.whiteSoft);
    mail.rect(x, y, 8, 1).fill(0xc0c0c8);
    mail.moveTo(x, y).lineTo(x + 4, y + 2).lineTo(x + 8, y).stroke({ color: 0x808088, width: 1 });
  }
  // Outbox tray on right
  mail.rect(18, 12, 10, 8).fill(PALETTE.coral);
  mail.rect(19, 13, 8, 6).fill(0x4a1818);
  // "OUT" text approximation (just lime bar)
  mail.rect(20, 15, 6, 2).fill(PALETTE.lime);
  DECOR.set("mailroom", bake(app, mail, GRID.tile, GRID.tile));
  mail.destroy();

  // Easel — Pixel's painting station
  const easel = new Graphics();
  // Tripod
  easel.rect(15, 6, 2, 22).fill(0x3a2a18);
  easel.moveTo(8, 28).lineTo(16, 6).lineTo(24, 28).stroke({ color: 0x3a2a18, width: 2 });
  // Canvas
  easel.rect(7, 6, 18, 14).fill(PALETTE.whiteSoft);
  easel.rect(8, 7, 16, 12).fill(0xeae7d8);
  // Painting in progress — lime swatch + indigo brush mark
  easel.rect(10, 9, 5, 4).fill(PALETTE.lime);
  easel.rect(15, 13, 7, 3).fill(PALETTE.indigo);
  easel.rect(17, 10, 2, 2).fill(PALETTE.coral);
  // Palette below easel
  easel.rect(20, 22, 8, 4).fill(0x6b4d2e);
  easel.rect(21, 23, 1, 1).fill(PALETTE.coral);
  easel.rect(23, 23, 1, 1).fill(PALETTE.lime);
  easel.rect(25, 23, 1, 1).fill(PALETTE.indigo);
  DECOR.set("easel", bake(app, easel, GRID.tile, GRID.tile));
  easel.destroy();

  // Plant — large monstera
  const plant = new Graphics();
  // Pot
  plant.rect(10, 22, 12, 8).fill(0x6b4d2e);
  plant.rect(10, 22, 12, 1).fill(0x8a6b48);
  plant.rect(11, 28, 10, 1).fill(0x4a3520);
  // Leaves — angular pixel-art style
  plant.rect(13, 18, 6, 4).fill(0x2e6b3a);
  plant.rect(11, 14, 4, 4).fill(0x2e6b3a);
  plant.rect(17, 14, 4, 4).fill(0x2e6b3a);
  plant.rect(14, 10, 4, 4).fill(0x3d8a4a);
  plant.rect(8, 12, 3, 4).fill(0x3d8a4a);
  plant.rect(21, 12, 3, 4).fill(0x3d8a4a);
  // Highlights
  plant.rect(15, 11, 1, 2).fill(0x5fb56e);
  plant.rect(12, 15, 1, 2).fill(0x5fb56e);
  DECOR.set("plant", bake(app, plant, GRID.tile, GRID.tile));
  plant.destroy();

  // Water cooler
  const cooler = new Graphics();
  cooler.rect(8, 4, 16, 14).fill(0xa8d0e6);
  cooler.rect(9, 5, 14, 12).fill(0x82b4cc);
  // Bubble
  cooler.rect(14, 8, 3, 3).fill(0xc8e0f0);
  cooler.rect(11, 11, 2, 2).fill(0xc8e0f0);
  // Base
  cooler.rect(7, 18, 18, 4).fill(0x141416);
  cooler.rect(8, 22, 16, 6).fill(0x2a2a32);
  // Spigot
  cooler.rect(15, 22, 2, 2).fill(0x808088);
  cooler.rect(14, 24, 4, 1).fill(0x404048);
  DECOR.set("water_cooler", bake(app, cooler, GRID.tile, GRID.tile));
  cooler.destroy();

  // Filing cabinet
  const cabinet = new Graphics();
  cabinet.rect(4, 6, 24, 22).fill(0x4a4a52);
  cabinet.rect(4, 6, 24, 1).fill(0x6a6a72);
  cabinet.rect(4, 28, 24, 1).fill(0x2a2a32);
  // 3 drawers
  for (let i = 0; i < 3; i++) {
    const y = 8 + i * 7;
    cabinet.rect(5, y, 22, 5).fill(0x3a3a42);
    cabinet.rect(14, y + 2, 4, 1).fill(0x808088);
  }
  DECOR.set("cabinet", bake(app, cabinet, GRID.tile, GRID.tile));
  cabinet.destroy();

  // Whiteboard
  const board = new Graphics();
  board.rect(2, 4, 28, 18).fill(PALETTE.whiteSoft);
  board.rect(2, 4, 28, 1).fill(0xc0c0c8);
  board.rect(2, 22, 28, 1).fill(0xc0c0c8);
  board.rect(1, 4, 1, 19).fill(PALETTE.shadow);
  board.rect(30, 4, 1, 19).fill(PALETTE.shadow);
  // Marker scribbles
  board.rect(5, 8, 8, 1).fill(PALETTE.indigo);
  board.rect(5, 11, 14, 1).fill(PALETTE.indigo);
  board.rect(5, 14, 6, 1).fill(PALETTE.coral);
  board.rect(15, 14, 8, 1).fill(PALETTE.coral);
  board.rect(5, 17, 18, 1).fill(0x6a6a72);
  // Tray with markers
  board.rect(2, 22, 28, 2).fill(0x4a3520);
  board.rect(8, 23, 1, 1).fill(PALETTE.coral);
  board.rect(12, 23, 1, 1).fill(PALETTE.indigo);
  board.rect(16, 23, 1, 1).fill(0x2e6b3a);
  DECOR.set("whiteboard", bake(app, board, GRID.tile, GRID.tile));
  board.destroy();

  // Server rack — for Aria's strategy office
  const server = new Graphics();
  server.rect(6, 4, 20, 24).fill(0x0a0a0f);
  server.rect(6, 4, 20, 1).fill(0x2a2a32);
  // 6 1U rows
  for (let i = 0; i < 6; i++) {
    const y = 6 + i * 4;
    server.rect(7, y, 18, 3).fill(0x181820);
    // LEDs
    server.rect(9, y + 1, 1, 1).fill(PALETTE.lime);
    server.rect(11, y + 1, 1, 1).fill({ color: PALETTE.lime, alpha: 0.6 });
    server.rect(22, y + 1, 1, 1).fill(PALETTE.coral);
  }
  DECOR.set("server_rack", bake(app, server, GRID.tile, GRID.tile));
  server.destroy();

  // Newsdesk — Nova's station
  const newsdesk = new Graphics();
  newsdesk.rect(2, 16, 28, 8).fill(PALETTE.deskTop);
  newsdesk.rect(2, 16, 28, 1).fill(PALETTE.deskShine);
  newsdesk.rect(3, 24, 4, 6).fill(PALETTE.deskSide);
  newsdesk.rect(25, 24, 4, 6).fill(PALETTE.deskSide);
  // Newspaper stack
  newsdesk.rect(6, 11, 12, 6).fill(PALETTE.whiteSoft);
  newsdesk.rect(6, 11, 12, 1).fill(0x808088);
  newsdesk.rect(7, 13, 10, 1).fill(0x2a2a32);
  newsdesk.rect(7, 15, 10, 1).fill(0x2a2a32);
  // Coffee
  newsdesk.rect(22, 13, 4, 4).fill(0x3a2a18);
  newsdesk.rect(23, 14, 2, 2).fill(0x6b4d2e);
  DECOR.set("newsdesk", bake(app, newsdesk, GRID.tile, GRID.tile));
  newsdesk.destroy();

  return DECOR;
}

export function getDecorTexture(key: string): Texture {
  return DECOR?.get(key) ?? Texture.EMPTY;
}

/* ──────────────────────────────────────────────────────────────────── */
/* Helpers                                                              */
/* ──────────────────────────────────────────────────────────────────── */

function bake(
  app: Application,
  g: Graphics,
  width: number,
  height: number,
): Texture {
  const tx = RenderTexture.create({
    width,
    height,
    antialias: false,
    resolution: 2,
  });
  app.renderer.render({ container: g, target: tx });
  return tx;
}

/**
 * Per-agent skin tone — kept narrow but distinct enough that side-by-
 * side characters read as different people. Falls back to a neutral
 * mid-tone if the agent key isn't in the table.
 */
function pickSkinForAgent(agentKey: string): number {
  const map: Record<string, number> = {
    echo: 0x9a7460,
    lyra: 0x8a6450,
    sage: 0xb98870,
    reef: 0x9c7058,
    onyx: 0x6a4838,
    nova: 0xa57862,
    casper: 0xb68872,
    pixel: 0x88604a,
    maven: 0x9c6e58,
    aria: 0xa67860,
  };
  return map[agentKey] ?? PALETTE.skinLight;
}

function pickHairForAgent(agentKey: string): number {
  const map: Record<string, number> = {
    echo: 0x2a2030,
    lyra: 0x6a4828,
    sage: 0x3a2818,
    reef: 0x222530,
    onyx: 0x141414,
    nova: 0x4a2818,
    casper: 0x6a4828,
    pixel: 0x382055,
    maven: 0x4a1818,
    aria: 0x382055,
  };
  return map[agentKey] ?? 0x2a2020;
}

/* ──────────────────────────────────────────────────────────────────── */
/* Disposal                                                             */
/* ──────────────────────────────────────────────────────────────────── */

/**
 * Free every cached texture. Called when the page unmounts so we don't
 * leak GPU memory between dashboard navigations.
 */
export function disposeAtlas(): void {
  CHARACTER_TEXTURES.forEach((tx) => tx.destroy(true));
  CHARACTER_TEXTURES.clear();
  TILES?.forEach((tx) => tx.destroy(true));
  TILES?.clear();
  TILES = null;
  DECOR?.forEach((tx) => tx.destroy(true));
  DECOR?.clear();
  DECOR = null;
}

/**
 * Lightweight portrait — a 32×32 sprite of the agent in idle_down pose,
 * wrapped in a styled container suitable for the side-panel header.
 * Returns a PIXI Sprite the caller can attach to its own container or
 * convert to a data URL via `app.renderer.extract.canvas(sprite)`.
 */
export function buildPortraitSprite(agentKey: string): Sprite {
  const tx = getCharacterTexture(agentKey, "idle_down");
  const s = new Sprite(tx);
  s.scale.set(4); // 128×128 at 4× scale
  return s;
}

/**
 * Helper: pre-bake portrait at a fixed size into a base64 data URL. The
 * side panel uses this to render the agent portrait in a `<img>` tag
 * without owning a PixiJS subscene.
 */
export async function bakePortraitDataUrl(
  app: Application,
  agentKey: string,
): Promise<string> {
  const container = new Container();
  const s = buildPortraitSprite(agentKey);
  container.addChild(s);
  const tx = RenderTexture.create({
    width: 128,
    height: 128,
    antialias: false,
    resolution: 2,
  });
  app.renderer.render({ container, target: tx });
  const canvas = await app.renderer.extract.canvas(tx);
  const url =
    "toDataURL" in canvas && typeof canvas.toDataURL === "function"
      ? canvas.toDataURL("image/png")
      : "";
  tx.destroy(true);
  container.destroy({ children: true });
  return url;
}
