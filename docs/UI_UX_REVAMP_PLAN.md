# ShortStack OS — UI/UX Revamp Master Plan

> Generated 2026-05-12. Component references from 21st.dev + Framer marketplace.
> Color scheme locked: Blue #2563EB / White / Gray. Fonts: Satoshi / Inter / Bodoni Moda.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Component Arsenal](#component-arsenal)
3. [Global Infrastructure](#global-infrastructure)
4. [Phase 1 — Foundation Layer](#phase-1--foundation-layer)
5. [Phase 2 — Core Pages (Tier 1)](#phase-2--core-pages-tier-1)
6. [Phase 3 — Sales & Outreach](#phase-3--sales--outreach)
7. [Phase 4 — Create & Content](#phase-4--create--content)
8. [Phase 5 — Visual & Media](#phase-5--visual--media)
9. [Phase 6 — Automate & AI](#phase-6--automate--ai)
10. [Phase 7 — Manage & Operations](#phase-7--manage--operations)
11. [Phase 8 — Marketing & Public Pages](#phase-8--marketing--public-pages)
12. [Phase 9 — Client Portal](#phase-9--client-portal)
13. [Phase 10 — Polish & Micro-interactions](#phase-10--polish--micro-interactions)
14. [Implementation Priorities](#implementation-priorities)

---

## Design Philosophy

### The Problem
100+ pages using the same PageHero + StatCard + card grid pattern. Every page
looks like a cousin of every other page. User feedback: "looks AI-generated
and generic." The app has no visual signature, no "wow" moments, no personality.

### The Solution: Layered Visual Identity

**Layer 1 — Atmospheric Foundation**
WebGL/shader backgrounds, grain overlay, isometric wave grids on key surfaces.
Not everywhere — only on pages that deserve theater (dashboard home, agent
office, landing page). This creates a "premium floor" that lifts the entire app.

**Layer 2 — Motion Choreography**
Every interaction has authored motion: staggered card reveals, scroll-expansion
heroes, text morphing on route transitions, orbital timelines for data. The
motion language is the brand's signature — consistent 220ms ease-out-expo for
micro-interactions, 480ms for hero reveals, scroll-driven parallax on
long-form pages.

**Layer 3 — Interactive Surfaces**
Cards that respond to cursor (dithering, shine borders, tilt). Buttons with
liquid glass physics. Command palette as the universal search. AI prompt boxes
that feel alive. These make the app feel tactile and responsive.

**Layer 4 — Typography Theater**
Gooey text morphing for page titles. Vertical cut reveals for section headers.
Letter-swap animations for real-time data (analytics counters, deal values).
Typewriter effect for AI-generated content streaming. This makes text itself
a design element, not just content.

### Anti-Patterns to Kill
- Identical card grids with uniform spacing
- PageHero gradient blobs with no information hierarchy
- StatCard rows that all look the same (number + label + icon)
- Gray placeholder states with no personality
- Flat lists with no depth or interaction feedback

---

## General UI Layout System

> Derived from Alytics (analytics SaaS), Lumis (AI SaaS), and BrightEdge
> (agency/portfolio). These define the **structural skeleton** every page
> builds on — not individual components, but how sections stack, how grids
> break, how metrics breathe, how the eye travels through a page.

### The Core Problem (Layout Edition)

Right now every dashboard page is: `PageHero → uniform card grid → maybe
a table`. The hero takes 200px, then 3-column cards fill the rest. No
rhythm, no hierarchy, no breathing room. A CRM page looks structurally
identical to an analytics page which looks identical to a content calendar.

**The fix:** 5 distinct page layout templates, each purpose-built for a
category of content. Pages pick the template that fits their data shape.

---

### Page Layout Templates

#### Template A: "Command Center" (Alytics-inspired)
**Used by:** Dashboard home, Analytics, Financials, Forecast, CRM overview

The information-dense layout for pages that lead with numbers.

```
┌─────────────────────────────────────────────────────────────┐
│  HERO ZONE (compact, 160px max)                             │
│  Eyebrow · Title · Subtitle with TextRotate                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ LetterSwap  │ │ LetterSwap  │ │ LetterSwap  │  Inline  │
│  │ big metric  │ │ big metric  │ │ big metric  │  stats   │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
├─────────────────────────────────────────────────────────────┤
│  BENTO ZONE (asymmetric grid — NOT uniform)                 │
│  ┌───────────────────────┐ ┌──────────┐                    │
│  │                       │ │          │                    │
│  │   FOCUS TILE (2×2)    │ │  TILE B  │                    │
│  │   chart / key insight │ │          │                    │
│  │                       │ ├──────────┤                    │
│  │                       │ │  TILE C  │                    │
│  └───────────────────────┘ └──────────┘                    │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────────┐      │
│  │  TILE D  │ │  TILE E  │ │   TILE F (wide)       │      │
│  └──────────┘ └──────────┘ └───────────────────────┘      │
├─────────────────────────────────────────────────────────────┤
│  DATA TABLE / ACTIVITY FEED ZONE                            │
│  Full-width, with filter pills (LiquidGlass Tahoe)          │
│  Rows with AnimateCard hover, inline LetterSwap on values   │
└─────────────────────────────────────────────────────────────┘
```

**Key structural rules:**
- Hero is COMPACT (160px not 280px) — metrics ARE the hero, not decoration
- Bento grid uses `grid-template-areas` with at least one 2×2 focus tile
- No two adjacent tiles are the same size
- Spacing: 16px gap inside bento, 48px between major zones
- Filter bar sits between bento and data zone (sticky on scroll)

---

#### Template B: "Workspace" (Lumis-inspired)
**Used by:** Inbox, Conversations, CRM pipeline (Kanban), Production board

The multi-pane layout for pages where users DO work, not just view data.

```
┌─────────────────────────────────────────────────────────────┐
│  TOOLBAR (48px, sticky)                                     │
│  Filter pills · Search · View toggle · Sort · Actions       │
├───────────┬─────────────────────────────────────────────────┤
│           │                                                 │
│  LIST     │  DETAIL PANE                                    │
│  PANE     │                                                 │
│  (320px)  │  Selected item content                          │
│           │  with AnimateCard sections                      │
│  Scrolls  │                                                 │
│  indep.   │  AI suggestion box (Typewriter)                 │
│           │                                                 │
│           │  Action bar at bottom (FlowButton primary)      │
├───────────┴─────────────────────────────────────────────────┤
│  STATUS BAR (32px) — counts, sync status, keyboard hints    │
└─────────────────────────────────────────────────────────────┘
```

**OR Kanban variant:**
```
┌─────────────────────────────────────────────────────────────┐
│  TOOLBAR (48px, sticky)                                     │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│ COLUMN 1 │ COLUMN 2 │ COLUMN 3 │ COLUMN 4 │  Scroll →     │
│ stage hdr│ stage hdr│ stage hdr│ stage hdr│               │
│ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │               │
│ │ card │ │ │ card │ │ │ card │ │ │ card │ │               │
│ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │               │
│ ┌──────┐ │ ┌──────┐ │          │          │               │
│ │ card │ │ │ card │ │          │          │               │
│ └──────┘ │ └──────┘ │          │          │               │
└──────────┴──────────┴──────────┴──────────┴────────────────┘
```

**Key structural rules:**
- Toolbar is ALWAYS sticky (not inside PageHero)
- List-detail split uses CSS Grid with resizable divider
- Detail pane scrolls independently from list pane
- Kanban columns have stage headers with LetterSwap counters
- Status bar shows aggregate counts + last sync time

---

#### Template C: "Catalog" (BrightEdge-inspired)
**Used by:** Clients, Content library, Social manager, Design studio,
Templates, Integrations, Team, Projects, Automations, Workflows

The browse-and-select layout for pages with collections of items.

```
┌─────────────────────────────────────────────────────────────┐
│  PAGE HERO (standard, with TextRotate subtitle)             │
│  Optional: inline stat chips (count, active, recent)        │
├─────────────────────────────────────────────────────────────┤
│  FILTER + VIEW BAR (sticky on scroll)                       │
│  Search · Category pills · Sort · Grid|List toggle          │
├─────────────────────────────────────────────────────────────┤
│  CARD GRID (responsive, NOT uniform)                        │
│                                                             │
│  Grid view (default):                                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │  FEATURED    │ │              │ │              │       │
│  │  (tall, 2×h) │ │   Card B     │ │   Card C     │       │
│  │  ShineBorder │ │              │ │              │       │
│  │              │ ├──────────────┤ ├──────────────┤       │
│  │              │ │   Card D     │ │   Card E     │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                             │
│  OR List view:                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [Avatar] Name · Status · Last activity · Actions    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [Avatar] Name · Status · Last activity · Actions    │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  PAGINATION / LOAD MORE                                     │
└─────────────────────────────────────────────────────────────┘
```

**Key structural rules:**
- First card in grid can be "featured" (2× height, ShineBorder)
- Grid columns: 3 on desktop, 2 on tablet, 1 on mobile
- View toggle persists in URL params (?view=grid|list)
- Filter bar becomes sticky when hero scrolls out of viewport
- Staggered entrance: 40ms delay per card, max 12 visible on load
- Empty state fills the entire grid zone (not a tiny card)

---

#### Template D: "Studio" (hybrid Lumis + Alytics)
**Used by:** Copywriter, Script Lab, AI Studio, Video Editor, AI Video,
Thumbnail Generator, Voice Studio, Trinity, Website Builder

The creation-focused layout for pages where AI generates content.

```
┌─────────────────────────────────────────────────────────────┐
│  COMPACT HERO (120px, title + mode selector only)           │
├────────────────────────────┬────────────────────────────────┤
│                            │                                │
│  INPUT ZONE (50%)          │  OUTPUT ZONE (50%)             │
│                            │                                │
│  AI Prompt Box             │  Generated content             │
│  (rich, with attachments,  │  (Typewriter streaming)        │
│   suggestions, presets)    │                                │
│                            │  ┌──────────────────────────┐ │
│  Settings panel below:     │  │ Output card 1            │ │
│  ┌──────────────────────┐  │  │ (AnimateCard)            │ │
│  │ Tone · Length · Style│  │  └──────────────────────────┘ │
│  └──────────────────────┘  │  ┌──────────────────────────┐ │
│                            │  │ Output card 2            │ │
│  History sidebar (toggle): │  │ (AnimateCard)            │ │
│  Recent generations list   │  └──────────────────────────┘ │
│                            │                                │
├────────────────────────────┴────────────────────────────────┤
│  ACTION BAR (sticky bottom) — Save · Copy · Export · Share  │
└─────────────────────────────────────────────────────────────┘
```

**Key structural rules:**
- Split is 50/50 on desktop, stacked on mobile (input on top)
- AI Prompt Box is the visual anchor — large, prominent, centered
- Output zone scrolls independently; new outputs prepend with animation
- History panel is a collapsible sidebar (icon toggle, not always visible)
- Action bar sticks to bottom with FlowButton for primary action
- For media pages (Video Editor, AI Studio): output zone becomes a canvas/preview

---

#### Template E: "Editorial" (BrightEdge-inspired)
**Used by:** Settings, Brand kit, Getting started, Newsletter, Content plan,
Client detail, About/legal pages, Client portal pages

The reading-focused layout for pages that are more narrative than interactive.

```
┌─────────────────────────────────────────────────────────────┐
│  MINIMALIST HERO (spacious, Bodoni Moda headline)           │
│  No stats, no gradient. Just title + optional breadcrumb.   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│     ┌─────────────────────────────────────────────┐        │
│     │  Content section 1                          │        │
│     │  (max-width: 720px, centered)               │        │
│     │  VerticalCutReveal on scroll                │        │
│     └─────────────────────────────────────────────┘        │
│                                                             │
│     ┌─────────────────────────────────────────────┐        │
│     │  Content section 2                          │        │
│     │  Cards in a relaxed 2-column grid           │        │
│     └─────────────────────────────────────────────┘        │
│                                                             │
│     ┌─────────────────────────────────────────────┐        │
│     │  Numbered process steps (01 → 05)           │        │
│     │  Vertical timeline with ProgressIndicator   │        │
│     └─────────────────────────────────────────────┘        │
│                                                             │
│     ┌─────────────────────────────────────────────┐        │
│     │  FAQ accordion                              │        │
│     └─────────────────────────────────────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key structural rules:**
- Content max-width is 720px, centered (readable line lengths)
- Generous vertical spacing between sections (64px+)
- No sidebar, no split panes — single column focus
- Numbered items use the BrightEdge "01-05" pattern with left numbering
- Settings pages: replace content sections with card grid of category links
- Client detail: hero gets the client's brand color as subtle accent

---

### Section Flow Patterns (cross-template)

Regardless of template, sections within a page follow these structural rules:

**1. Zone progression (top to bottom):**
```
HERO ZONE     → Identity + context (who am I, what's the state)
ACTION ZONE   → What can I do right now (filters, create, search)
CONTENT ZONE  → The actual data/content/workspace
SUPPORT ZONE  → Secondary info (FAQ, related items, suggestions)
```

**2. Section transitions:**
- Between major zones: `48px` gap + subtle divider (1px `border-subtle`)
- VerticalCutReveal on each zone's heading as it scrolls into view
- No decorative separators (no gradient lines, no SVG dividers)

**3. Sticky behavior hierarchy:**
- Sidebar: always sticky (already is)
- Top toolbar/filter bar: sticky when it exists (Template B, C)
- PageHero: NOT sticky (scrolls away to free content space)
- Action bar: sticky bottom when it exists (Template D)

**4. Responsive breakpoints:**
```
Mobile  (< 768px):  Single column, stacked panes, collapsed sidebar
Tablet  (768-1024): 2-column grids, side panel collapses to overlay
Desktop (1024+):    Full layout as designed
Wide    (1440+):    Content max-width caps, extra whitespace on sides
```

---

### Metric Display System (Alytics + Lumis DNA)

Three tiers of metric presentation, chosen by importance:

**Tier 1 — Hero Metrics (3 max per page)**
Large LetterSwap counters inline in the PageHero. Satoshi font, 36px.
Used for: revenue, total clients, pipeline value, active campaigns.
```tsx
<HeroMetric label="Monthly Revenue" value={revenue} prefix="$" />
```

**Tier 2 — Bento Tiles (6-8 per page)**
AnimateCard tiles in the asymmetric bento grid. Each tile has:
- A single metric (LetterSwap, 24px Satoshi)
- A label (12px Inter, text-muted)
- A sparkline or micro-chart (optional)
- A trend indicator (up/down arrow + percentage)

**Tier 3 — Inline Stats (unlimited)**
Small stat chips within content rows, table cells, or card footers.
Inter 14px, no animation. Just number + label.

**The Lumis "Scale Metrics" pattern:**
For pages that need to impress (landing page, client portal overview,
dashboard home), use the large-stat section:
```
┌──────────────────────────────────────────────────────┐
│    500+              10M+              99.9%          │
│  Active clients   Tasks completed   Uptime           │
│  LetterSwap        LetterSwap       LetterSwap       │
│  (48px Satoshi)   (48px Satoshi)   (48px Satoshi)    │
└──────────────────────────────────────────────────────┘
```

---

### Trust & Status Presentation (Lumis DNA)

Lumis excels at trust-building layout. Apply to ShortStack's client-facing
surfaces and security-sensitive pages:

**Compliance badges row:**
```tsx
<TrustBar badges={["SOC2", "GDPR", "SSL", "HIPAA-ready"]} />
```
Horizontal row of muted icon + label pairs. Used on: Billing, Client
portal, Settings/security, Getting started.

**Real-time activity feed (Lumis pattern):**
A slim sidebar or bottom strip showing live events:
```
✓ Invoice #1042 paid — 2 min ago
⚡ Campaign "Spring Push" sent — 5 min ago
🎯 New lead scored 92 — 12 min ago
```
Used on: Dashboard home (side panel), Agent Office (already has this).

---

### Numbered Process Steps (BrightEdge DNA)

For any sequential process (onboarding, methodology, workflow steps):

```tsx
<ProcessTimeline steps={[
  { number: "01", title: "Discovery", desc: "..." },
  { number: "02", title: "Strategy", desc: "..." },
  { number: "03", title: "Execution", desc: "..." },
  { number: "04", title: "Optimization", desc: "..." },
]} />
```

**Layout:** Vertical timeline with large left-aligned numbers (Satoshi,
32px, text-muted), title + description to the right. ProgressIndicator
line connecting them. VerticalCutReveal on scroll.

Used on: Getting started, Onboarding wizard, How-it-works (landing page),
Workflow builder preview, Client portal project phases.

---

### Navigation Evolution

**Current:** Collapsible sidebar + breadcrumb. No global search.

**Proposed additions (not replacing sidebar):**

1. **Command Palette (Cmd+K)** — overlay search across everything
2. **Contextual breadcrumb trail** — shows page → parent → grandparent
   with hover previews (LinkPreview component)
3. **Tab bar within pages** — for multi-section pages (Client detail,
   Settings), use horizontal tabs below the hero, not inside it.
   Liquid Glass (Tahoe) pill style for the tab indicators.
4. **Sidebar footer quick-stats** — show 2-3 key metrics at sidebar
   bottom (today's revenue, unread messages, active tasks). LetterSwap
   updates in real-time via Supabase Realtime.

---

### Page-to-Template Mapping

| Template | Pages |
|----------|-------|
| **A: Command Center** | `/dashboard` (home), `/dashboard/analytics`, `/dashboard/financials`, `/dashboard/forecast`, `/dashboard/crm` (overview mode) |
| **B: Workspace** | `/dashboard/inbox`, `/dashboard/conversations`, `/dashboard/crm` (kanban mode), `/dashboard/production`, `/dashboard/deals` (kanban) |
| **C: Catalog** | `/dashboard/clients`, `/dashboard/social-manager`, `/dashboard/content-plan`, `/dashboard/design-studio`, `/dashboard/team`, `/dashboard/projects`, `/dashboard/automations`, `/dashboard/workflows`, `/dashboard/invoices`, `/dashboard/services`, `/dashboard/integrations`, `/dashboard/eleven-agents` |
| **D: Studio** | `/dashboard/copywriter`, `/dashboard/script-lab`, `/dashboard/ai-studio`, `/dashboard/video-editor`, `/dashboard/ai-video`, `/dashboard/thumbnail-generator`, `/dashboard/voice-studio`, `/dashboard/trinity`, `/dashboard/websites`, `/dashboard/coach`, `/dashboard/workflow-builder` |
| **E: Editorial** | `/dashboard/settings/*`, `/dashboard/brand-kit`, `/dashboard/newsletter`, `/dashboard/billing`, `/dashboard/getting-started`, `/dashboard/portal/*`, `/dashboard/clients/[id]` (detail view) |

---

### Grid System Specifications

**Bento grid (Template A):**
```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: auto;
  gap: 16px;
}
/* Focus tile spans 7 cols, 2 rows */
/* Supporting tiles span 5 cols, 1 row each */
/* Bottom row: 4-4-4 or 3-4-5 asymmetric */
```

**Card grid (Template C):**
```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}
/* First card can span 2 rows via grid-row: span 2 */
/* @media (max-width: 768px): 1 column */
```

**Split pane (Template D):**
```css
.studio-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr auto;
  height: calc(100vh - var(--hero-height) - var(--sidebar-offset));
}
/* @media (max-width: 1024px): grid-template-columns: 1fr; stacked */
```

**Content column (Template E):**
```css
.editorial-content {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 24px;
}
/* Wider sections (card grids, timelines) break out to max-width: 960px */
```

---

## Component Arsenal

### From 21st.dev (React + Framer Motion + Tailwind)

| Component | What It Does | Where It Fits |
|-----------|-------------|---------------|
| **FlowButton** | Circle-fill hover animation on buttons | Primary CTAs across all pages |
| **LiquidGlassButton** | Apple Tahoe liquid glass with SVG blur filters | Premium actions: upgrade, publish, send |
| **MetalButton** | Brushed metal tactile button | Settings confirmations, destructive actions |
| **FloatingActionMenu** | Staggered FAB with radial menu | Quick-create on dashboard, content pages |
| **ActionSearchBar** | Command palette (Cmd+K) with categories | Global search — replaces current search |
| **AI Prompt Box** | Rich AI input with attachments, suggestions | AI Studio, Copywriter, Script Lab, Trinity |
| **ScrollExpansionHero** | Media expands on scroll into full viewport | Landing page hero, Getting Started |
| **LiquidGlassButton (Tahoe)** | macOS-native glass morphism variant | Navigation pills, filter chips |
| **Radial Orbital Timeline** | Circular orbital data visualization | Agent Office activity, workflow history |
| **Splite** | Split-text reveal animation | Page section headers throughout |
| **Gooey Text Morphing** | SVG filter text morphing between states | Dashboard greeting, stat transitions |
| **Typewriter** | Typing animation effect | AI streaming output, console, chat |
| **Text Rotate** | Rotating text carousel | PageHero subtitles, feature highlights |
| **Vertical Cut Reveal** | Vertical slice text entrance | Section reveals on scroll |
| **Letter Swap** | Individual letter swap/scramble | Live counters, deal values, analytics |
| **Minimalist Hero** | Clean, spacious hero section | Settings pages, profile, about |
| **WebGL Shader** | GPU-powered animated backgrounds | Dashboard home, landing page, login |
| **Shader Animation** | Programmatic shader patterns | Agent Office sky, loading states |
| **Falling Pattern** | Particle/confetti fall animation | Success states, celebration moments |
| **Isometric Wave Grid** | 3D grid background animation | Landing page sections, pricing page |
| **Testimonials Columns** | Multi-column scrolling testimonials | Landing page social proof, reviews |
| **Pricing Interaction** | Animated pricing card switcher | Pricing page, upgrade prompts |
| **Link Preview** | Hover card previews for links | CRM notes, content library, conversations |
| **Reveal Images** | Scroll-triggered image reveals | Landing page features, case studies |
| **Image Trail** | Cursor-following image trail | Portfolio showcase, design studio |
| **Progress Indicator** | Animated step/progress visualization | Onboarding, funnel builder, workflows |
| **Label** | Animated badge/tag component | Status badges, plan tiers, notification counts |
| **Animate Card** | Hover-responsive card animations | All card grids (clients, deals, content) |
| **Hero Dithering Card** | Halftone/dithered card effect | Featured content, premium features |
| **Shine Border** | Animated gradient border glow | Active/selected states, premium cards |

### From Framer Templates (Design Direction)

| Template | Visual DNA to Extract | Apply To |
|----------|----------------------|----------|
| **Dreelio** | Bold typography hierarchy, editorial spacing | Content pages, blog/newsletter |
| **Crypton** | Dark glass cards, metric-heavy layouts | Analytics, financials, forecast |
| **Landio** | Clean SaaS hero, feature grid rhythm | Landing page structure |
| **DesignFast** | Rapid visual hierarchy, strong CTAs | Pricing, upgrade flows |
| **Pixend** | Image-forward cards, gallery grids | Design studio, content library |
| **Landin** | Minimal hero + social proof stacking | About page, getting started |
| **Zova** | Smooth page transitions, glass nav | Global navigation, route animations |
| **Menoa** | Warm editorial with generous whitespace | Client reports, proposals |
| **Talentify** | Profile cards, team layouts | Team page, client cards, community |
| **Alter** | Bold color blocks, section breaks | Dashboard home zones, feature sections |

---

## Global Infrastructure

These components install ONCE and affect every page in the app.

### 1. Command Palette (ActionSearchBar)
**File:** `src/components/ui/command-palette.tsx`
**Trigger:** `Cmd+K` / `Ctrl+K` globally
**Scope:** Replaces the current search. Searches across:
- Pages (fuzzy match all 130+ routes)
- Clients (by name, email, company)
- Deals (by title, value)
- Content (by title, type)
- Actions ("create client", "send email", "generate video")
- Settings ("change theme", "billing", "api keys")

**Visual:** Frosted glass backdrop, categorized results with icons,
keyboard navigation with blue highlight, recent searches, AI-suggested
actions. The ActionSearchBar component from 21st.dev is the base — extend
with ShortStack's data sources.

**Implementation:** ~2 days. Framer Motion for open/close (scale from 0.95,
opacity fade). Search index built from sidebar navItems + Supabase full-text.

### 2. Floating Action Menu (FAB)
**File:** `src/components/ui/floating-action-menu.tsx`
**Position:** Bottom-right, above the fold
**Actions (context-aware):**
- Dashboard home: + Client, + Deal, + Task, + Quick Note
- Content pages: + Post, + Template, + Campaign
- Sales pages: + Lead, + Sequence, + Call
- AI pages: + Generation, + Prompt, + Workflow

**Visual:** FloatingActionMenu from 21st.dev. Blue primary button, staggered
radial reveal on click (60ms stagger, 220ms each). Backdrop blur on open.
Framer Motion `AnimatePresence` for mount/unmount.

**Implementation:** ~1 day. Context detection via `usePathname()`.

### 3. Route Transition System
**File:** `src/components/ui/route-transition.tsx`
**Wraps:** Next.js App Router layout transitions
**Effect:** 320ms cross-fade with subtle y-translate (8px up on enter).
Page content fades in with the Vertical Cut Reveal effect on the main
heading. Staggered children appear 60ms apart.

**Implementation:** ~1 day. Framer Motion `AnimatePresence` + `motion.div`
wrapper in the dashboard layout. Uses `usePathname()` as animation key.

### 4. Enhanced PageHero v2
**File:** `src/components/ui/page-hero.tsx` (evolve existing)
**Changes:**
- Kill the uniform gradient blob backgrounds
- Add Text Rotate for subtitle variations (cycles through contextual tips)
- Letter Swap animation on any live counter in the hero
- Bodoni Moda eyebrow with Vertical Cut Reveal on page load
- Optional: ShineBoerder glow on the hero card for premium pages
- Optional: `heroMedia` prop for scroll-expansion on pages that warrant it

**Implementation:** ~2 days. Backward-compatible — existing props still work,
new props opt into enhanced behavior.

### 5. Enhanced Card System
**File:** `src/components/ui/animate-card.tsx`
**Replaces:** Plain `div` card wrappers throughout the app
**Features:**
- Subtle tilt on hover (2deg max, GPU-accelerated transform)
- Shine border on selected/active state
- Dithering texture option for featured/premium cards
- Staggered entrance animation (Framer Motion `variants`)
- Blue accent line on hover (bottom border, not left stripe)

**Implementation:** ~1.5 days. Drop-in replacement for card containers.

### 6. Grain Overlay (already exists)
**Status:** `src/components/brand/grain-overlay.tsx` — wire into root layout.
**Action:** Add to `src/app/layout.tsx` body. Already built, just not mounted.

### 7. Global Loading States
**File:** `src/components/ui/page-skeleton.tsx`
**Replaces:** Current loading spinners
**Visual:** Shimmer skeletons that match the page layout structure.
For AI-powered pages: Typewriter dots + "Thinking..." with the gooey
text morphing effect. Falling Pattern (confetti) on completion.

---

## Phase 1 — Foundation Layer
**Estimated time: 4-5 days**

Install the 7 global infrastructure components above. Everything after
builds on these foundations. Priority order:

1. Route Transition System (immediate visual improvement, 1 day)
2. Enhanced Card System (touches every page, 1.5 days)
3. Command Palette (killer feature, 2 days)
4. Grain Overlay wiring (5 minutes)
5. Enhanced PageHero v2 (2 days, can overlap)
6. Floating Action Menu (1 day)
7. Loading States (1 day)

---

## Phase 2 — Core Pages (Tier 1)

### `/dashboard` — Home
**Current:** StatCard grid + recent activity list
**Revamp:**

**Hero Zone:**
- WebGL Shader background (subtle blue-to-white gradient mesh, animated).
  Not a full-screen takeover — just the top 300px behind the greeting.
- Gooey Text Morphing on the greeting: "Good morning, Nicklas" morphs to
  show contextual state ("3 deals closing today", "12 new leads").
- Letter Swap counters for key metrics (revenue, active clients, pipeline).

**Activity Feed (below hero):**
- Replace flat list with Radial Orbital Timeline — a circular visualization
  where each agent/activity type orbits. Recent events pulse outward.
  Interactive: click an orbit node to expand details.
- Alternatively: vertical timeline with Vertical Cut Reveal on each entry.

**Quick Actions:**
- FloatingActionMenu in bottom-right.
- 3 contextual "Smart Suggestions" cards using Animate Card hover effects.
  AI-generated based on recent activity ("Follow up with Acme Corp —
  no contact in 14 days").

**Bento Grid:**
- Replace uniform StatCard rows with asymmetric bento layout.
  One large "focus" tile (2x2), surrounded by smaller tiles.
  Shine Border on the focus tile.
- Focus tile content rotates: top deal, next meeting, urgent task.

**Implementation:** ~3 days

---

### `/dashboard/inbox` — Unified Inbox
**Current:** 3-pane Gmail-style layout
**Revamp:**

- Keep the 3-pane structure (it works for inbox UX)
- Add Link Preview on hover for URLs in messages
- Typewriter effect for AI-suggested replies as they stream in
- Animate Card on message list items (subtle hover lift)
- Label component for status badges (unread, urgent, AI-handled)
- Shine Border on the selected/active message
- Splite text reveal on section headers ("Inbox", "Sent", "AI Handled")

**Implementation:** ~1.5 days

---

### `/dashboard/clients` — Client List
**Current:** Table/grid of client cards
**Revamp:**

- Animate Card on each client card with hover tilt + shine
- Image Trail effect when hovering over client avatars (shows recent
  work samples in a trailing cursor gallery)
- Link Preview when hovering client name in any table row
- Letter Swap on client count in the PageHero
- Client health indicator using Progress Indicator (animated ring)
- Filter chips using Liquid Glass Button (Tahoe) style
- Staggered card entrance with 40ms delay per card

**Implementation:** ~2 days

---

### `/dashboard/clients/[id]` — Client Detail
**Current:** Tabbed detail page
**Revamp:**

- Scroll Expansion Hero: client cover image/branding expands as you scroll up
- Radial Orbital Timeline for client activity history
- Animate Card on each section panel
- AI insight card with Hero Dithering texture (premium feel)
- Progress Indicator for onboarding completion / health score
- Gooey Text Morphing on the AI summary section

**Implementation:** ~2 days

---

### `/dashboard/analytics` — Analytics
**Current:** Bento grid with sparklines and scorecard
**Revamp:**

- Letter Swap on ALL numbers (counters animate on data load and refresh)
- Shader Animation as subtle background texture on the hero zone
- Chart cards with Animate Card hover (lift + shine border on focus)
- Gooey Text Morphing for the period label ("This Week" morphs to
  "Last 7 Days" on toggle)
- Filter bar using Liquid Glass (Tahoe) pill buttons
- Vertical Cut Reveal on section transitions as you scroll
- Dithering Card for the "AI Insights" panel

**Implementation:** ~2 days

---

### `/dashboard/crm` — CRM Pipeline
**Current:** Kanban board
**Revamp:**

- Kanban columns with Animate Card on each deal card
- Letter Swap on deal values (animate when drag-dropped to new stage)
- Shine Border on the card being dragged
- Falling Pattern (subtle confetti) when a deal moves to "Won"
- Liquid Glass (Tahoe) for stage filter pills
- Link Preview on client names within deal cards
- Progress Indicator showing pipeline velocity per stage

**Implementation:** ~2 days

---

### `/dashboard/calendar` — Calendar
**Current:** Calendar grid
**Revamp:**

- Keep the calendar grid structure
- Animate Card on event cards within cells
- Liquid Glass overlay for the event detail popover
- Label component for event type badges (meeting, call, task, deadline)
- Letter Swap on the date display when navigating months
- Subtle Shader Animation gradient on today's date cell (breathing glow)

**Implementation:** ~1 day

---

## Phase 3 — Sales & Outreach

### `/dashboard/outreach-hub` — Outreach Command Center
**Revamp:**
- Isometric Wave Grid as hero background (subtle, low opacity)
- Radial Orbital Timeline showing outreach cadence per channel
- Animate Card on each campaign card
- Letter Swap on sent/opened/replied counters
- Progress Indicator for sequence completion rates
- FlowButton for primary "Launch Campaign" CTA

### `/dashboard/scraper` — Lead Finder
**Revamp:**
- AI Prompt Box for the search query input (rich, with suggestions)
- Animate Card on each lead result with hover tilt
- Image Trail on company logos (shows recent leads from same industry)
- Label badges for lead quality score (hot/warm/cold)
- Typewriter effect on AI enrichment results as they populate

### `/dashboard/deals` — Deal Board
**Revamp:**
- Same Kanban treatment as CRM but with Pricing Interaction-style
  value cards that flip to show deal details
- Shine Border on deals above $10K (visual premium tier)
- Falling Pattern when marking "Won"
- Letter Swap on total pipeline value

### `/dashboard/coach` — Sales Coach
**Revamp:**
- AI Prompt Box for asking the coach questions
- Typewriter effect on coaching responses
- Dithering Card for the "Call Analysis" results panel
- Progress Indicator for improvement metrics over time
- Animate Card on each analysis in the history list

### `/dashboard/eleven-agents` — AI Caller
**Revamp:**
- Shader Animation background (audio waveform-inspired)
- Radial Orbital Timeline for call history
- FlowButton for "Start Call" primary action
- Letter Swap on call duration/cost counters
- Label for call status (ringing, connected, completed, failed)

### `/dashboard/voice-studio` — Voice Studio
**Revamp:**
- WebGL Shader background (audio frequency mesh)
- Animate Card on each voice preset card
- Shine Border on the actively selected voice
- MetalButton for "Clone Voice" (premium action)
- Progress Indicator for clone training progress
- Typewriter effect on voice sample text

### `/dashboard/conversations` — Conversations
**Revamp:**
- 3-pane layout (like inbox) with Link Preview on URLs
- Typewriter for AI auto-responses
- Label badges per channel (SMS, email, DM, WhatsApp)
- Animate Card on conversation list items
- Gooey Text Morphing on "New Messages" counter

---

## Phase 4 — Create & Content

### `/dashboard/copywriter` — AI Copywriter
**Revamp:**
- AI Prompt Box (full featured) as the primary input
- Typewriter effect on ALL generated copy output
- Gooey Text Morphing on the tone selector ("Professional" morphs to
  "Casual" when switching)
- Animate Card on saved templates
- FlowButton for "Generate" CTA
- Dithering Card for the "Brand Voice" indicator panel
- Text Rotate on placeholder suggestions in the prompt box

### `/dashboard/script-lab` — Script Lab
**Revamp:**
- Same AI Prompt Box treatment
- Typewriter streaming for script generation
- Split-panel with Animate Card on each script section
- Letter Swap on word count / reading time
- Vertical Cut Reveal on each script beat/section header

### `/dashboard/brand-kit` — Brand Kit
**Revamp:**
- Minimalist Hero (clean, spacious, no gradient noise)
- Color palette display with Shine Border on selected swatch
- Animate Card on each brand asset card
- Image Trail on logo/asset hover (shows usage examples)
- MetalButton for "Export Brand Kit" action

### `/dashboard/websites` — Website Builder
**Revamp:**
- Scroll Expansion Hero showing a preview of the user's website
- Animate Card on each page/section card in the editor
- Liquid Glass (Tahoe) for the toolbar buttons
- Link Preview on internal page references
- Progress Indicator for publish/deploy status
- FlowButton for "Publish" CTA

### `/dashboard/social-manager` — Social Manager
**Revamp:**
- Animate Card on each scheduled post
- Label badges for platform (Instagram, Twitter, LinkedIn, TikTok)
- Letter Swap on engagement counters
- Calendar view with Liquid Glass popover on day cells
- Image Trail on post preview hover (shows engagement timeline)
- Text Rotate on the PageHero subtitle cycling platform tips

### `/dashboard/content-plan` — Content Calendar
**Revamp:**
- Calendar-centric layout with Animate Card on each content piece
- Shine Border on today's content
- Label for content status (draft, scheduled, published, performing)
- Vertical Cut Reveal on weekly section headers
- FlowButton for "Schedule" action

### `/dashboard/newsletter` — Newsletter
**Revamp:**
- Minimalist Hero with Bodoni Moda editorial headline
- Animate Card on each newsletter issue
- Typewriter for AI subject line suggestions
- Letter Swap on subscriber count, open rate
- Progress Indicator for campaign send progress

---

## Phase 5 — Visual & Media

### `/dashboard/thumbnail-generator` — Thumbnail Generator
**Revamp:**
- AI Prompt Box for thumbnail description
- Animate Card on generated thumbnail options
- Shine Border on selected thumbnail
- Image Trail on thumbnail hover (shows size variants)
- Falling Pattern when generation completes (celebration)
- FlowButton for "Generate" CTA
- Hero Dithering Card for the "AI Suggestions" panel

### `/dashboard/ai-studio` — AI Image Studio
**Revamp:**
- WebGL Shader background (creative/artistic mesh)
- AI Prompt Box (full featured with image upload, style presets)
- Animate Card grid for generated images
- Image Trail following cursor over the gallery
- Shine Border on selected image
- Typewriter on generation progress messages
- Dithering Card for style preset cards (gives them texture)

### `/dashboard/video-editor` — Video Editor
**Revamp:**
- Full-width timeline with Shader Animation gradient (subtle)
- Animate Card on each clip in the timeline
- Progress Indicator for render progress
- Letter Swap on duration/frame counters
- FlowButton for "Export" primary CTA
- Label badges for clip type (intro, body, outro, transition)
- MetalButton for destructive actions (delete clip, reset)

### `/dashboard/ai-video` — AI Video Generator
**Revamp:**
- AI Prompt Box for video description
- Typewriter streaming on generation status
- Animate Card on generated video previews
- Progress Indicator with stage labels ("Scripting", "Generating",
  "Rendering", "Done")
- Falling Pattern on completion
- Letter Swap on estimated time remaining

### `/dashboard/design-studio` — Design Studio
**Revamp:**
- Pixend-inspired image-forward card layout
- Animate Card on each design project
- Image Trail on design hover
- Liquid Glass toolbar for editing tools
- Shine Border on active/selected design

---

## Phase 6 — Automate & AI

### `/dashboard/services` — AI Agents Hub
**Revamp:**
- Talentify-inspired agent profile cards (each agent gets a personality)
- Animate Card with unique hover effects per agent type
- Radial Orbital Timeline showing agent activity across the system
- Shine Border on active/running agents
- Label badges for agent status (active, idle, error, learning)
- Gooey Text Morphing on agent names (shows current task on hover)
- Isometric Wave Grid as section background

### `/dashboard/agent-office` — Pixel Agent Office
**Current:** PixiJS pixel art — already unique. Preserve as-is.
**Enhance:**
- Shader Animation for the sky/background gradient
- Radial Orbital Timeline in the side panel for event history
- Animate Card on the agent detail panels
- Letter Swap on stat counters in the panel
- Better loading state with animated pixel characters walking in

### `/dashboard/workflows` — Workflows
**Revamp:**
- Animate Card on each workflow card
- Progress Indicator for workflow completion/success rate
- Radial Orbital Timeline for execution history
- FlowButton for "Create Workflow" CTA
- Label badges for workflow status (active, paused, error)
- Shine Border on running workflows
- Letter Swap on trigger count

### `/dashboard/workflow-builder` — Flow Builder
**Revamp:**
- Node-based editor with Liquid Glass node cards
- Shine Border on selected/active node
- Animate Card on the node palette (draggable)
- Progress Indicator for validation status
- Typewriter on AI-suggested node descriptions
- Shader Animation connecting lines (flowing particles along edges)

### `/dashboard/automations` — Automations
**Revamp:**
- Animate Card on each automation card
- Label for trigger type + frequency
- Letter Swap on execution counters
- Shine Border on active automations
- FlowButton for "New Automation" CTA

### `/dashboard/trinity` — Trinity AI Assistant
**Revamp:**
- AI Prompt Box (flagship implementation — full features)
- Typewriter streaming for all AI responses
- Gooey Text Morphing on Trinity's "thinking" indicator
- Liquid Glass message bubbles for the chat interface
- Animate Card on suggested actions
- WebGL Shader background (subtle, Trinity-themed)
- This is the HERO page for AI — maximize "wow factor"

---

## Phase 7 — Manage & Operations

### `/dashboard/team` — Team Management
**Revamp:**
- Talentify-inspired team member profile cards
- Animate Card on each member card
- Progress Indicator for individual workload/utilization
- Label badges for role (admin, member, client)
- Image Trail on avatar hover (shows recent contributions)
- Shine Border on the current user's card

### `/dashboard/financials` — Financials
**Revamp:**
- Crypton-inspired metric-heavy layout
- Letter Swap on ALL financial figures
- Animate Card on each financial panel
- Shader Animation subtle background on the hero zone
- Chart cards with Dithering texture for premium feel
- Progress Indicator for monthly targets
- Vertical Cut Reveal on section headers

### `/dashboard/invoices` — Invoices
**Revamp:**
- Animate Card on each invoice row/card
- Label for invoice status (draft, sent, paid, overdue)
- Letter Swap on totals
- Shine Border on overdue invoices (attention-drawing)
- FlowButton for "Create Invoice" CTA
- Falling Pattern when marked as paid (micro-celebration)

### `/dashboard/forecast` — Revenue Forecast
**Revamp:**
- Crypton-inspired data visualization layout
- Letter Swap on all projected numbers
- Animate Card on forecast scenario cards
- Gooey Text Morphing on confidence labels ("High" morphs to value)
- Shader Animation on the chart background (subtle pulse)
- Progress Indicator for forecast accuracy score

### `/dashboard/production` — Production Board
**Revamp:**
- Kanban columns with Animate Card on each task card
- Label for task priority (urgent, high, medium, low)
- Shine Border on blocked tasks
- Letter Swap on completion counters
- FlowButton for "Add Task" CTA
- Progress Indicator per column (% complete)

### `/dashboard/projects` — Projects
**Revamp:**
- Animate Card on each project card
- Progress Indicator for each project's completion
- Letter Swap on budget/hours counters
- Label for project status badges
- Dithering Card for featured/priority projects
- Vertical Cut Reveal on project section headers

### `/dashboard/settings` — Settings Hub
**Revamp:**
- Minimalist Hero (Landin-inspired, clean and spacious)
- Animate Card grid for settings categories
- Clean icon + label layout (no visual noise)
- Subtle hover effects only

### `/dashboard/billing` — Billing
**Revamp:**
- Pricing Interaction for plan comparison/switcher
- Animate Card on current plan card
- Letter Swap on usage/spending counters
- Progress Indicator for usage limits
- MetalButton for "Upgrade" CTA (premium feel)
- Shine Border on the recommended plan

---

## Phase 8 — Marketing & Public Pages

### `/` — Landing Page (Homepage)
**This is the showpiece. Maximum visual impact.**

**Hero Section:**
- ScrollExpansionHero: large visual (product screenshot or 3D render)
  that expands from a card into full viewport as user scrolls.
- WebGL Shader animated background behind the hero text.
- Gooey Text Morphing on the main headline (morphs between value props:
  "Run Your Agency" -> "Scale Your Business" -> "Automate Everything").
- Text Rotate on the subtitle (cycling through features).
- LiquidGlassButton for primary CTA ("Start Free Trial").
- FlowButton for secondary CTA ("See Demo").

**Features Section:**
- Reveal Images: each feature screenshot reveals on scroll with parallax.
- Animate Card on feature cards with hover tilt.
- Vertical Cut Reveal on section headers.
- Isometric Wave Grid as subtle section background.

**Social Proof:**
- Testimonials Columns: 3-column auto-scrolling testimonials.
- Animate Card on each testimonial with hover pause.
- Shine Border on featured testimonials.

**Pricing Section:**
- Pricing Interaction: animated plan cards that flip/expand on selection.
- Letter Swap on price values.
- LiquidGlassButton for plan CTAs.
- Shine Border on the recommended plan.

**Footer:**
- Minimalist, editorial (Menoa-inspired).
- Link Preview on resource links.

**Implementation:** ~5 days (the most complex single page)

---

### `/login` — Login Page
**Revamp:**
- WebGL Shader background (subtle blue mesh, slowly moving)
- Liquid Glass card for the login form
- FlowButton for "Sign In" CTA
- Stack3D brand mark (already there, keep it)
- Gooey Text Morphing on the welcome message
- Falling Pattern on successful login (brief celebration)

**Implementation:** ~0.5 day

---

### `/pricing` — Pricing Page
**Revamp:**
- Pricing Interaction (full implementation)
- Letter Swap on all prices
- Animate Card on each plan card
- Shine Border on recommended plan
- LiquidGlassButton for plan CTAs
- Testimonials Columns below pricing
- Text Rotate on the subtitle

**Implementation:** ~2 days

---

### `/onboarding/vertical` — Onboarding
**Revamp:**
- Progress Indicator (animated step tracker)
- Animate Card on each vertical/template option
- FlowButton for "Continue" CTAs
- Gooey Text Morphing on the step title
- Vertical Cut Reveal on each new step
- Falling Pattern on completion

**Implementation:** ~1 day

---

## Phase 9 — Client Portal

Lighter aesthetic by design — fewer "wow" effects, more focus on clarity.

### `/dashboard/portal` — Portal Home
- Animate Card on summary cards (lighter hover, no tilt)
- Progress Indicator for project status
- Label badges for priorities
- Clean Minimalist Hero

### `/dashboard/portal/agency-room` — Agency Room
- Animate Card on shared asset cards
- Label for asset type badges
- Link Preview on shared links

### `/portal/[clientId]` — Public Client View
- Minimalist Hero with agency branding
- Animate Card on deliverable cards
- Progress Indicator for project phases
- Clean, professional, no flashy effects

---

## Phase 10 — Polish & Micro-interactions

### Cursor Effects
- Image Trail on portfolio/gallery hover surfaces
- Subtle cursor glow on interactive elements (CSS only, no JS overhead)

### Status Transitions
- Falling Pattern (confetti) on: deal won, invoice paid, campaign sent,
  video rendered, voice cloned, workflow completed
- Gooey Text Morphing on: status badge changes, counter updates
- Shine Border pulse on: newly created items, recently updated

### Empty States
- Each empty state gets a unique illustration + Typewriter message
  ("No clients yet. Let's change that." types out)
- FlowButton for the empty-state CTA
- Stack3D brand mark for visual consistency

### Error States
- Animate Card with red-tinted Shine Border on error cards
- Gooey Text Morphing for error messages (appear smoothly, not jarring)
- MetalButton for retry actions

### Notifications
- Label component for notification badges (animated count)
- Animate Card on each notification in the dropdown
- Typewriter on new notification text

---

## Implementation Priorities

### Sprint 1 (Week 1): Foundation — 5 days
| Task | Component | Est. |
|------|-----------|------|
| Route transitions | RouteTransition | 1d |
| Animate Card system | AnimateCard | 1.5d |
| Command Palette | ActionSearchBar | 2d |
| Grain overlay wiring | GrainOverlay | 0.1d |

### Sprint 2 (Week 2): Core Pages — 5 days
| Task | Component | Est. |
|------|-----------|------|
| Dashboard home revamp | WebGL + Gooey + LetterSwap + Orbital | 3d |
| Enhanced PageHero v2 | TextRotate + LetterSwap + VerticalCut | 2d |

### Sprint 3 (Week 3): High-Impact Pages — 5 days
| Task | Component | Est. |
|------|-----------|------|
| Landing page full revamp | ScrollExpansion + WebGL + TestimonialColumns + PricingInteraction | 5d |

### Sprint 4 (Week 4): AI & Creation — 5 days
| Task | Component | Est. |
|------|-----------|------|
| AI Prompt Box (shared) | AIPromptBox | 1.5d |
| Typewriter streaming | Typewriter | 0.5d |
| Trinity page revamp | Full AI treatment | 1d |
| Copywriter + Script Lab | AI Prompt + Typewriter | 1d |
| FAB menu + Loading states | FloatingAction + Skeletons | 1d |

### Sprint 5 (Week 5): Sales & CRM — 5 days
| Task | Component | Est. |
|------|-----------|------|
| CRM pipeline revamp | Kanban + AnimateCard + FallingPattern | 2d |
| Client list + detail | AnimateCard + ImageTrail + OrbitalTimeline | 2d |
| Inbox enhancement | LinkPreview + Typewriter + Labels | 1d |

### Sprint 6 (Week 6): Analytics & Finance — 4 days
| Task | Component | Est. |
|------|-----------|------|
| Analytics revamp | LetterSwap + ShaderBg + DitheredCards | 2d |
| Financials + Forecast | Crypton-style + LetterSwap | 1d |
| Billing + Pricing | PricingInteraction | 1d |

### Sprint 7 (Week 7): Remaining Pages — 5 days
| Task | Component | Est. |
|------|-----------|------|
| Automations + Workflows | AnimateCard + Progress + Labels | 2d |
| Voice Studio + Dialer | ShaderBg + AnimateCard | 1d |
| Team + Production + Projects | Talentify cards + Progress | 1d |
| Login + Onboarding | WebGL + FallingPattern + Progress | 1d |

### Sprint 8 (Week 8): Polish — 4 days
| Task | Component | Est. |
|------|-----------|------|
| Empty states overhaul | Typewriter + Stack3D + FlowButton | 1d |
| Error states + notifications | AnimateCard + Labels + GooeyText | 1d |
| Client Portal refinements | Minimal treatments | 1d |
| Performance audit + reduced-motion | All components | 1d |

---

## Dependency Graph

```
GrainOverlay (already built) ─────────────────── wire in layout (5 min)
                                                      │
AnimateCard ──────────────────────────────────── used by ALL card surfaces
    │
    ├── ShineBoerder (addon to AnimateCard)
    ├── DitheredCard (addon to AnimateCard)
    │
RouteTransition ─────────────────────────────── wraps dashboard layout
    │
    ├── VerticalCutReveal (used IN transitions)
    │
CommandPalette (ActionSearchBar) ────────────── global, standalone
    │
FloatingActionMenu ──────────────────────────── global, standalone
    │
PageHero v2 ─────────────────────────────────── evolve existing
    │
    ├── TextRotate (subtitle cycles)
    ├── LetterSwap (hero counters)
    ├── GooeyTextMorphing (greeting)
    ├── VerticalCutReveal (eyebrow)
    │
AIPromptBox ─────────────────────────────────── shared by 8+ AI pages
    │
    ├── Typewriter (streaming output)
    │
WebGLShader ─────────────────────────────────── landing, dashboard, login, trinity
    │
    ├── ShaderAnimation (variant for sections)
    │
RadialOrbitalTimeline ───────────────────────── agent office, activity feeds
    │
ScrollExpansionHero ─────────────────────────── landing page hero
    │
PricingInteraction ──────────────────────────── pricing, billing, upgrade
    │
TestimonialColumns ──────────────────────────── landing page social proof
    │
FallingPattern ──────────────────────────────── celebration moments (on-demand)
    │
ImageTrail ──────────────────────────────────── gallery/portfolio hovers
    │
LinkPreview ─────────────────────────────────── any surface with URLs
    │
LiquidGlassButton ──────────────────────────── premium CTAs
    │
FlowButton ──────────────────────────────────── primary CTAs
    │
MetalButton ─────────────────────────────────── destructive/premium actions
    │
ProgressIndicator ───────────────────────────── onboarding, workflows, projects
    │
Label (animated badge) ──────────────────────── status indicators everywhere
```

---

## Performance Budget

Every component must meet these constraints:

| Metric | Budget |
|--------|--------|
| JS per component (gzipped) | < 8KB |
| First paint impact | < 50ms |
| Animation frame budget | 16.6ms (60fps) |
| `prefers-reduced-motion` | All motion disabled or < 100ms |
| WebGL shader pages | Lazy-loaded, < 30KB shader code |
| Total additional JS | < 80KB gzipped across all new components |

### Performance Rules:
1. All shaders/WebGL lazy-load via `dynamic(() => import(...), { ssr: false })`
2. AnimateCard uses CSS transforms only (compositor-friendly)
3. LetterSwap uses `requestAnimationFrame`, not `setInterval`
4. Typewriter yields to main thread every 16ms
5. Command Palette search is debounced (150ms)
6. ImageTrail throttled to 30fps max
7. All Framer Motion animations use `layout` prop sparingly (expensive)
8. Intersection Observer for all scroll-triggered effects

---

## Color Application Guide

The blue (#2563EB) / white / gray palette applied to new components:

| Component | Primary Color | Accent | Background |
|-----------|--------------|--------|------------|
| FlowButton hover fill | `#2563EB` | — | White |
| LiquidGlassButton | White glass | `#2563EB` text | Frosted blur |
| ShineBoerder glow | `#2563EB` at 30% | — | White card |
| AnimateCard hover line | `#2563EB` bottom | — | White card |
| CommandPalette highlight | `#2563EB` at 8% | `#2563EB` text | White |
| Labels (active) | `#2563EB` bg | White text | — |
| ProgressIndicator fill | `#2563EB` | `#E5E7EB` track | — |
| WebGL Shader | `#2563EB` + `#3B82F6` mesh | White fog | `#F3F6FA` |
| FallingPattern confetti | `#2563EB` + `#3B82F6` + `#93C5FD` | — | — |
| DitheredCard texture | `#2563EB` at 3% | — | White card |
| Orbital Timeline orbits | `#2563EB` rings | `#3B82F6` nodes | White |

### Semantic Colors (unchanged):
- Success: `#22C55E`
- Warning: `#F59E0B`
- Error: `#EF4444`
- Info: `#2563EB` (same as brand)

---

## Files to Create

```
src/components/ui/
  ├── command-palette.tsx          # ActionSearchBar adaptation
  ├── floating-action-menu.tsx     # Context-aware FAB
  ├── route-transition.tsx         # Page transition wrapper
  ├── animate-card.tsx             # Universal card enhancement
  ├── shine-border.tsx             # Animated gradient border
  ├── dithering-card.tsx           # Halftone texture card variant
  ├── flow-button.tsx              # Circle-fill hover button
  ├── liquid-glass-button.tsx      # Apple Tahoe glass button
  ├── metal-button.tsx             # Brushed metal button
  ├── ai-prompt-box.tsx            # Rich AI input component
  ├── typewriter.tsx               # Typing animation for AI output
  ├── letter-swap.tsx              # Animated counter/text swap
  ├── gooey-text-morph.tsx         # SVG filter text morphing
  ├── text-rotate.tsx              # Rotating text carousel
  ├── vertical-cut-reveal.tsx      # Section reveal animation
  ├── splite.tsx                   # Split text reveal
  ├── progress-indicator.tsx       # Animated step/ring progress
  ├── label-animated.tsx           # Animated badge/tag
  ├── link-preview.tsx             # Hover URL preview card
  ├── image-trail.tsx              # Cursor-following images
  ├── falling-pattern.tsx          # Confetti/celebration
  ├── pricing-interaction.tsx      # Animated pricing cards
  ├── testimonial-columns.tsx      # Auto-scrolling testimonials
  ├── page-skeleton.tsx            # Enhanced loading skeletons
  └── page-hero.tsx                # (EVOLVE existing)

src/components/backgrounds/
  ├── webgl-shader.tsx             # GPU mesh gradient
  ├── shader-animation.tsx         # Programmatic patterns
  ├── isometric-wave-grid.tsx      # 3D grid background
  └── scroll-expansion-hero.tsx    # Scroll-driven media expansion

src/components/data/
  └── radial-orbital-timeline.tsx  # Circular activity visualization
```

**Total new files: ~30 components**
**Estimated total implementation: 8 weeks (1 developer)**
**Estimated total implementation: 4 weeks (2 developers in parallel)**
