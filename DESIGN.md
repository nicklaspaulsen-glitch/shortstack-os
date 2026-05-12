# Design System

## Visual Theme

Light Glass x Editorial Bento. White card surfaces on a cool-gray #F3F6FA base, blue accent (#2563EB), Satoshi display font for hero numbers. Inspired by Linear's density, Notion's light clarity, and Figma's tool-first precision.

Legacy dark theme exists under `[data-theme="dark"]` for backward compat but the default `:root` is light.

## Colors

### Base Palette (Light Theme — default)
| Token | Hex | Role |
|-------|-----|------|
| bg-base | #F3F6FA | Page background (cool gray) |
| bg-surface-1 | #FFFFFF | Cards, panels |
| bg-surface-2 | #F8FAFC | Nested surfaces |
| border-subtle | rgba(0,0,0,0.06) | Default card borders |
| border-strong | rgba(0,0,0,0.14) | Emphasized borders |

### Accent Colors
| Token | Hex | Role |
|-------|-----|------|
| brand-accent | #2563EB | Primary blue — buttons, links, hero accents |
| brand-accent-hover | #3B82F6 | Hover/highlight variant |
| brand-accent-dim | #1D4ED8 | Pressed/dim variant (AA on light bg) |

### Semantic Colors
| Token | Hex | Role |
|-------|-----|------|
| success | #16A34A | Positive deltas, closed-won |
| danger | #F26063 | Alerts, churn, closed-lost |
| warning | #FFC062 | Mid-risk |

### Text
| Token | Hex | Role |
|-------|-----|------|
| text-primary | #111827 | Body text |
| text-secondary | #374151 | Secondary labels |
| text-muted | #6B7280 | Tertiary, eyebrows |

## Typography

- Display (font-display): Satoshi — page titles, hero numbers. Tracking -0.03em numbers, -0.01em headings.
- Body (default): Inter — labels, tables, nav.
- Editorial (font-editorial): Bodoni Moda — reserved for hero/marketing one-off statements. Never body.
- Mono: Fira Code — timestamps, tabular metrics.
- Eyebrow: text-[9px] uppercase tracking-[0.18em] text-text-muted

## Elevation System (Light Theme)

1. Base: #F3F6FA — page canvas
2. Surface: rgba(255,255,255,0.88) — glass cards with backdrop-blur(24px) saturate(1.8)
3. Raised: rgba(255,255,255,0.94) — hero-level panels with backdrop-blur(32px)
4. Overlay: white — dropdowns, tooltips, modals

## Glass Surface (PrismPanel)

Standard glass: `background: rgba(255,255,255,0.88); backdrop-filter: blur(24px) saturate(1.8)`
Strong glass: `background: rgba(255,255,255,0.94); backdrop-filter: blur(32px) saturate(1.8)`
Card shadow: `0 1px 3px rgba(0,0,0,0.06), 0 4px 12px -4px rgba(0,0,0,0.08), 0 0 32px -8px rgba(37,99,235,0.06)`

## Accent Bars

Top accent bars on PrismPanel use a blue shimmer gradient:
`linear-gradient(90deg, #1D4ED8, #2563EB, #3B82F6, #2563EB, #1D4ED8)`

NOT the old rainbow gradient. One tone, three shades. Applied sparingly — only on the highest-signal card per section.

## Motion

Standard: 220ms cubic-bezier(0.32, 0.72, 0, 1). Hero reveal: 480ms 60ms stagger. prefers-reduced-motion: cap 100ms.

## Absolute Bans

- No gradient text
- No side-stripe accent borders
- No multi-color rainbow gradient bars (use blue shimmer only)
- No glassmorphism used purely decoratively
- No identical card grids (vary composition)
- No blue accent on more than one element per visual zone
- No gold/amber/lime accents in new code
- No text-gold-*, text-amber-*, bg-brand-lime in new code
