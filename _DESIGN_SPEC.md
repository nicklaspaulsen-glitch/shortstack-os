# ShortStack OS — Dashboard Design Spec
> Authoritative spec for all parallel agent UI passes. Follow exactly.
> Last updated: May 2026 — Light × Blue × Editorial system.

## Brand Tokens (locked, do not invent new values)

```
Primary accent:    #2563EB
Hover/highlight:   #3B82F6
Dim/pressed:       #1D4ED8
Base surface:      #F3F6FA
Card surface:      #FFFFFF
Border subtle:     rgba(0,0,0,0.06)
Border strong:     rgba(0,0,0,0.14)
Text primary:      #111827
Text secondary:    #374151
Text muted:        #6B7280
```

DO NOT use: red, gold, amber, lime, purple as accents. If you find `#FF4040`, `#FF2D2D`, `#D4FF00`, replace with `#2563EB` or `#3B82F6`.

## Page-Level Pattern (apply to every page)

### 1. PageHero eyebrow prop
Every PageHero should have an `eyebrow` prop. It renders in small italic caps above the title.
Pick a short 1-4 word descriptor in ALL CAPS that describes the page section, e.g.:
- leads → `eyebrow="CONTACT HQ"`
- crm → `eyebrow="RELATIONSHIP ENGINE"`
- outreach-hub → `eyebrow="OUTREACH COMMAND"`
- sequences → `eyebrow="SEQUENCE BUILDER"`
- clients → `eyebrow="CLIENT MANAGEMENT"`
- deals → `eyebrow="DEAL PIPELINE"`
- proposals → `eyebrow="PROPOSAL STUDIO"`
- analytics → `eyebrow="ANALYTICS HUB"` (may already have it)
- automations → `eyebrow="AUTOMATION ENGINE"`
- workflows → `eyebrow="WORKFLOW BUILDER"`
- voice-studio → `eyebrow="VOICE STUDIO"`
- social-manager → `eyebrow="SOCIAL COMMAND"`
- content → `eyebrow="CONTENT STUDIO"`
- team → `eyebrow="TEAM HQ"`
- settings → `eyebrow="COMMAND CENTER"`
- billing → `eyebrow="BILLING & PLANS"`
- ai-studio → `eyebrow="AI COMMAND"` (may already have it)
- thumbnail-generator → `eyebrow="VISUAL STUDIO"`
- copywriter → `eyebrow="COPY ENGINE"`
- script-lab → `eyebrow="SCRIPT STUDIO"`
- reports → `eyebrow="INTEL REPORTS"`
- calendar → `eyebrow="TIME COMMAND"`
- white-label → `eyebrow="WHITE LABEL"`
- connect → `eyebrow="INTEGRATIONS"`
- profile → `eyebrow="YOUR PROFILE"`

### 2. Framer Motion stagger containers
Wrap the main content grid or list in a stagger container:

```tsx
import { motion } from "framer-motion";

// Container — put this around the grid/list
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } }
};

// Item — put this on each card/row
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] } }
};

// Usage:
<motion.div
  variants={containerVariants}
  initial="hidden"
  animate="visible"
  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
>
  {items.map(item => (
    <motion.div key={item.id} variants={itemVariants}>
      {/* existing card content */}
    </motion.div>
  ))}
</motion.div>
```

If the page already has `motion.div` wrapping items, don't add a duplicate.
Add stagger ONLY to the primary content grid (top stat cards, main data list, main card grid).

### 3. Section header blue accent rail
For major section headers (h2 level sections), add a left blue accent rail:

```tsx
// Replace plain <h2> section headers with this pattern:
<div className="flex items-center gap-3 mb-4">
  <div className="w-[3px] h-6 rounded-full bg-[#2563EB]" />
  <h2 className="text-base font-semibold text-gray-900">Section Title</h2>
</div>
```

Apply this to major section dividers, not to every sub-heading.

### 4. Stat tile glass treatment
For stat tiles that are plain divs, upgrade to glass card style:

```tsx
// Before (plain):
<div className="bg-gray-800 rounded-lg p-4">

// After (glass card):
<div className="bg-white rounded-xl border border-black/[0.06] shadow-sm p-4 
                hover:shadow-md hover:-translate-y-0.5 transition-all duration-220">
```

If the page already uses `.card` class or `StatCard` component, leave as-is.

## What NOT to change

- Do NOT change route handlers, API calls, or data fetching logic
- Do NOT change TypeScript types or interfaces
- Do NOT change state management or React hooks logic
- Do NOT refactor working business logic
- Do NOT change the `PrismPanel` usage
- Do NOT change `Modal`, dialog, or form logic
- Do NOT add new imports beyond `motion` (already available in most pages)
- Keep ALL existing functionality exactly as-is
- Portal pages (`/portal/*`) — lighter treatment: eyebrow only, no stagger

## Import to add (if not already present)
```tsx
import { motion } from "framer-motion";
```

Most pages already have this import. Check before adding.

## Commit style per group
```
brand(ui): editorial eyebrow + motion stagger pass — [group name]
```

## Priority order
1. eyebrow props (lowest risk, highest visual payoff)
2. stagger on primary content grid
3. section accent rails
4. glass card stat tiles (only if current style is clearly dated)

Always preserve existing working code. Minimal surgical edits only.
