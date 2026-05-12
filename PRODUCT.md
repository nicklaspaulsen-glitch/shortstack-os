# Product

## Register

product

## Users

Solo agency owners and their small teams (designers, video editors, account managers) managing 5–50 clients. Also client-facing portal users (read-only). Primary context: fast-paced agency work, switching between client accounts, monitoring pipelines and content performance. Screen real estate: 14-27 inch monitors, occasionally mobile for quick checks.

## Product Purpose

ShortStack OS is an agency operating system — a single dashboard that replaces GHL, ClickUp, and scattered spreadsheets. It handles CRM, AI content creation, analytics, outreach automation, billing, and team coordination. Success = agency owner never needing to open another tab for client work.

## Brand Personality

Precision. Signal. Control. Not a tool that shouts — a tool that whispers the right thing at the right moment. Feels like Linear meets Notion meets Figma: fast, opinionated, light, and precise. Not corporate. Not startup-generic. Editorial gravity without heaviness.

## Anti-references

- Generic Tailwind/shadcn dashboards (AdminLTE, Metronic, any template marketplace)
- Vercel-clone dark with neon gradients
- Anything that looks like it came from a Claude Code session without a designer
- Gold/amber fintech aesthetic
- Rainbow chart dashboards (multi-color data viz with no hierarchy)
- Hero-metric template: big number, small label, gradient accent, repeated 8x
- Multi-color prismatic gradient bars on every card (uniform visual noise)
- Identical PrismPanel grids with no compositional hierarchy

## Design Principles

1. **Signal over decoration** — every visual element must communicate something. Remove what only decorates.
2. **One hero per section** — each card/section has exactly one dominant element. Everything else is supporting.
3. **Blue earns its placement** — the brand blue (#2563EB) accent appears sparingly on the highest-signal element per visual zone. Secondary interactivity uses muted blue (#1D4ED8 dim, #3B82F6 hover).
4. **Elevation tells the story** — four surface levels (base #F3F6FA → card white → raised #F8FAFC → overlay) replace border-heavy card patterns. Glass panels with backdrop-blur on prominent surfaces.
5. **Motion communicates state** — animation only on state changes, data updates, or navigation. Never decorative.

## Accessibility & Inclusion

WCAG AA minimum. Reduced motion respected. Light theme is the default (dark theme exists under `[data-theme="dark"]` for backward compat). Keyboard navigation required for all interactive elements. Min touch target 44x44px.
