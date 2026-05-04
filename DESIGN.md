# Design System

## Visual Theme

OLED Dark x Editorial Bento. Deep black base, acid lime single accent, Satoshi display font for hero numbers. Inspired by Linear's density, Spotify's content-led color moments, and Figma's tool-first precision.

## Colors

### Base Palette
| Token | Hex | Role |
|-------|-----|------|
| bg-base | #0A0A0B | Page background (warm-tinted near-black) |
| bg-surface-1 | #15141A | Cards, panels |
| bg-surface-2 | #1F1E26 | Nested surfaces |
| bg-surface-3 | #2A2832 | Raised/hover states |

### Accent Colors
| Token | Hex | Role |
|-------|-----|------|
| brand-lime | #D4FF00 | Single primary accent -- hero metrics only |
| brand-indigo | #6366F1 | Secondary interactive, links, focus rings |
| brand-plum | #3F0D2D | Deep accent for editorial moments |

### Semantic Colors
| Token | Hex | Role |
|-------|-----|------|
| success | #7FE5B8 | Positive deltas |
| danger | #F26063 | Alerts, churn |
| warning | #FFC062 | Mid-risk |

### Text
| Token | Hex | Role |
|-------|-----|------|
| text-primary | #F5F4F1 | Body (softened off-white) |
| text-secondary | #9F9DAA | Secondary labels |
| text-muted | #6F6D7A | Tertiary |

## Typography

- Display (font-display): Satoshi -- page titles, hero numbers. Tracking -0.03em numbers, -0.01em headings.
- Body (default): Inter -- labels, tables, nav.
- Mono: Fira Code -- timestamps, tabular metrics.
- Eyebrow: text-[9px] uppercase tracking-[0.18em] text-[#A8A8B2]

## Elevation System

1. Base: bg-[#0A0A0B] -- page canvas
2. Surface: bg-[#15141A] -- cards, panels
3. Raised: bg-[#1F1E26] -- nested cells
4. Overlay: bg-[#2A2832] -- dropdowns, tooltips

## Motion

Standard: 220ms cubic-bezier(0.32, 0.72, 0, 1). Hero reveal: 480ms 60ms stagger. prefers-reduced-motion: cap 100ms.

## Absolute Bans

- No gradient text
- No side-stripe accent borders
- No text-gold-* in new code
- No glassmorphism decoratively
- No identical card grids
- No lime on more than one element per visual zone