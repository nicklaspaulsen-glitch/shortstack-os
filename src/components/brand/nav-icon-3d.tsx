"use client";

/**
 * NavIcon3D — sidebar icon renderer.
 *
 * Apr 28 v4: swap from lucide flat strokes to Solar Bold-Duotone glyphs.
 * Solar's bold-duotone variant is the closest free match to "real 3D
 * icon" appearance — each glyph is a chunky filled shape with a
 * lighter inner accent (the "duotone" layer), which combined with the
 * SVG specular filter from layout.tsx + the CSS extrusion stack from
 * globals.css produces a genuinely volumetric look.
 *
 * The component takes a Lucide-component-name string (because that's
 * what the existing navItems[] array stores) and renders the matching
 * Solar icon if known. Unknown names fall back to a generic stack icon.
 *
 * Adding a new icon:
 *   1. `import inboxIcon from '@iconify-icons/solar/inbox-bold-duotone';`
 *   2. add `Inbox: inboxIcon` to LUCIDE_TO_SOLAR below
 *
 * The icon imports are tree-shaken — only icons referenced here ship
 * in the bundle. Total cost ~1KB per icon, ~80KB for the full sidebar.
 */

import { Icon, type IconifyIcon } from "@iconify/react";

// Core / dashboard
import inboxIcon from "@iconify-icons/solar/inbox-bold-duotone";
import sparklesIcon from "@iconify-icons/solar/magic-stick-3-bold-duotone";
import dashboardIcon from "@iconify-icons/solar/widget-2-bold-duotone";
import usersIcon from "@iconify-icons/solar/users-group-rounded-bold-duotone";
import chartIcon from "@iconify-icons/solar/chart-2-bold-duotone";
import documentIcon from "@iconify-icons/solar/document-text-bold-duotone";
import bellIcon from "@iconify-icons/solar/bell-bold-duotone";
import settingsIcon from "@iconify-icons/solar/settings-bold-duotone";
import shieldIcon from "@iconify-icons/solar/shield-check-bold-duotone";
import activityIcon from "@iconify-icons/solar/pulse-2-bold-duotone";

// Sales / outreach
import sendIcon from "@iconify-icons/solar/plain-2-bold-duotone";
import searchIcon from "@iconify-icons/solar/magnifer-bold-duotone";
import phoneIcon from "@iconify-icons/solar/phone-calling-bold-duotone";
import headphonesIcon from "@iconify-icons/solar/headphones-round-sound-bold-duotone";
import micIcon from "@iconify-icons/solar/microphone-large-bold-duotone";
import messagesIcon from "@iconify-icons/solar/chat-round-line-bold-duotone";
import messageSquareIcon from "@iconify-icons/solar/chat-line-bold-duotone";
import awardIcon from "@iconify-icons/solar/medal-ribbon-star-bold-duotone";
import clipboardListIcon from "@iconify-icons/solar/clipboard-list-bold-duotone";
import clipboardCheckIcon from "@iconify-icons/solar/clipboard-check-bold-duotone";
import mailPlusIcon from "@iconify-icons/solar/letter-opened-bold-duotone";
import mailIcon from "@iconify-icons/solar/letter-bold-duotone";
import listOrderedIcon from "@iconify-icons/solar/list-bold-duotone";
import gitBranchIcon from "@iconify-icons/solar/programming-bold-duotone";
import layersIcon from "@iconify-icons/solar/layers-bold-duotone";
import creditCardIcon from "@iconify-icons/solar/card-2-bold-duotone";
import fileCheckIcon from "@iconify-icons/solar/file-check-bold-duotone";
import trendingUpIcon from "@iconify-icons/solar/graph-up-bold-duotone";
import targetIcon from "@iconify-icons/solar/target-bold-duotone";
import calendarIcon from "@iconify-icons/solar/calendar-bold-duotone";
import bookOpenIcon from "@iconify-icons/solar/book-bookmark-bold-duotone";
import briefcaseIcon from "@iconify-icons/solar/case-bold-duotone";

// Create / content
import penIcon from "@iconify-icons/solar/pen-bold-duotone";
import penToolIcon from "@iconify-icons/solar/pen-new-square-bold-duotone";
import smartphoneIcon from "@iconify-icons/solar/smartphone-bold-duotone";
import newspaperIcon from "@iconify-icons/solar/document-bold-duotone";
import paletteIcon from "@iconify-icons/solar/palette-bold-duotone";
import folderOpenIcon from "@iconify-icons/solar/folder-open-bold-duotone";
import globeIcon from "@iconify-icons/solar/global-bold-duotone";
import globe2Icon from "@iconify-icons/solar/planet-bold-duotone";
import layoutTemplateIcon from "@iconify-icons/solar/widget-5-bold-duotone";
import flaskIcon from "@iconify-icons/solar/test-tube-bold-duotone";
import shareIcon from "@iconify-icons/solar/share-bold-duotone";

// Visual
import imageIcon from "@iconify-icons/solar/gallery-bold-duotone";
import filmIcon from "@iconify-icons/solar/clapperboard-edit-bold-duotone";

// Automate
import zapIcon from "@iconify-icons/solar/bolt-bold-duotone";
import crownIcon from "@iconify-icons/solar/crown-star-bold-duotone";
import usersRoundIcon from "@iconify-icons/solar/users-group-two-rounded-bold-duotone";
import slidersIcon from "@iconify-icons/solar/tuning-2-bold-duotone";
import monitorIcon from "@iconify-icons/solar/monitor-bold-duotone";
import rotateIcon from "@iconify-icons/solar/restart-circle-bold-duotone";
import webhookIcon from "@iconify-icons/solar/code-square-bold-duotone";
import keyIcon from "@iconify-icons/solar/key-square-bold-duotone";
import botIcon from "@iconify-icons/solar/cpu-bolt-bold-duotone";

// Workspace / Manage
import kanbanIcon from "@iconify-icons/solar/clipboard-text-bold-duotone";
import layoutGridIcon from "@iconify-icons/solar/widget-4-bold-duotone";
import building2Icon from "@iconify-icons/solar/buildings-2-bold-duotone";
import receiptIcon from "@iconify-icons/solar/bill-list-bold-duotone";
import dollarSignIcon from "@iconify-icons/solar/dollar-bold-duotone";
import heartIcon from "@iconify-icons/solar/heart-bold-duotone";
import starIcon from "@iconify-icons/solar/star-bold-duotone";
import lifeBuoyIcon from "@iconify-icons/solar/help-bold-duotone";
import giftIcon from "@iconify-icons/solar/gift-bold-duotone";
import calculatorIcon from "@iconify-icons/solar/calculator-minimalistic-bold-duotone";
import fileBarIcon from "@iconify-icons/solar/chart-square-bold-duotone";
import storeIcon from "@iconify-icons/solar/shop-2-bold-duotone";
import downloadIcon from "@iconify-icons/solar/download-bold-duotone";
import puzzleIcon from "@iconify-icons/solar/widget-3-bold-duotone";
import plugIcon from "@iconify-icons/solar/plug-circle-bold-duotone";
import linkIcon from "@iconify-icons/solar/link-bold-duotone";
import uploadIcon from "@iconify-icons/solar/cloud-upload-bold-duotone";

// Special
import homeIcon from "@iconify-icons/solar/home-2-bold-duotone";
import pinIcon from "@iconify-icons/solar/pin-bold-duotone";
import logOutIcon from "@iconify-icons/solar/logout-2-bold-duotone";
import xIcon from "@iconify-icons/solar/close-circle-bold-duotone";
import arrowUpRightIcon from "@iconify-icons/solar/arrow-right-up-bold-duotone";
import chevronLeftIcon from "@iconify-icons/solar/alt-arrow-left-bold-duotone";
import chevronDownIcon from "@iconify-icons/solar/alt-arrow-down-bold-duotone";

const LUCIDE_TO_SOLAR: Record<string, IconifyIcon> = {
  Inbox: inboxIcon,
  Sparkles: sparklesIcon,
  LayoutDashboard: dashboardIcon,
  Users: usersIcon,
  BarChart3: chartIcon,
  FileText: documentIcon,
  Bell: bellIcon,
  Settings: settingsIcon,
  ShieldCheck: shieldIcon,
  Activity: activityIcon,
  Send: sendIcon,
  Search: searchIcon,
  Phone: phoneIcon,
  Headphones: headphonesIcon,
  Mic: micIcon,
  MessagesSquare: messagesIcon,
  MessageSquare: messageSquareIcon,
  Award: awardIcon,
  ClipboardList: clipboardListIcon,
  ClipboardCheck: clipboardCheckIcon,
  MailPlus: mailPlusIcon,
  Mail: mailIcon,
  ListOrdered: listOrderedIcon,
  GitBranch: gitBranchIcon,
  Layers: layersIcon,
  CreditCard: creditCardIcon,
  FileCheck: fileCheckIcon,
  TrendingUp: trendingUpIcon,
  Target: targetIcon,
  Calendar: calendarIcon,
  BookOpen: bookOpenIcon,
  Briefcase: briefcaseIcon,
  Pen: penIcon,
  PenTool: penToolIcon,
  Smartphone: smartphoneIcon,
  Newspaper: newspaperIcon,
  Palette: paletteIcon,
  FolderOpen: folderOpenIcon,
  Globe: globeIcon,
  Globe2: globe2Icon,
  LayoutTemplate: layoutTemplateIcon,
  FlaskConical: flaskIcon,
  Share2: shareIcon,
  ImageIcon: imageIcon,
  Film: filmIcon,
  Zap: zapIcon,
  Crown: crownIcon,
  UsersRound: usersRoundIcon,
  SlidersHorizontal: slidersIcon,
  Monitor: monitorIcon,
  RotateCcw: rotateIcon,
  Webhook: webhookIcon,
  Key: keyIcon,
  Bot: botIcon,
  Kanban: kanbanIcon,
  LayoutGrid: layoutGridIcon,
  Building2: building2Icon,
  Receipt: receiptIcon,
  DollarSign: dollarSignIcon,
  Heart: heartIcon,
  Star: starIcon,
  LifeBuoy: lifeBuoyIcon,
  Gift: giftIcon,
  Calculator: calculatorIcon,
  FileBarChart2: fileBarIcon,
  Store: storeIcon,
  Download: downloadIcon,
  Puzzle: puzzleIcon,
  Plug: plugIcon,
  Link2: linkIcon,
  Upload: uploadIcon,
  Home: homeIcon,
  Pin: pinIcon,
  LogOut: logOutIcon,
  X: xIcon,
  ArrowUpRight: arrowUpRightIcon,
  ChevronLeft: chevronLeftIcon,
  ChevronDown: chevronDownIcon,
};

export interface NavIcon3DProps {
  /** Lucide component name (e.g. "Inbox") — keeps existing navItems[] format. */
  name: string;
  size?: number;
  className?: string;
}

/** Solar Bold-Duotone glyph keyed by Lucide name. Falls back to the
 *  layers icon when the name isn't mapped — visible reminder to add it. */
export default function NavIcon3D({ name, size = 16, className = "" }: NavIcon3DProps) {
  const icon = LUCIDE_TO_SOLAR[name] ?? layersIcon;
  return (
    <Icon
      icon={icon}
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    />
  );
}
