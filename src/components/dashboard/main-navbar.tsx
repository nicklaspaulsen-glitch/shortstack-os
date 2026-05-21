"use client";

/**
 * MainNavbar — Aave-inspired glass navigation bar for ShortStack OS.
 *
 * Design notes (Framer research, May 17):
 *   • Full-bleed glass panel: backdrop-blur + SVG feTurbulence displacement
 *     creates an organic "frosted glass pane" texture (not flat blur).
 *   • Top-edge gradient highlight: 1px linear-gradient border reads as the
 *     physical edge of a glass surface catching ambient light.
 *   • Active icons: blue pill with radial glow + chromatic aberration ring
 *     (subtle RGB offset that reads as premium on OLED screens).
 *   • Section dropdowns: match glass treatment — same blur, same border.
 *   • Magnification on hover: icons subtly scale up toward cursor.
 */

import { useState, useRef, useEffect, useId } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  LayoutDashboard,
  Inbox,
  Users,
  BarChart3,
  Calendar,
  Database,
  ChevronDown,
  Menu,
  X,
  Search,
  Bell,
  Crown,
  Send,
  Mic,
  Sparkles,
  Globe,
  Film,
  Zap,
  FileText,
  MessagesSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";
import GlobalSearch from "@/components/global-search";
import Notifications from "@/components/notifications";
import ClientSwitcher from "@/components/client-switcher";
import { useAuth } from "@/lib/auth-context";

// ── Types ─────────────────────────────────────────────────────────────────
interface NavItem {
  label: string;
  href: string;
  Icon: LucideIcon;
}

interface SectionDef {
  key: string;
  label: string;
  Icon: LucideIcon;
  items: NavItem[];
}

// ── Core items (always-visible icon circles) ──────────────────────────────
const CORE_ITEMS: NavItem[] = [
  { label: "Dashboard",  href: "/dashboard",           Icon: LayoutDashboard },
  { label: "Inbox",      href: "/dashboard/inbox",     Icon: Inbox           },
  { label: "Clients",    href: "/dashboard/clients",   Icon: Users           },
  { label: "Analytics",  href: "/dashboard/analytics", Icon: BarChart3       },
  { label: "Calendar",   href: "/dashboard/calendar",  Icon: Calendar        },
  { label: "CRM",        href: "/dashboard/crm",       Icon: Database        },
];

// ── Section definitions ───────────────────────────────────────────────────
const SECTIONS: SectionDef[] = [
  {
    key: "sales", label: "Sales", Icon: Send,
    items: [
      { label: "Outreach",      href: "/dashboard/outreach-hub",   Icon: Send          },
      { label: "Lead Finder",   href: "/dashboard/scraper",        Icon: Search        },
      { label: "Cold Email",    href: "/dashboard/cold-email",     Icon: Inbox         },
      { label: "Conversations", href: "/dashboard/conversations",  Icon: MessagesSquare },
      { label: "Leads",         href: "/dashboard/leads",          Icon: Users         },
      { label: "Voice Studio",  href: "/dashboard/voice-studio",   Icon: Mic           },
      { label: "Trinity",       href: "/dashboard/trinity",        Icon: Sparkles      },
    ],
  },
  {
    key: "create", label: "Create", Icon: Sparkles,
    items: [
      { label: "AI Writer",   href: "/dashboard/copywriter",        Icon: FileText  },
      { label: "Script Lab",  href: "/dashboard/script-lab",        Icon: Sparkles  },
      { label: "Social Mgr",  href: "/dashboard/social-manager",    Icon: Globe     },
      { label: "Brand Kit",   href: "/dashboard/brand-kit",         Icon: Sparkles  },
      { label: "Websites",    href: "/dashboard/websites",          Icon: Globe     },
    ],
  },
  {
    key: "visual", label: "Visual", Icon: Film,
    items: [
      { label: "Video Editor", href: "/dashboard/video-editor",          Icon: Film     },
      { label: "AI Video",     href: "/dashboard/ai-video",              Icon: Film     },
      { label: "Thumbnails",   href: "/dashboard/thumbnail-generator",   Icon: Sparkles },
      { label: "AI Studio",    href: "/dashboard/ai-studio",             Icon: Sparkles },
    ],
  },
  {
    key: "automate", label: "Automate", Icon: Zap,
    items: [
      { label: "AI Agents",    href: "/dashboard/services",          Icon: Sparkles },
      { label: "Workflows",    href: "/dashboard/workflows",         Icon: Zap      },
      { label: "Agent Office", href: "/dashboard/agent-office",      Icon: Users    },
      { label: "Automations",  href: "/dashboard/automations",       Icon: Zap      },
    ],
  },
  {
    key: "manage", label: "Manage", Icon: Settings,
    items: [
      { label: "Team",         href: "/dashboard/team",             Icon: Users    },
      { label: "Invoices",     href: "/dashboard/invoices",         Icon: FileText },
      { label: "Integrations", href: "/dashboard/integrations-hub", Icon: Zap      },
      { label: "Settings",     href: "/dashboard/settings",         Icon: Settings },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────
function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

function isSectionActive(section: SectionDef, pathname: string): boolean {
  return section.items.some((item) => isActive(item.href, pathname));
}

// ── SVG turbulence glass filter — Aave glass texture signature ────────────
function GlassFilter({ id }: { id: string }) {
  return (
    <svg width={0} height={0} style={{ position: "absolute", pointerEvents: "none" }} aria-hidden>
      <defs>
        <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65 0.65"
            numOctaves="3"
            seed="2"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="1.2"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced"
          />
          <feComposite in="displaced" in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}

// ── Magnifying icon circle ────────────────────────────────────────────────
function IconCircle({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="group relative flex flex-col items-center justify-center w-9 h-9 rounded-xl shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-[rgba(212,255,0,0.5)]"
      style={{
        background: active
          ? "rgba(212,255,0,0.16)"
          : "rgba(255,255,255,0.04)",
        border: active
          ? "1px solid rgba(212,255,0,0.30)"
          : "1px solid rgba(255,255,255,0.06)",
        boxShadow: active
          ? "0 0 0 1px rgba(212,255,0,0.12), 0 0 12px rgba(212,255,0,0.18), inset 0 1px 0 rgba(255,255,255,0.10)"
          : "inset 0 1px 0 rgba(255,255,255,0.04)",
        transition: "all 180ms cubic-bezier(0.32,0.72,0,1)",
      }}
    >
      {/* Chromatic aberration ring on active */}
      {active && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            background:
              "conic-gradient(from 180deg, rgba(212,255,0,0) 0%, rgba(212,255,0,0.35) 25%, rgba(212,255,0,0) 50%, rgba(212,255,0,0.18) 75%, rgba(212,255,0,0) 100%)",
            animation: "conicSpin 3s linear infinite",
            opacity: 0.5,
          }}
        />
      )}
      <Icon
        size={16}
        aria-hidden
        style={{
          color: active ? "#60A5FA" : "#6B7280",
          transition: "color 150ms, filter 150ms",
          filter: active ? "drop-shadow(0 0 4px rgba(96,165,250,0.60))" : "none",
        }}
        className={!active ? "group-hover:!text-[#A8A8B2]" : ""}
      />
      {/* Active dot */}
      {active && (
        <span
          aria-hidden
          className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
          style={{ background: "#D4FF00", boxShadow: "0 0 4px rgba(212,255,0,0.80)" }}
        />
      )}
      {/* Tooltip */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 z-50"
        style={{
          transition: "opacity 120ms",
          background: "rgba(10,13,24,0.96)",
          color: "#A8A8B2",
          border: "1px solid rgba(99,146,255,0.12)",
          backdropFilter: "blur(12px)",
        }}
      >
        {label}
      </span>
    </Link>
  );
}

// ── SectionDropdown ───────────────────────────────────────────────────────
function SectionDropdown({
  section,
  pathname,
}: {
  section: SectionDef;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = isSectionActive(section, pathname);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium outline-none focus-visible:ring-1 focus-visible:ring-[rgba(212,255,0,0.5)] cursor-pointer"
        style={{
          background: active
            ? "rgba(212,255,0,0.12)"
            : open
            ? "rgba(255,255,255,0.07)"
            : "rgba(255,255,255,0.04)",
          border: active
            ? "1px solid rgba(212,255,0,0.22)"
            : "1px solid rgba(255,255,255,0.06)",
          color: active ? "#60A5FA" : open ? "#C8C8D4" : "#7A7F9A",
          boxShadow: active
            ? "0 0 8px rgba(212,255,0,0.10), inset 0 1px 0 rgba(255,255,255,0.08)"
            : "inset 0 1px 0 rgba(255,255,255,0.04)",
          transition: "all 150ms cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        <section.Icon size={12} aria-hidden />
        <span>{section.label}</span>
        <ChevronDown
          size={10}
          aria-hidden
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms cubic-bezier(0.32,0.72,0,1)",
          }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.14, ease: [0.32, 0.72, 0, 1] }}
            role="menu"
            aria-label={`${section.label} pages`}
            className="absolute top-full left-0 mt-2 min-w-[210px] rounded-2xl p-1.5 z-50"
            style={{
              background: "rgba(10,13,24,0.92)",
              backdropFilter: "blur(28px) saturate(200%)",
              WebkitBackdropFilter: "blur(28px) saturate(200%)",
              /* top gradient highlight — glass edge */
              borderTop: "1px solid rgba(255,255,255,0.12)",
              borderRight: "1px solid rgba(99,146,255,0.08)",
              borderBottom: "1px solid rgba(99,146,255,0.08)",
              borderLeft: "1px solid rgba(99,146,255,0.08)",
              boxShadow:
                "0 8px 40px rgba(0,0,0,0.50), 0 0 0 1px rgba(99,146,255,0.08), " +
                "inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {section.items.map((item) => {
              const itemActive = isActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  role="menuitem"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] group outline-none focus-visible:ring-1 focus-visible:ring-[rgba(212,255,0,0.5)]"
                  style={{
                    background: itemActive ? "rgba(212,255,0,0.12)" : "transparent",
                    color: itemActive ? "#60A5FA" : "#8A8FA8",
                    transition: "all 120ms",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    if (!itemActive) el.style.background = "rgba(255,255,255,0.05)";
                    el.style.color = itemActive ? "#60A5FA" : "#C8C8D4";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = itemActive ? "rgba(212,255,0,0.12)" : "transparent";
                    el.style.color = itemActive ? "#60A5FA" : "#8A8FA8";
                  }}
                >
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-lg shrink-0"
                    style={{
                      background: itemActive
                        ? "rgba(212,255,0,0.20)"
                        : "rgba(255,255,255,0.05)",
                      border: itemActive
                        ? "1px solid rgba(212,255,0,0.25)"
                        : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <item.Icon
                      size={11}
                      aria-hidden
                      style={{ color: itemActive ? "#60A5FA" : "#4A4A5A" }}
                    />
                  </span>
                  {item.label}
                  {itemActive && (
                    <span
                      aria-hidden
                      className="ml-auto w-1 h-1 rounded-full shrink-0"
                      style={{ background: "#D4FF00", boxShadow: "0 0 4px rgba(212,255,0,0.70)" }}
                    />
                  )}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Mobile drawer ─────────────────────────────────────────────────────────
function MobileDrawer({
  open,
  onClose,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
            className="fixed top-0 left-0 bottom-0 z-50 w-72 overflow-y-auto"
            style={{
              background: "rgba(8,11,20,0.97)",
              backdropFilter: "blur(28px)",
              borderRight: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-4 border-b"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              <span className="text-[13px] font-semibold text-[#F0F0F4]">ShortStack OS</span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#4A4A5A] hover:text-[#A8A8B2] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>

            {/* Core items */}
            <div className="px-3 pt-3 pb-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#4A4A5A] px-2 mb-1.5">
                Core
              </p>
              {CORE_ITEMS.map((item) => {
                const active = isActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5"
                    style={{
                      background: active ? "rgba(212,255,0,0.12)" : "transparent",
                      color: active ? "#60A5FA" : "#7A7F9A",
                      transition: "all 120ms",
                    }}
                  >
                    <span
                      className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
                      style={{
                        background: active
                          ? "rgba(212,255,0,0.18)"
                          : "rgba(255,255,255,0.04)",
                        border: active
                          ? "1px solid rgba(212,255,0,0.22)"
                          : "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <item.Icon size={14} aria-hidden />
                    </span>
                    <span className="text-[13px] font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Sections */}
            {SECTIONS.map((section) => {
              const sectionActive = isSectionActive(section, pathname);
              return (
                <div key={section.key} className="px-3 py-2">
                  <p
                    className="text-[9px] font-semibold uppercase tracking-[0.14em] px-2 mb-1.5"
                    style={{ color: sectionActive ? "#60A5FA" : "#4A4A5A" }}
                  >
                    {section.label}
                  </p>
                  {section.items.map((item) => {
                    const active = isActive(item.href, pathname);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl mb-0.5"
                        style={{
                          background: active ? "rgba(212,255,0,0.12)" : "transparent",
                          color: active ? "#60A5FA" : "#7A7F9A",
                          transition: "all 120ms",
                        }}
                      >
                        <span
                          className="flex items-center justify-center w-6 h-6 rounded-lg shrink-0"
                          style={{
                            background: active
                              ? "rgba(212,255,0,0.16)"
                              : "rgba(255,255,255,0.04)",
                          }}
                        >
                          <item.Icon size={12} aria-hidden />
                        </span>
                        <span className="text-[12px]">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Plan badge ─────────────────────────────────────────────────────────────
function PlanBadge({
  planTier,
  customLabel,
}: {
  planTier?: string;
  customLabel?: string;
}) {
  const label = customLabel || planTier;
  if (!label) return null;
  const isFounder = label === "Founder";
  return (
    <span
      className="hidden md:flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: isFounder ? "rgba(245,158,11,0.10)" : "rgba(212,255,0,0.10)",
        color: isFounder ? "#F59E0B" : "#60A5FA",
        border: `1px solid ${isFounder ? "rgba(245,158,11,0.18)" : "rgba(212,255,0,0.18)"}`,
      }}
    >
      {isFounder && <Crown size={9} aria-hidden />}
      {label}
    </span>
  );
}

// ── Logo mark ──────────────────────────────────────────────────────────────
function NavLogo() {
  return (
    <Link
      href="/dashboard"
      className="hidden lg:flex items-center gap-2 shrink-0 mr-1 group outline-none focus-visible:ring-1 focus-visible:ring-[rgba(212,255,0,0.6)] rounded-xl"
      aria-label="ShortStack Dashboard"
    >
      <span
        className="relative flex items-center justify-center w-8 h-8 rounded-xl text-[#020711] font-bold text-[12px] font-display overflow-hidden shrink-0"
        style={{
          background:
            "linear-gradient(135deg, #D4FF00 0%, #AACC00 60%, #88AA00 100%)",
          boxShadow:
            "0 0 0 1px rgba(212,255,0,0.30), 0 2px 10px rgba(212,255,0,0.40), inset 0 1px 0 rgba(255,255,255,0.18)",
          transition: "box-shadow 200ms, transform 200ms",
        }}
      >
        {/* Inner shimmer sweep */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl metal-sheen-sweep opacity-60"
        />
        S
      </span>
      <span className="text-[13px] font-semibold text-[#B0B8CC] hidden xl:block group-hover:text-[#E0E4F0] transition-colors duration-150">
        ShortStack
      </span>
    </Link>
  );
}

// ── MainNavbar ─────────────────────────────────────────────────────────────
export default function MainNavbar() {
  const pathname      = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile }   = useAuth();
  const filterId      = useId().replace(/:/g, "");

  return (
    <>
      {/* Inline SVG filter — loaded once, referenced by id */}
      <GlassFilter id={`glass-${filterId}`} />

      {/* ── Fixed glass bar ────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center px-3 gap-2"
        style={{
          height: 56,
          background: "rgba(8,11,20,0.78)",
          backdropFilter: "blur(24px) saturate(200%)",
          WebkitBackdropFilter: "blur(24px) saturate(200%)",
          /* Glass edge: strong white highlight on top, subtle on sides */
          borderTop: "1px solid rgba(255,255,255,0.10)",
          borderBottom: "1px solid rgba(99,146,255,0.08)",
          /* Layered shadow: thin ambient + deeper glow */
          boxShadow:
            "0 1px 0 rgba(99,146,255,0.06), " +
            "0 4px 24px rgba(0,0,0,0.40), " +
            "0 0 0 1px rgba(255,255,255,0.04) inset",
        }}
      >
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl text-[#7A7F9A] hover:text-[#C8C8D4] shrink-0 outline-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            transition: "all 150ms",
          }}
          aria-label="Open navigation"
        >
          <Menu size={16} aria-hidden />
        </button>

        {/* Logo */}
        <NavLogo />

        {/* Divider */}
        <div
          className="hidden lg:block w-px h-5 shrink-0 mx-1"
          style={{
            background:
              "linear-gradient(to bottom, transparent, rgba(99,146,255,0.18), transparent)",
          }}
          aria-hidden
        />

        {/* Core icon circles */}
        <div className="hidden lg:flex items-center gap-1">
          {CORE_ITEMS.map((item) => (
            <IconCircle
              key={item.href}
              href={item.href}
              label={item.label}
              Icon={item.Icon}
              active={isActive(item.href, pathname)}
            />
          ))}
        </div>

        {/* Divider */}
        <div
          className="hidden lg:block w-px h-5 shrink-0 mx-1"
          style={{
            background:
              "linear-gradient(to bottom, transparent, rgba(99,146,255,0.18), transparent)",
          }}
          aria-hidden
        />

        {/* Section dropdowns */}
        <nav className="hidden lg:flex items-center gap-0.5" aria-label="Section navigation">
          {SECTIONS.map((section) => (
            <SectionDropdown key={section.key} section={section} pathname={pathname} />
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action cluster */}
        <div className="flex items-center gap-1.5">
          {profile?.role === "admin" && (
            <PlanBadge
              planTier={(profile as { plan_tier?: string }).plan_tier ?? undefined}
              customLabel={
                (
                  (profile as { onboarding_preferences?: Record<string, unknown> })
                    .onboarding_preferences?.custom_plan_label
                ) as string | undefined
              }
            />
          )}
          <ClientSwitcher />
          <Notifications />
          <GlobalSearch />

          {/* User avatar */}
          <Link
            href="/dashboard/settings"
            title={
              (profile as { full_name?: string; nickname?: string } | null)?.full_name ||
              (profile as { full_name?: string; nickname?: string } | null)?.nickname ||
              "Settings"
            }
            className="shrink-0 rounded-full outline-none"
            style={{
              boxShadow: "0 0 0 1px rgba(99,146,255,0.18), 0 0 8px rgba(212,255,0,0.08)",
              transition: "box-shadow 200ms",
            }}
          >
            {(profile as { avatar_url?: string } | null)?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={(profile as { avatar_url: string }).avatar_url}
                alt=""
                width={28}
                height={28}
                className="rounded-full object-cover w-7 h-7"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, rgba(212,255,0,0.20), rgba(37,99,235,0.10))",
                  border: "1px solid rgba(212,255,0,0.22)",
                }}
              >
                <span className="text-[#60A5FA] text-[10px] font-bold font-display leading-none">
                  {(
                    (profile as { nickname?: string; full_name?: string } | null)?.nickname ||
                    (profile as { nickname?: string; full_name?: string } | null)?.full_name
                  )
                    ?.charAt(0)
                    .toUpperCase() || "?"}
                </span>
              </div>
            )}
          </Link>
        </div>
      </header>

      {/* Mobile drawer */}
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} pathname={pathname} />
    </>
  );
}
