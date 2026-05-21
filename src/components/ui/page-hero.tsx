"use client";

import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { tokens } from "@/lib/brand/tokens";
import BrainMark from "@/components/brand/brain-mark";
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
export type HeroVariant = "default" | "hero" | "compact" | "editorial";

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
    accent: tokens.brand.accent,
    underline: `linear-gradient(90deg, ${tokens.brand.accent} 0%, transparent 70%)`,
    iconBg: "rgba(37, 99, 235, 0.1)",
    iconBorder: tokens.border.strong,
  },
  plum: {
    bg: `linear-gradient(140deg, ${tokens.bg.base} 0%, ${tokens.brand.plum} 70%, ${tokens.brand.plumHover} 130%)`,
    accent: tokens.brand.accent,
    underline: `linear-gradient(90deg, ${tokens.brand.accent} 0%, transparent 70%)`,
    iconBg: "rgba(37, 99, 235, 0.08)",
    iconBorder: tokens.border.strong,
  },
  indigo: {
    bg: `linear-gradient(140deg, ${tokens.bg.base} 0%, ${tokens.bg.surface2} 50%, ${tokens.brand.accent}30 130%)`,
    accent: tokens.brand.accent,
    underline: `linear-gradient(90deg, ${tokens.brand.accent} 0%, transparent 70%)`,
    iconBg: "rgba(37, 99, 235, 0.12)",
    iconBorder: "rgba(37, 99, 235, 0.35)",
  },
};

const VARIANT_PADDING: Record<HeroVariant, string> = {
  editorial: "",  // not used — editorial exits early
  compact: "px-5 py-4 sm:px-6 sm:py-5",
  default: "px-6 py-6 sm:px-8 sm:py-8",
  hero: "px-7 py-10 sm:px-10 sm:py-14",
};

const VARIANT_TITLE_CLASS: Record<HeroVariant, string> = {
  editorial: "",  // not used — editorial exits early
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
  variant = "editorial",
  className = "",
}: PageHeroProps) {
  // ── Editorial variant — premium glass header with section-aware tint ──
  if (variant === "editorial") {
    // Auto-detect section from pathname for tint
    const editorialPathname = typeof window !== "undefined" ? window.location.pathname : "";
    // Section tints: very subtle color shift in the glass based on route family
    let sectionTint = "rgba(212,255,0,0.018)"; // default: lime accent
    if (/\/(voice|phone|eleven|voicemail|dialer|headphone)/.test(editorialPathname)) {
      sectionTint = "rgba(139,92,246,0.020)"; // voice: soft violet
    } else if (/\/(leads|crm|deals|outreach|sales)/.test(editorialPathname)) {
      sectionTint = "rgba(16,185,129,0.016)"; // sales: soft green
    } else if (/\/(analytics|reports|forecast|financials)/.test(editorialPathname)) {
      sectionTint = "rgba(14,165,233,0.020)"; // analytics: sky
    } else if (/\/(content|carousel|script|copywriter|social)/.test(editorialPathname)) {
      sectionTint = "rgba(245,158,11,0.016)"; // create: amber
    } else if (/\/(thumbnail|video|ai-studio|design)/.test(editorialPathname)) {
      sectionTint = "rgba(99,102,241,0.020)"; // visual: indigo
    }

    return (
      <motion.div
        className={`relative overflow-hidden -mx-4 sm:-mx-6 mb-5 ${className}`}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        style={{
          background: `linear-gradient(135deg, rgba(2,7,17,0.95) 0%, rgba(8,12,28,0.92) 50%, rgba(13,17,40,0.90) 100%)`,
          backdropFilter: "blur(36px) saturate(2.2)",
          WebkitBackdropFilter: "blur(36px) saturate(2.2)",
          borderBottom: "1px solid rgba(212,255,0,0.16)",
          boxShadow: [
            "inset 0 1px 0 rgba(255,255,255,0.08)",
            "inset 0 0 0 1px rgba(212,255,0,0.08)",
            `inset 0 0 60px 0 ${sectionTint}`,
            "0 1px 3px rgba(0,0,0,0.35)",
            "0 4px 20px -4px rgba(0,0,0,0.45)",
            "0 0 80px -16px rgba(212,255,0,0.18)",
          ].join(", "),
        }}
      >
        {/* Top-edge gradient accent line — wider, brighter metallic sweep */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(212,255,0,0.72) 15%, rgba(212,255,0,0.40) 45%, rgba(99,102,241,0.30) 75%, transparent 100%)",
          }}
          aria-hidden
        />

        {/* Ambient glass orbs — subtle metallic depth behind the hero surface */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: "45%", height: "200%",
            top: "-50%", left: "-5%",
            background: "radial-gradient(ellipse, rgba(212,255,0,0.07) 0%, transparent 70%)",
            filter: "blur(20px)",
            animation: "blobDrift1 30s ease-in-out infinite",
          }}
          aria-hidden
        />
        <div
          className="absolute pointer-events-none"
          style={{
            width: "35%", height: "200%",
            top: "-50%", right: "8%",
            background: "radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 70%)",
            filter: "blur(16px)",
            animation: "blobDrift3 36s ease-in-out infinite",
          }}
          aria-hidden
        />

        {/* Subtle background shimmer — reveals the glass depth */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.35] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
            backgroundSize: "200px 200px",
          }}
          aria-hidden
        />

        <div className="relative flex items-center gap-3.5 pl-6 pr-5 py-[14px]">
          {icon && (
            <motion.div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 [&_svg]:w-[17px] [&_svg]:h-[17px]"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.20, delay: 0.04, ease: [0.32, 0.72, 0, 1] }}
              style={{
                background: "linear-gradient(135deg, rgba(212,255,0,0.09) 0%, rgba(212,255,0,0.05) 100%)",
                border: "1px solid rgba(212,255,0,0.18)",
                color: "#2563EB",
                boxShadow: "0 1px 4px rgba(212,255,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)",
              }}
            >
              {icon}
            </motion.div>
          )}

          <div className="flex-1 min-w-0">
            {eyebrow && (
              <motion.p
                className="font-editorial text-[9.5px] text-[#2563EB] mb-0.5 truncate uppercase"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.85 }}
                transition={{ duration: 0.18, delay: 0.06 }}
                style={{ letterSpacing: "0.10em" }}
              >
                {eyebrow}
              </motion.p>
            )}
            <motion.h1
              className="font-display text-[clamp(1.12rem,0.94rem+0.65vw,1.52rem)] font-bold text-text-primary leading-[1.12] tracking-[-0.025em] truncate"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, delay: 0.05, ease: [0.32, 0.72, 0, 1] }}
            >
              {title}
            </motion.h1>
            {subtitle && (
              <motion.p
                className="text-[11px] leading-[1.4] mt-0.5 truncate"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.62 }}
                transition={{ duration: 0.20, delay: 0.09 }}
                style={{ color: "#A8A8B2" }}
              >
                {subtitle}
              </motion.p>
            )}
          </div>

          {actions && (
            <motion.div
              className="flex items-center gap-2 shrink-0"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, delay: 0.08, ease: [0.32, 0.72, 0, 1] }}
            >
              {actions}
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  }

  const treatment = TREATMENTS[TREATMENT_BY_GRADIENT[gradient]];
  const reduceMotion = useReducedMotion();
  // Only render the 3D scene when the caller explicitly passes `theme3d`.
  // Previously, auto-detection was used (autoTheme3dFromPath) which caused
  // every page to mount a Three.js canvas — now opt-in only for performance.
  const pathname = usePathname() || "";
  const effectiveTheme3d: PageHero3DTheme = theme3d ?? autoTheme3dFromPath(pathname);
  // Render 3D only when explicitly requested via `theme3d` prop and not on
  // compact variant. `showStack3D` uses the legacy Stack3D mark instead.
  const renderHero3d = !!theme3d && !showStack3D && variant !== "compact";

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: "rgba(13,17,32,0.88)",
        backdropFilter: "blur(32px) saturate(1.6)",
        WebkitBackdropFilter: "blur(32px) saturate(1.6)",
        border: "1px solid rgba(212,255,0,0.12)",
        borderTopColor: "rgba(212,255,0,0.22)",
        borderRadius: "24px",
        boxShadow: [
          "inset 0 1.5px 0 rgba(255,255,255,0.06)",
          "inset 0 0 0 1px rgba(212,255,0,0.06)",
          "0 2px 8px rgba(0,0,0,0.35)",
          "0 8px 32px -8px rgba(0,0,0,0.45)",
          "0 0 64px -16px rgba(212,255,0,0.15)",
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

      {/* Dark scrim — ensures text readability over photo backgrounds on OLED. */}
      {photoUrl && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(180deg, rgba(13,17,32,0.55) 0%, rgba(13,17,32,0.80) 100%)`,
          }}
          aria-hidden
        />
      )}

      {/* Top-edge blue accent line — 1px horizontal gradient, no side-stripe */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${treatment.accent}bb 20%, ${treatment.accent}77 75%, transparent 100%)`,
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
          visible: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } },
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
                boxShadow: "0 1px 3px rgba(0,0,0,0.10)",
              }}
              variants={reduceMotion ? {} : {
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } },
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
                  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } },
                }}
              >
                {eyebrow}
              </motion.div>
            )}
            <motion.h1
              className={`${VARIANT_TITLE_CLASS[variant]} tracking-[-0.025em]`}
              style={{
                color: tokens.text.primary,
              }}
              variants={reduceMotion ? {} : {
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } },
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
                  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } },
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
            visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } },
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
              <BrainMark size={variant === "hero" ? "md" : "sm"} />
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
