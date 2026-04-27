# Pixel Agent Office — Asset Credits

The Pixel Agent Office surface ships with **zero binary art assets**. Every
sprite, tile, and decor element is drawn procedurally at runtime via PixiJS
v8 Graphics primitives, baked into RenderTextures, and cached in GPU memory
for the lifetime of the page.

This file exists to document that policy and to satisfy the `ASSET_CREDITS.md`
requirement on the brief.

## Why procedural?

1. **Bundle size.** The brief's budget is under 500 KB. Procedural sprites
   contribute zero bytes to the route bundle.
2. **Brand control.** Every agent uses a brand color sourced from the
   ShortStack OS palette (lime, indigo, mint, coral, amber). Hand-tuning a
   sprite's tint at runtime is straightforward when the sprite is just a
   `Graphics()` script.
3. **License clarity.** Anything we author here is owned outright by the
   project, removing the need to audit external CC0 packs for hidden
   commercial-use restrictions or attribution clauses.

## Sprite inventory and authorship

| Asset                          | Author                            | License | Source                                    |
| ------------------------------ | --------------------------------- | ------- | ----------------------------------------- |
| Character base (32×32 chibi)   | ShortStack OS team / Claude Code  | CC0 1.0 | `src/lib/pixel-office/sprite-atlas.ts`    |
| Floor tile (32×32, 2 variants) | ShortStack OS team / Claude Code  | CC0 1.0 | `src/lib/pixel-office/sprite-atlas.ts`    |
| Wall tiles (plain + poster)    | ShortStack OS team / Claude Code  | CC0 1.0 | `src/lib/pixel-office/sprite-atlas.ts`    |
| Desk + monitor + mug           | ShortStack OS team / Claude Code  | CC0 1.0 | `src/lib/pixel-office/sprite-atlas.ts`    |
| Phone bank (Echo's station)    | ShortStack OS team / Claude Code  | CC0 1.0 | `src/lib/pixel-office/sprite-atlas.ts`    |
| Mailroom (Onyx's station)      | ShortStack OS team / Claude Code  | CC0 1.0 | `src/lib/pixel-office/sprite-atlas.ts`    |
| Easel (Pixel's station)        | ShortStack OS team / Claude Code  | CC0 1.0 | `src/lib/pixel-office/sprite-atlas.ts`    |
| Plant / monstera               | ShortStack OS team / Claude Code  | CC0 1.0 | `src/lib/pixel-office/sprite-atlas.ts`    |
| Water cooler                   | ShortStack OS team / Claude Code  | CC0 1.0 | `src/lib/pixel-office/sprite-atlas.ts`    |
| Filing cabinet                 | ShortStack OS team / Claude Code  | CC0 1.0 | `src/lib/pixel-office/sprite-atlas.ts`    |
| Whiteboard                     | ShortStack OS team / Claude Code  | CC0 1.0 | `src/lib/pixel-office/sprite-atlas.ts`    |
| Server rack                    | ShortStack OS team / Claude Code  | CC0 1.0 | `src/lib/pixel-office/sprite-atlas.ts`    |
| Newsdesk (Nova's station)      | ShortStack OS team / Claude Code  | CC0 1.0 | `src/lib/pixel-office/sprite-atlas.ts`    |
| Sparkle / alert particles      | ShortStack OS team / Claude Code  | CC0 1.0 | `src/lib/pixel-office/agent-character.ts` |

All assets above are dedicated to the public domain under the
[Creative Commons CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
license. You may reuse, modify, or redistribute them for any purpose,
including commercial work, with no obligation to attribute.

## Inspirations consulted (no code or assets borrowed)

| Reference                                  | Notes                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `pablodelucca/pixel-agents` (GitHub)        | Conceptual inspiration for "agents as pixel characters". License was not verified before drafting; we used no code or assets. |
| OpenGameArt.org "modern office" tilesets    | Browsed for layout reference. We did not import any external file.                                              |
| Kenney.nl character bases                   | Consulted as a vibe reference. No assets imported.                                                              |

## Future asset upgrades

If the team eventually wants higher-fidelity bespoke sprites, the recommended
path is to commission art with explicit work-for-hire terms or pull from a
single CC0 source (preferably Kenney.nl or OpenGameArt CC0 filter). Update
this file with full provenance whenever any binary asset is added under
`public/pixel-office/`.

The procedural approach here is meant to be the long-term default — it lets
the office grow with the agent roster without an asset pipeline.
