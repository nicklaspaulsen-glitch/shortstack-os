"use client";

import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { tokens } from "@/lib/brand/tokens";
import Stack3D from "@/components/brand/stack-3d";
import PageHero3D, { type PageHero3DTheme } from "@/components/brand/page-hero-3d";

/**
 * Auto-pick a `theme3d` based on the current dashboard route. Every
 * dashboard page that mounts <PageHero> automatically gets a themed
 * 3D scene without per-page edits. Pages that pass an explicit
 * `theme3d` override this auto-detection.
 *
 * Mapping is broad — most pages fall under a section hub theme. The
 * "default" Trinity scene catches uncommon routes.
 */
function autoTheme3dFromPath(path: string): PageHero3DTheme {
  // Apr 28 v7: most-specific icon-matched themes win FIRST. The
  // section-hub themes are the broad fallback. Pages that have a
  // dedicated sidebar icon (Phone, Mic, Calendar, etc.) should render
  // a 3D scene that visibly matches that icon.

  // ── ICON-MATCHED themes (closest fit) ────────────────────────────
  // Phone (call surfaces)
  if (/\/(eleven-agents|voicemail-drop|phone-setup|phone-email|dialer)(?:\/|$)/.test(path)) {
    return "phone";
  }
  // Mic (voice studio)
  if (/\/(voice-studio|settings\/voice-profile)(?:\/|$)/.test(path)) {
    return "mic";
  }
  // Headphones (voice-AI)
  if (/\/voice-receptionist(?:\/|$)/.test(path)) {
    return "headphones";
  }
  // Calendar
  if (/\/(calendar|scheduling|meetings|content-plan)(?:\/|$)/.test(path)) {
    return "calendar";
  }
  // Mail / send
  if (/\/(email-composer|email-templates|mail-setup|newsletter|cold-email)(?:\/|$)/.test(path)) {
    return "mail";
  }
  // Search (lead finder)
  if (/\/(scraper|search)(?:\/|$)/.test(path)) {
    return "search";
  }
  // Settings
  if (/\/settings(?:\/|$)/.test(path)) {
    return "settings";
  }
  // Bell (notifications)
  if (/\/notifications(?:\/|$)/.test(path)) {
    return "bell";
  }
  // Crown (Agent HQ / premium / upgrade)
  if (/\/(agent-supervisor|upgrade|pricing)(?:\/|$)/.test(path)) {
    return "crown";
  }
  // Bot (telegram bot, AI chat)
  if (/\/(telegram-bot|telegram-presets|whatsapp|sms-templates|trinity)(?:\/|$)/.test(path)) {
    return "bot";
  }
  // Globe (websites, domains, google-business)
  if (/\/(websites|domains|google-business)(?:\/|$)/.test(path)) {
    return "globe";
  }
  // Heart (client health, reviews)
  if (/\/client-health(?:\/|$)/.test(path)) {
    return "heart";
  }
  // Star (reviews)
  if (/\/reviews(?:\/|$)/.test(path)) {
    return "star";
  }
  // Key (API keys, security)
  if (/\/(api\/keys|api\/webhooks|api-docs|webhooks)(?:\/|$)/.test(path)) {
    return "key";
  }
  // Shield (system status, security)
  if (/\/(system-status|admin\/status|self-test|monitor)(?:\/|$)/.test(path)) {
    return "shield";
  }
  // Target (competitors, ads)
  if (/\/(competitive-monitor|competitor|ads-manager|ads)(?:\/|$)/.test(path)) {
    return "target";
  }
  // Briefcase (vertical templates, white-label, subaccounts)
  if (/\/(verticals|white-label|subaccounts|workspaces)(?:\/|$)/.test(path)) {
    return "briefcase";
  }

  // ── SECTION-HUB themes (broad fallback) ──────────────────────────
  if (/\/dashboard\/sales(?:\/|$)/.test(path)) return "sales";
  if (/\/dashboard\/create(?:\/|$)/.test(path)) return "create";
  if (/\/dashboard\/visual(?:\/|$)/.test(path)) return "visual";
  if (/\/dashboard\/automate(?:\/|$)/.test(path)) return "automate";
  if (/\/dashboard\/manage(?:\/|$)/.test(path)) return "manage";
  if (/\/dashboard\/connect(?:\/|$)/.test(path)) return "connect";

  // AI / agent surfaces (broader catch).
  if (/\/(agent-office|agent-controls|agent-desktop|services|ai-)(?:\/|$)/.test(path)) {
    return "ai";
  }
  // Inbox / messaging.
  if (/\/(inbox|conversations|outreach-feed|portal\/support|discord)(?:\/|$)/.test(path)) {
    return "inbox";
  }
  // Lead / CRM.
  if (/\/(leads|lead-sources|crm|deals)(?:\/|$)/.test(path)) {
    return "leads";
  }
  // Sales-pipeline tools.
  if (/\/(outreach-hub|outreach-logs|sequences|proposals|forecast|commission|affiliates|dm-controller)(?:\/|$)/.test(path)) {
    return "sales";
  }
  // Content creation.
  if (/\/(copywriter|script-lab|carousel-generator|brand-voice|brand-kit|content|content-library|funnels|landing-pages|surveys|forms|social-studio|social-manager)(?:\/|$)/.test(path)) {
    return "create";
  }
  // Visual / image / video.
  if (/\/(thumbnail-generator|ai-studio|design-studio|design|video-editor|ai-video)(?:\/|$)/.test(path)) {
    return "visual";
  }
  // Automate / workflows / integrations.
  if (/\/(workflows|workflow-builder|automations|triggers|integrations|integrations-hub|integrations-marketplace|notion-sync)(?:\/|$)/.test(path)) {
    return "automate";
  }
  // Analytics / reports.
  if (/\/(analytics|reports|report-generator|usage|admin\/llm-costs|admin\/agent-traces)(?:\/|$)/.test(path)) {
    return "analytics";
  }
  // Manage / business (final fallback for ops surfaces).
  if (/\/(workspace|team|production|projects|financials|invoices|invoice-templates|billing|tickets|referrals|roi-calculator|marketplace|generations|profile|tags|courses|community|portal)(?:\/|$)/.test(path)) {
    return "manage";
  }

  return "default";
}

/**
 * PageHero — shared header used on every dashboard page.
 *
 * Foundation rebuild (Apr 27): swapped from amber-gradient hero blocks to
 * the OLED + lime + plum brand foundation. The original `gradient` prop is
 * preserved (gold/blue/purple/green/sunset/ocean) and remapped internally
 * to one of three new treatments — `lime`, `plum`, `indigo` — so the 100+
 * existing pages instantly inherit the new visual direction without any
 * per-page rewrites. New optional props (`photoUrl`, `showStack3D`, `eyebrow`,
 * `variant`) extend the API for editorial-style pages.
 *
 * The original `pattern` and `sparkles` props are accepted but ignored — the
 * new aesthetic uses lime-edge accent + grain instead of dot patterns + floating
 * sparkles. They stay in the props so existing call sites keep type-checking.
 */

export type HeroGradient = "gold" | "blue" | "purple" | "green" | "sunset" | "ocean";
export type HeroVariant = "default" | "hero" | "compact";

interface PageHeroProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  /** Legacy prop — remapped internally. Prefer no value (defaults to "gold" → lime). */
  gradient?: HeroGradient;
  actions?: ReactNode;
  /** Legacy prop — accepted for back-compat, ignored by the foundation rebuild. */
  pattern?: boolean;
  /** Optional small text/badge above the title. Renders in editorial italic + lime. */
  eyebrow?: ReactNode;
  /** Legacy prop — accepted for back-compat, ignored by the foundation rebuild. */
  sparkles?: boolean;
  /** Optional backdrop photo. Renders behind the OLED scrim. */
  photoUrl?: string;
  /** Render the 3D Stack brand mark in the top-right slot. */
  showStack3D?: boolean;
  /** Render a themed 3D scene in the top-right slot. Each theme renders
   *  a different 2-4 shape composition matching the page's purpose
   *  (sales, create, visual, automate, manage, connect, ai, voice,
   *  analytics, leads, inbox, default). Pages that pass `theme3d`
   *  get a unique brand moment without the per-page 3D refactor. */
  theme3d?: PageHero3DTheme;
  /** Visual size — controls title scale and vertical padding. */
  variant?: HeroVariant;
  className?: string;
}

/** Mapping from the legacy gradient names to the new foundation treatments. */
type Treatment = "lime" | "plum" | "indigo";

const TREATMENT_BY_GRADIENT: Record<HeroGradient, Treatment> = {
  gold: "lime", // primary brand
  green: "lime", // green wasn't really green — it was a tools surface, lift to lime
  blue: "indigo", // indigo replaces generic Tailwind blue
  ocean: "indigo",
  purple: "plum", // plum replaces generic Tailwind purple
  sunset: "plum",
};

interface TreatmentStyle {
  /** Background gradient layered under the photoUrl scrim. */
  bg: string;
  /** Color of the eyebrow + the left-edge accent line. */
  accent: string;
  /** Color used for the lime-style underscore beneath the title. */
  underline: string;
  /** Icon-tile background. */
  iconBg: string;
  /** Icon-tile border. */
  iconBorder: string;
}

const TREATMENTS: Record<Treatment, TreatmentStyle> = {
  lime: {
    bg: `linear-gradient(140deg, ${tokens.bg.base} 0%, ${tokens.bg.surface1} 60%, ${tokens.brand.plum} 130%)`,
    accent: tokens.brand.lime,
    underline: `linear-gradient(90deg, ${tokens.brand.lime} 0%, transparent 70%)`,
    iconBg: "rgba(212, 255, 0, 0.1)",
    iconBorder: tokens.border.strong,
  },
  plum: {
    bg: `linear-gradient(140deg, ${tokens.bg.base} 0%, ${tokens.brand.plum} 70%, ${tokens.brand.plumHover} 130%)`,
    accent: tokens.brand.lime,
    underline: `linear-gradient(90deg, ${tokens.brand.lime} 0%, transparent 70%)`,
    iconBg: "rgba(212, 255, 0, 0.08)",
    iconBorder: tokens.border.strong,
  },
  indigo: {
    bg: `linear-gradient(140deg, ${tokens.bg.base} 0%, ${tokens.bg.surface2} 50%, ${tokens.brand.indigo}30 130%)`,
    accent: tokens.brand.indigo,
    underline: `linear-gradient(90deg, ${tokens.brand.indigo} 0%, transparent 70%)`,
    iconBg: "rgba(94, 91, 255, 0.12)",
    iconBorder: "rgba(94, 91, 255, 0.35)",
  },
};

const VARIANT_PADDING: Record<HeroVariant, string> = {
  compact: "px-5 py-4 sm:px-6 sm:py-5",
  default: "px-6 py-6 sm:px-8 sm:py-8",
  hero: "px-7 py-10 sm:px-10 sm:py-14",
};

const VARIANT_TITLE_CLASS: Record<HeroVariant, string> = {
  // Satoshi display, fluid clamp, tight tracking — readable across viewports.
  compact: "font-display text-[clamp(1.5rem,1.2rem+1vw,2rem)] leading-[1.05]",
  default: "font-display text-[clamp(1.85rem,1.4rem+1.6vw,2.85rem)] leading-[1.02]",
  hero: "font-display text-[clamp(2.5rem,1.5rem+4vw,5rem)] leading-[1.0]",
};

export default function PageHero({
  title,
  subtitle,
  icon,
  gradient = "gold",
  actions,
  // pattern and sparkles preserved for back-compat — intentionally unused.
  pattern: _pattern = true, // eslint-disable-line @typescript-eslint/no-unused-vars
  eyebrow,
  sparkles: _sparkles, // eslint-disable-line @typescript-eslint/no-unused-vars
  photoUrl,
  showStack3D = false,
  theme3d,
  variant = "default",
  className = "",
}: PageHeroProps) {
  const treatment = TREATMENTS[TREATMENT_BY_GRADIENT[gradient]];
  const reduceMotion = useReducedMotion();
  // Auto-pick theme from pathname when caller didn't pass one. This
  // means every dashboard page that already uses <PageHero> picks up
  // a themed 3D moment without any per-page edit. Pages that want
  // to override (or opt out via "default") just pass `theme3d` explicit.
  const pathname = usePathname() || "";
  const effectiveTheme3d: PageHero3DTheme = theme3d ?? autoTheme3dFromPath(pathname);
  // Auto-show the 3D mark unless the page explicitly opted into
  // showStack3D (older pattern). Hide on compact variant — too cramped.
  const renderHero3d = !showStack3D && variant !== "compact";

  return (
    <div
      className={`relative overflow-hidden  border ${className}`}
      style={{
        background: treatment.bg,
        borderColor: tokens.border.subtle,
        boxShadow: [
          "0 1px 0 rgba(255,255,255,0.03) inset",
          "0 4px 12px rgba(0,0,0,0.4)",
          "0 16px 40px -12px rgba(0,0,0,0.55)",
        ].join(", "),
      }}
    >
      {/* Apr 28 v7: 3D scene moved OUT of the actions row to a corner-
          decoration absolute position. Previous layout placed the
          canvas inside the same flex row as the action buttons —
          even with pointer-events-none the wider canvas wrapper was
          eating click area on small viewports. Now the 3D sits
          behind everything (z-0) at top-right with pointer-events-
          none + opacity 0.85 so it reads as ambient depth, not UI. */}
      {renderHero3d && (
        <div
          className="pointer-events-none absolute top-1 right-2 sm:top-2 sm:right-4 z-0 hidden md:block"
          style={{ opacity: 0.92 }}
          aria-hidden
        >
          <PageHero3D
            theme={effectiveTheme3d}
            size={variant === "hero" ? "lg" : "md"}
          />
        </div>
      )}
      {/* Optional photographic backdrop — sits behind the gradient scrim. */}
      {photoUrl && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url(${photoUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.35,
            mixBlendMode: "luminosity",
          }}
          aria-hidden
        />
      )}

      {/* OLED scrim — re-applies the treatment gradient on top of the photo
       * so foreground text stays readable regardless of photo content. */}
      {photoUrl && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(180deg, rgba(10,10,11,0.55) 0%, rgba(10,10,11,0.85) 100%)`,
          }}
          aria-hidden
        />
      )}

      {/* Left-edge lime accent — 4px line, deliberate brand cue. */}
      <div
        className="pointer-events-none absolute left-0 top-[10%] bottom-[10%] w-1 rounded-r-sm"
        style={{
          background: treatment.accent,
          boxShadow: `0 0 16px ${treatment.accent}`,
        }}
        aria-hidden
      />

      {/* Subtle grain — local to the hero, scoped tighter than the global overlay. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1   0 0 0 0 1   0 0 0 0 1   0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          backgroundSize: "160px 160px",
        }}
        aria-hidden
      />

      {/* Content */}
      <motion.div
        className={`relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-5 ${VARIANT_PADDING[variant]}`}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        variants={reduceMotion ? {} : {
          hidden: {},
          visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
        }}
      >
        <div className="flex items-start gap-4 min-w-0 flex-1">
          {icon && (
            <motion.div
              className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: treatment.iconBg,
                border: `1px solid ${treatment.iconBorder}`,
                color: treatment.accent,
                boxShadow:
                  "0 2px 6px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.06) inset",
              }}
              variants={reduceMotion ? {} : {
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] } },
              }}
            >
              {icon}
            </motion.div>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <motion.div
                className="font-editorial text-sm mb-2"
                style={{ color: treatment.accent, opacity: 0.95 }}
                variants={reduceMotion ? {} : {
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] } },
                }}
              >
                {eyebrow}
              </motion.div>
            )}
            <motion.h1
              className={`${VARIANT_TITLE_CLASS[variant]} tracking-[-0.025em]`}
              style={{
                color: tokens.text.primary,
                textShadow: "0 1px 2px rgba(0,0,0,0.45)",
              }}
              variants={reduceMotion ? {} : {
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] } },
              }}
            >
              {title}
            </motion.h1>
            {/* Thin lime gradient line under the title — only on hero variant
             * to keep default/compact pages from feeling over-decorated. */}
            {variant === "hero" && (
              <div
                className="h-[2px] w-32 mt-3 rounded-full"
                style={{ background: treatment.underline }}
                aria-hidden
              />
            )}
            {subtitle && (
              <motion.p
                className="text-sm mt-2 max-w-2xl"
                style={{ color: tokens.text.secondary }}
                variants={reduceMotion ? {} : {
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] } },
                }}
              >
                {subtitle}
              </motion.p>
            )}
          </div>
        </div>

        <motion.div
          className="flex items-start gap-3 shrink-0 max-w-full md:ml-auto"
          variants={reduceMotion ? {} : {
            hidden: { opacity: 0, y: 10 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] } },
          }}
        >
          {actions && (
            <div className="relative z-20 flex flex-wrap items-center justify-end gap-2 shrink-0 max-w-full">
              {actions}
            </div>
          )}
          {/* Legacy Stack3D mark — only when the page explicitly
              passed `showStack3D`. The new auto-3D scene is rendered
              as a corner decoration above (outside this row) so it
              never overlaps action buttons on small viewports. */}
          {showStack3D && (
            <div className="hidden md:block shrink-0">
              <Stack3D size={variant === "hero" ? "md" : "sm"} />
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
