"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
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

// ── Types ────────────────────────────────────────────────────────────
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

// ── Core items (always-visible icon circles) ─────────────────────────
const CORE_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", Icon: LayoutDashboard },
  { label: "Inbox", href: "/dashboard/inbox", Icon: Inbox },
  { label: "Clients", href: "/dashboard/clients", Icon: Users },
  { label: "Analytics", href: "/dashboard/analytics", Icon: BarChart3 },
  { label: "Calendar", href: "/dashboard/calendar", Icon: Calendar },
  { label: "CRM", href: "/dashboard/crm", Icon: Database },
];

// ── Section definitions ──────────────────────────────────────────────
const SECTIONS: SectionDef[] = [
  {
    key: "sales",
    label: "Sales",
    Icon: Send,
    items: [
      { label: "Outreach", href: "/dashboard/outreach-hub", Icon: Send },
      { label: "Lead Finder", href: "/dashboard/scraper", Icon: Search },
      { label: "Cold Email", href: "/dashboard/cold-email", Icon: Inbox },
      { label: "Conversations", href: "/dashboard/conversations", Icon: MessagesSquare },
      { label: "Leads", href: "/dashboard/leads", Icon: Users },
      { label: "Deals", href: "/dashboard/deals", Icon: BarChart3 },
      { label: "Proposals", href: "/dashboard/proposals", Icon: FileText },
      { label: "Voice Studio", href: "/dashboard/voice-studio", Icon: Mic },
      { label: "Dialer", href: "/dashboard/dialer", Icon: Bell },
      { label: "Trinity", href: "/dashboard/trinity", Icon: Sparkles },
    ],
  },
  {
    key: "create",
    label: "Create",
    Icon: Sparkles,
    items: [
      { label: "AI Writer", href: "/dashboard/copywriter", Icon: FileText },
      { label: "Script Lab", href: "/dashboard/script-lab", Icon: Sparkles },
      { label: "Social Manager", href: "/dashboard/social-manager", Icon: Globe },
      { label: "Content Plan", href: "/dashboard/content-plan", Icon: Calendar },
      { label: "Brand Kit", href: "/dashboard/brand-kit", Icon: Sparkles },
      { label: "Websites", href: "/dashboard/websites", Icon: Globe },
      { label: "Intake Forms", href: "/dashboard/intake", Icon: FileText },
    ],
  },
  {
    key: "visual",
    label: "Visual",
    Icon: Film,
    items: [
      { label: "Video Editor", href: "/dashboard/video-editor", Icon: Film },
      { label: "AI Video", href: "/dashboard/ai-video", Icon: Film },
      { label: "Thumbnails", href: "/dashboard/thumbnail-generator", Icon: Sparkles },
      { label: "AI Studio", href: "/dashboard/ai-studio", Icon: Sparkles },
      { label: "Design Studio", href: "/dashboard/design-studio", Icon: Sparkles },
      { label: "Carousel Gen", href: "/dashboard/carousel-generator", Icon: Sparkles },
    ],
  },
  {
    key: "automate",
    label: "Automate",
    Icon: Zap,
    items: [
      { label: "AI Agents", href: "/dashboard/services", Icon: Sparkles },
      { label: "Workflows", href: "/dashboard/workflows", Icon: Zap },
      { label: "Agent Office", href: "/dashboard/agent-office", Icon: Users },
      { label: "Automations", href: "/dashboard/automations", Icon: Zap },
      { label: "Flow Builder", href: "/dashboard/workflow-builder", Icon: Zap },
    ],
  },
  {
    key: "manage",
    label: "Manage",
    Icon: Settings,
    items: [
      { label: "Team", href: "/dashboard/team", Icon: Users },
      { label: "Invoices", href: "/dashboard/invoices", Icon: FileText },
      { label: "Financials", href: "/dashboard/financials", Icon: BarChart3 },
      { label: "Reports", href: "/dashboard/reports", Icon: FileText },
      { label: "Integrations", href: "/dashboard/integrations-hub", Icon: Zap },
      { label: "Settings", href: "/dashboard/settings", Icon: Settings },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────
function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

function isSectionActive(section: SectionDef, pathname: string): boolean {
  return section.items.some((item) => isActive(item.href, pathname));
}

// ── IconCircle ───────────────────────────────────────────────────────
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
      className="relative group flex flex-col items-center justify-center w-9 h-9 rounded-xl transition-all duration-150 shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-[#3B82F6]/60"
      style={{
        background: active
          ? "rgba(59,130,246,0.14)"
          : "rgba(30,36,64,0.70)",
      }}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      <Icon
        size={17}
        className={
          active
            ? "text-[#60A5FA]"
            : "text-[#7A7F9A] group-hover:text-[#A8A8B2] transition-colors duration-100"
        }
        aria-hidden
      />
      {active && (
        <span
          className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#3B82F6]"
          aria-hidden
        />
      )}
      {/* Tooltip */}
      <span
        className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-100 z-50"
        style={{
          background: "rgba(13,17,32,0.96)",
          color: "#A8A8B2",
          border: "1px solid rgba(99,146,255,0.12)",
        }}
      >
        {label}
      </span>
    </Link>
  );
}

// ── SectionDropdown ──────────────────────────────────────────────────
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

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all duration-150 outline-none focus-visible:ring-1 focus-visible:ring-[#3B82F6]/60 cursor-pointer"
        style={{
          background: active
            ? "rgba(59,130,246,0.14)"
            : open
            ? "rgba(30,36,64,0.90)"
            : "rgba(30,36,64,0.70)",
          color: active ? "#60A5FA" : "#7A7F9A",
        }}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <section.Icon
          size={13}
          className={active ? "text-[#60A5FA]" : "text-[#7A7F9A]"}
          aria-hidden
        />
        <span className={active ? "text-[#60A5FA]" : "text-[#A8A8B2]"}>
          {section.label}
        </span>
        <ChevronDown
          size={11}
          className={`transition-transform duration-200 ${
            open ? "rotate-180" : ""
          } ${active ? "text-[#60A5FA]" : "text-[#4A4A5A]"}`}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12, ease: [0.32, 0.72, 0, 1] }}
            className="absolute top-full left-0 mt-1.5 min-w-[200px] rounded-2xl p-1.5 z-50"
            style={{
              background: "rgba(13,17,32,0.96)",
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: "1px solid rgba(99,146,255,0.12)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.36), 0 0 0 1px rgba(99,146,255,0.06)",
            }}
            role="menu"
            aria-label={`${section.label} pages`}
          >
            {section.items.map((item) => {
              const itemActive = isActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  role="menuitem"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] transition-all duration-100 group outline-none focus-visible:ring-1 focus-visible:ring-[#3B82F6]/60"
                  style={{
                    background: itemActive
                      ? "rgba(59,130,246,0.12)"
                      : "transparent",
                    color: itemActive ? "#60A5FA" : "#7A7F9A",
                  }}
                  onMouseEnter={(e) => {
                    if (!itemActive)
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(30,36,64,0.80)";
                    (e.currentTarget as HTMLElement).style.color = itemActive
                      ? "#60A5FA"
                      : "#C8C8D4";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      itemActive ? "rgba(59,130,246,0.12)" : "transparent";
                    (e.currentTarget as HTMLElement).style.color = itemActive
                      ? "#60A5FA"
                      : "#7A7F9A";
                  }}
                >
                  {/* Mini icon circle */}
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-lg shrink-0"
                    style={{
                      background: itemActive
                        ? "rgba(59,130,246,0.20)"
                        : "rgba(30,36,64,0.80)",
                    }}
                  >
                    <item.Icon
                      size={12}
                      className={
                        itemActive ? "text-[#60A5FA]" : "text-[#4A4A5A]"
                      }
                      aria-hidden
                    />
                  </span>
                  {item.label}
                  {itemActive && (
                    <span className="ml-auto w-1 h-1 rounded-full bg-[#3B82F6] shrink-0" aria-hidden />
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

// ── MobileDrawer ─────────────────────────────────────────────────────
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
            className="fixed top-0 left-0 bottom-0 z-50 w-72 overflow-y-auto"
            style={{
              background: "rgba(10,13,24,0.97)",
              backdropFilter: "blur(24px)",
              borderRight: "1px solid rgba(99,146,255,0.10)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: "rgba(99,146,255,0.08)" }}>
              <span className="text-[13px] font-semibold text-[#F0F0F4]">Navigation</span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#4A4A5A] hover:text-[#A8A8B2] hover:bg-[rgba(30,36,64,0.70)] transition-colors"
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>

            {/* Core items */}
            <div className="px-3 pt-3 pb-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#4A4A5A] px-2 mb-1.5">Core</p>
              {CORE_ITEMS.map((item) => {
                const active = isActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-all duration-100"
                    style={{
                      background: active ? "rgba(59,130,246,0.14)" : "transparent",
                      color: active ? "#60A5FA" : "#7A7F9A",
                    }}
                  >
                    <span
                      className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
                      style={{ background: active ? "rgba(59,130,246,0.20)" : "rgba(30,36,64,0.70)" }}
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
                        className="flex items-center gap-3 px-3 py-2 rounded-xl mb-0.5 transition-all duration-100"
                        style={{
                          background: active ? "rgba(59,130,246,0.14)" : "transparent",
                          color: active ? "#60A5FA" : "#7A7F9A",
                        }}
                      >
                        <span
                          className="flex items-center justify-center w-6 h-6 rounded-lg shrink-0"
                          style={{ background: active ? "rgba(59,130,246,0.20)" : "rgba(30,36,64,0.60)" }}
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

// ── Plan badge ────────────────────────────────────────────────────────
function PlanBadge({ planTier, customLabel }: { planTier?: string; customLabel?: string }) {
  const label = customLabel || planTier;
  if (!label) return null;
  const isFounder = label === "Founder";
  return (
    <span
      className="hidden md:flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: isFounder
          ? "rgba(245,158,11,0.12)"
          : "rgba(59,130,246,0.10)",
        color: isFounder ? "#F59E0B" : "#60A5FA",
        border: `1px solid ${isFounder ? "rgba(245,158,11,0.20)" : "rgba(59,130,246,0.18)"}`,
      }}
    >
      {isFounder && <Crown size={9} aria-hidden />}
      {label}
    </span>
  );
}

// ── MainNavbar ────────────────────────────────────────────────────────
export default function MainNavbar() {
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile } = useAuth();

  return (
    <>
      {/* Fixed bar */}
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center px-3 gap-2"
        style={{
          height: 56,
          background: "rgba(10,13,24,0.92)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          borderBottom: "1px solid rgba(99,146,255,0.08)",
          boxShadow: "0 1px 0 rgba(99,146,255,0.04)",
        }}
      >
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl text-[#7A7F9A] hover:text-[#A8A8B2] transition-colors shrink-0"
          style={{ background: "rgba(30,36,64,0.70)" }}
          aria-label="Open navigation"
        >
          <Menu size={16} aria-hidden />
        </button>

        {/* Logo */}
        <Link
          href="/dashboard"
          className="hidden lg:flex items-center gap-2 shrink-0 mr-1 group"
          aria-label="ShortStack Dashboard"
        >
          <span
            className="flex items-center justify-center w-8 h-8 rounded-xl text-white font-bold text-[13px] font-display transition-all duration-150 group-hover:scale-105"
            style={{
              background: "linear-gradient(135deg, rgba(59,130,246,0.9) 0%, rgba(37,99,235,0.9) 100%)",
              boxShadow: "0 2px 8px rgba(59,130,246,0.30)",
            }}
          >
            S
          </span>
          <span className="text-[13px] font-semibold text-[#C8C8D4] hidden xl:block">
            ShortStack
          </span>
        </Link>

        {/* Divider */}
        <div
          className="hidden lg:block w-px h-5 shrink-0 mx-1"
          style={{ background: "rgba(99,146,255,0.12)" }}
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
          style={{ background: "rgba(99,146,255,0.12)" }}
          aria-hidden
        />

        {/* Section dropdowns */}
        <nav
          className="hidden lg:flex items-center gap-1"
          aria-label="Section navigation"
        >
          {SECTIONS.map((section) => (
            <SectionDropdown
              key={section.key}
              section={section}
              pathname={pathname}
            />
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action items */}
        <div className="flex items-center gap-1.5">
          {profile?.role === "admin" && (
            <PlanBadge
              planTier={(profile as { plan_tier?: string }).plan_tier || undefined}
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
              (profile as { full_name?: string; nickname?: string } | null)
                ?.full_name ||
              (profile as { full_name?: string; nickname?: string } | null)
                ?.nickname ||
              "Settings"
            }
            className="shrink-0 rounded-full ring-1 ring-black/10 hover:ring-[#3B82F6]/40 transition-all duration-200"
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
                style={{ background: "rgba(59,130,246,0.08)" }}
              >
                <span className="text-[#60A5FA] text-[10px] font-bold font-display leading-none">
                  {(
                    (profile as { nickname?: string; full_name?: string } | null)
                      ?.nickname ||
                    (profile as { nickname?: string; full_name?: string } | null)
                      ?.full_name
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
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        pathname={pathname}
      />
    </>
  );
}
