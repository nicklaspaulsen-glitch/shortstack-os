"use client";

/**
 * PageHero3D — Apr 28 v11 redesign.
 *
 * User: "make custom icons instead of emojis... custom colors to match
 * the theme... black or white theme color".
 *
 * v8/v9/v10 used Microsoft Fluent Emoji 3D PNGs. They were
 * professionally rendered but **always full-color** — red heart, gold
 * key, multi-color robot. Couldn't theme them. The user wants
 * brand-aligned monochromatic icons that flip with the active theme.
 *
 * v11 swap: **Solar Bold-Duotone** — same icon family already used in
 * the sidebar. Bold-Duotone is a two-tone treatment (chunky filled
 * primary glyph + lighter inner accent). Inherits `currentColor` so
 * we can drive the color from a parent CSS class — `text-brand-accent`
 * gives us teal in BOTH themes (teal-600 on white, teal-400 on dark).
 *
 * Plus a CSS extrusion stack (multiple stacked drop-shadows in
 * teal-darkened tints) to give the flat SVG a 3D-feeling depth without
 * a raster image. Static idle + tiny hover lift.
 */

import { Icon, type IconifyIcon } from "@iconify/react";
import { useEffect, useState } from "react";

// Section-hub themes
import salesIcon from "@iconify-icons/solar/dollar-bold-duotone";
import createIcon from "@iconify-icons/solar/pen-new-square-bold-duotone";
import visualIcon from "@iconify-icons/solar/palette-bold-duotone";
import automateIcon from "@iconify-icons/solar/bolt-bold-duotone";
import manageIcon from "@iconify-icons/solar/buildings-2-bold-duotone";
import connectIcon from "@iconify-icons/solar/link-bold-duotone";

// Domain themes
import aiIcon from "@iconify-icons/solar/cpu-bolt-bold-duotone";
import voiceIcon from "@iconify-icons/solar/microphone-large-bold-duotone";
import analyticsIcon from "@iconify-icons/solar/chart-2-bold-duotone";
import leadsIcon from "@iconify-icons/solar/magnet-bold-duotone";
import inboxIcon from "@iconify-icons/solar/inbox-bold-duotone";

// Sidebar-icon-matched themes
import phoneIcon from "@iconify-icons/solar/phone-calling-bold-duotone";
import micIcon from "@iconify-icons/solar/microphone-large-bold-duotone";
import calendarIcon from "@iconify-icons/solar/calendar-bold-duotone";
import mailIcon from "@iconify-icons/solar/letter-bold-duotone";
import searchIcon from "@iconify-icons/solar/magnifer-bold-duotone";
import settingsIcon from "@iconify-icons/solar/settings-bold-duotone";
import bellIcon from "@iconify-icons/solar/bell-bold-duotone";
import crownIcon from "@iconify-icons/solar/crown-star-bold-duotone";
import botIcon from "@iconify-icons/solar/cpu-bolt-bold-duotone";
import globeIcon from "@iconify-icons/solar/global-bold-duotone";
import heartIcon from "@iconify-icons/solar/heart-bold-duotone";
import starIcon from "@iconify-icons/solar/star-bold-duotone";
import keyIcon from "@iconify-icons/solar/key-square-bold-duotone";
import shieldIcon from "@iconify-icons/solar/shield-check-bold-duotone";
import targetIcon from "@iconify-icons/solar/target-bold-duotone";
import briefcaseIcon from "@iconify-icons/solar/case-bold-duotone";
import headphonesIcon from "@iconify-icons/solar/headphones-round-sound-bold-duotone";

// Bonus themes
import rocketIcon from "@iconify-icons/solar/rocket-bold-duotone";
// Solar doesn't have a "gem" icon — use crown-star as a similar
// premium / valuable-thing glyph. (Apr 28 v11.)
import gemIcon from "@iconify-icons/solar/crown-star-bold-duotone";
import fireIcon from "@iconify-icons/solar/fire-bold-duotone";
import trophyIcon from "@iconify-icons/solar/cup-bold-duotone";
import cardIcon from "@iconify-icons/solar/card-2-bold-duotone";
import chartIcon from "@iconify-icons/solar/graph-up-bold-duotone";
import brainIcon from "@iconify-icons/solar/cpu-bold-duotone";
import penIcon from "@iconify-icons/solar/pen-bold-duotone";
import cameraIcon from "@iconify-icons/solar/camera-bold-duotone";
import filmIcon from "@iconify-icons/solar/video-frame-bold-duotone";
import buildingIcon from "@iconify-icons/solar/buildings-3-bold-duotone";
import receiptIcon from "@iconify-icons/solar/bill-list-bold-duotone";
import invoiceIcon from "@iconify-icons/solar/document-text-bold-duotone";
import zapIcon from "@iconify-icons/solar/bolt-bold-duotone";
import cogIcon from "@iconify-icons/solar/settings-bold-duotone";
import pinIcon from "@iconify-icons/solar/pin-bold-duotone";
import lockIcon from "@iconify-icons/solar/lock-bold-duotone";
import downloadIcon from "@iconify-icons/solar/download-bold-duotone";

// Fallback
import defaultIcon from "@iconify-icons/solar/magic-stick-3-bold-duotone";

export type PageHero3DTheme =
  | "sales" | "create" | "visual" | "automate" | "manage" | "connect"
  | "ai" | "voice" | "analytics" | "leads" | "inbox"
  | "phone" | "mic" | "calendar" | "mail" | "search" | "settings"
  | "bell" | "crown" | "bot" | "globe" | "heart" | "star" | "key"
  | "shield" | "target" | "briefcase" | "headphones"
  | "rocket" | "gem" | "fire" | "trophy" | "card" | "chart" | "brain"
  | "pen" | "camera" | "film" | "building" | "receipt" | "invoice"
  | "zap" | "cog" | "pin" | "lock" | "download"
  | "default";

const THEME_TO_ICON: Record<PageHero3DTheme, IconifyIcon> = {
  sales: salesIcon,
  create: createIcon,
  visual: visualIcon,
  automate: automateIcon,
  manage: manageIcon,
  connect: connectIcon,
  ai: aiIcon,
  voice: voiceIcon,
  analytics: analyticsIcon,
  leads: leadsIcon,
  inbox: inboxIcon,
  phone: phoneIcon,
  mic: micIcon,
  calendar: calendarIcon,
  mail: mailIcon,
  search: searchIcon,
  settings: settingsIcon,
  bell: bellIcon,
  crown: crownIcon,
  bot: botIcon,
  globe: globeIcon,
  heart: heartIcon,
  star: starIcon,
  key: keyIcon,
  shield: shieldIcon,
  target: targetIcon,
  briefcase: briefcaseIcon,
  headphones: headphonesIcon,
  rocket: rocketIcon,
  gem: gemIcon,
  fire: fireIcon,
  trophy: trophyIcon,
  card: cardIcon,
  chart: chartIcon,
  brain: brainIcon,
  pen: penIcon,
  camera: cameraIcon,
  film: filmIcon,
  building: buildingIcon,
  receipt: receiptIcon,
  invoice: invoiceIcon,
  zap: zapIcon,
  cog: cogIcon,
  pin: pinIcon,
  lock: lockIcon,
  download: downloadIcon,
  default: defaultIcon,
};

export type PageHero3DSize = "sm" | "md" | "lg";

interface PageHero3DProps {
  theme?: PageHero3DTheme;
  size?: PageHero3DSize;
  className?: string;
  /** Animate hover/idle (default true). Pass false on static / print pages. */
  animate?: boolean;
}

const SIZE_PX: Record<PageHero3DSize, number> = {
  sm: 96,
  md: 140,
  lg: 200,
};

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduce;
}

export default function PageHero3D({
  theme = "default",
  size = "md",
  className = "",
  animate = true,
}: PageHero3DProps) {
  const px = SIZE_PX[size];
  const reduce = usePrefersReducedMotion();
  const shouldAnimate = animate && !reduce;
  const icon = THEME_TO_ICON[theme] ?? defaultIcon;

  return (
    <span
      className={`hero-3d-icon inline-flex items-center justify-center text-brand-accent ${className}`}
      style={{ width: px, height: px }}
      aria-hidden="true"
    >
      <Icon
        icon={icon}
        width={px}
        height={px}
        className={shouldAnimate ? "hero-3d-icon-img" : ""}
        // currentColor inheritance — `text-brand-accent` on the parent
        // drives this. Light theme → teal-600. Dark theme → teal-400.
        style={{
          color: "currentColor",
          display: "block",
          width: "100%",
          height: "100%",
        }}
      />
    </span>
  );
}
