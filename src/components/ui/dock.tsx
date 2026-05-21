"use client";

/**
 * Dock — macOS-style magnification dock for ShortStack OS.
 *
 * Floats at the bottom centre of the dashboard viewport.
 * On mouse-over, items expand with spring-physics magnification
 * that falls off with distance from the cursor (exactly like macOS).
 *
 * Usage:
 *   <Dock items={dockItems} />
 *
 * Or drop the pre-configured <DashboardDock /> anywhere inside the
 * dashboard layout and it renders with the default shortcut set.
 */

import {
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
  type MotionValue,
} from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DockItem {
  /** Unique key */
  id: string;
  /** Tooltip label */
  label: string;
  /** Icon element (should render at ~20 px — the dock scales it via CSS) */
  icon: ReactNode;
  /** Navigation href */
  href: string;
  /** Optional: group separator before this item */
  separator?: boolean;
}

interface DockProps {
  items: DockItem[];
  /** Base icon size in px (default 48) */
  baseSize?: number;
  /** Max magnified icon size in px (default 80) */
  maxSize?: number;
  /** Magnification influence radius in px (default 140) */
  radius?: number;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPRING = { mass: 0.1, stiffness: 150, damping: 12 };
const TOOLTIP_VARIANTS = {
  hidden:  { opacity: 0, y: 4,  scale: 0.94 },
  visible: { opacity: 1, y: 0,  scale: 1,    transition: { duration: 0.14, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } },
  exit:    { opacity: 0, y: 4,  scale: 0.94, transition: { duration: 0.10 } },
};

// ---------------------------------------------------------------------------
// useDockMagnification — per-item hook
// ---------------------------------------------------------------------------

function useDockMagnification(
  mouseX: MotionValue<number>,
  itemRef: React.RefObject<HTMLDivElement | null>,
  baseSize: number,
  maxSize: number,
  radius: number,
) {
  // Distance from the mouse → 0 = on top of item, large = far away
  const distance = useTransform(mouseX, (val) => {
    const el = itemRef.current;
    if (!el) return radius + 1; // outside radius
    const rect = el.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    return Math.abs(val - center);
  });

  // Scale: 1.0 at `radius` distance, maxSize/baseSize at 0 distance
  const scaleRaw = useTransform(
    distance,
    [0, radius],
    [maxSize / baseSize, 1],
    { clamp: true },
  );

  const scale = useSpring(scaleRaw, SPRING);

  return scale;
}

// ---------------------------------------------------------------------------
// DockIcon — single icon cell
// ---------------------------------------------------------------------------

interface DockIconProps {
  item: DockItem;
  mouseX: MotionValue<number>;
  baseSize: number;
  maxSize: number;
  radius: number;
  isActive: boolean;
}

function DockIcon({ item, mouseX, baseSize, maxSize, radius, isActive }: DockIconProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const scale = useDockMagnification(mouseX, ref, baseSize, maxSize, radius);
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative flex flex-col items-center" ref={ref}>
      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            variants={TOOLTIP_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "absolute bottom-[calc(100%+10px)] pointer-events-none",
              "whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] font-medium leading-none",
              "bg-[rgba(15,20,35,0.92)] text-[#E8E8F0] border border-[rgba(99,146,255,0.18)]",
              "shadow-[0_4px_16px_rgba(0,0,0,0.40)] backdrop-blur-[8px]",
            )}
          >
            {item.label}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Icon cell */}
      <motion.div
        style={{
          width:  baseSize,
          height: baseSize,
          scale,
          transformOrigin: "bottom center",
        }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        className="flex items-center justify-center shrink-0"
      >
        <Link
          href={item.href}
          aria-label={item.label}
          className={cn(
            "relative flex items-center justify-center w-full h-full rounded-[14px]",
            "transition-colors duration-150",
            "outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/60",
            isActive
              ? "bg-[rgba(212,255,0,0.22)] border border-[rgba(212,255,0,0.40)]"
              : "bg-[rgba(19,24,39,0.78)] border border-[rgba(255,255,255,0.09)] hover:bg-[rgba(28,36,58,0.88)] hover:border-[rgba(99,146,255,0.24)]",
            "shadow-[0_2px_12px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.07)]",
          )}
        >
          {/* Icon */}
          <span className={cn(
            "relative flex items-center justify-center",
            isActive ? "text-[#60A5FA]" : "text-[#8A8A9A]",
            "transition-colors duration-150 group-hover:text-[#C8C8D4]",
          )}
            style={{ fontSize: Math.round(baseSize * 0.42) }}
          >
            {item.icon}
          </span>

          {/* Active dot */}
          {isActive && (
            <span
              aria-hidden
              className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-[4px] h-[4px] rounded-full bg-[#3B82F6]"
              style={{ boxShadow: "0 0 6px rgba(212,255,0,0.80)" }}
            />
          )}
        </Link>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dock
// ---------------------------------------------------------------------------

export function Dock({
  items,
  baseSize = 48,
  maxSize  = 76,
  radius   = 130,
  className,
}: DockProps) {
  const pathname  = usePathname();
  const mouseX    = useMotionValue(Infinity);
  const dockRef   = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => mouseX.set(e.clientX),
    [mouseX],
  );
  const handleMouseLeave = useCallback(() => mouseX.set(Infinity), [mouseX]);

  // Gap between items scales with baseSize
  const gap = Math.round(baseSize * 0.17);

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
        "flex items-end",
        className,
      )}
      style={{ gap: gap }}
      ref={dockRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      role="navigation"
      aria-label="Quick navigation dock"
    >
      {/* Glass backing panel */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-[22px] pointer-events-none"
        style={{
          background: "rgba(13,17,32,0.82)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          border: "1px solid rgba(99,146,255,0.15)",
          boxShadow: [
            "0 1px 0 rgba(255,255,255,0.06) inset",
            "0 8px 32px rgba(0,0,0,0.50)",
            "0 0 0 1px rgba(0,0,0,0.30)",
          ].join(","),
          // Extend beyond the icons for padding
          inset: `-${Math.round(baseSize * 0.18)}px -${Math.round(baseSize * 0.25)}px`,
        }}
      />

      {items.map((item, i) => {
        const isActive = pathname
          ? item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href)
          : false;

        return (
          <div key={item.id} className="relative flex items-end" style={{ gap }}>
            {/* Separator — thin vertical rule */}
            {item.separator && i > 0 && (
              <div
                className="w-px self-stretch mx-1"
                style={{ background: "rgba(99,146,255,0.15)", marginBottom: 4 }}
              />
            )}
            <DockIcon
              item={item}
              mouseX={mouseX}
              baseSize={baseSize}
              maxSize={maxSize}
              radius={radius}
              isActive={isActive}
            />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DashboardDock — pre-configured with ShortStack OS routes
// ---------------------------------------------------------------------------

import {
  LayoutDashboard,
  BarChart3,
  Users,
  Sparkles,
  Video,
  Mic2,
  MessageSquare,
  Send,
  Globe,
  Bot,
} from "lucide-react";

const DOCK_ITEMS: DockItem[] = [
  {
    id: "home",
    label: "Dashboard",
    icon: <LayoutDashboard size="1em" />,
    href: "/dashboard",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: <BarChart3 size="1em" />,
    href: "/dashboard/analytics",
  },
  {
    id: "clients",
    label: "Clients",
    icon: <Users size="1em" />,
    href: "/dashboard/clients",
  },
  {
    id: "ai-studio",
    label: "AI Studio",
    icon: <Sparkles size="1em" />,
    href: "/dashboard/ai-studio",
    separator: true,
  },
  {
    id: "ai-video",
    label: "AI Video",
    icon: <Video size="1em" />,
    href: "/dashboard/ai-video",
  },
  {
    id: "voice-studio",
    label: "Voice Studio",
    icon: <Mic2 size="1em" />,
    href: "/dashboard/voice-studio",
  },
  {
    id: "conversations",
    label: "Conversations",
    icon: <MessageSquare size="1em" />,
    href: "/dashboard/conversations",
    separator: true,
  },
  {
    id: "outreach-hub",
    label: "Outreach Hub",
    icon: <Send size="1em" />,
    href: "/dashboard/outreach-hub",
  },
  {
    id: "websites",
    label: "Websites",
    icon: <Globe size="1em" />,
    href: "/dashboard/websites",
  },
  {
    id: "agent-office",
    label: "Agent Office",
    icon: <Bot size="1em" />,
    href: "/dashboard/agent-office",
    separator: true,
  },
];

export function DashboardDock({ className }: { className?: string }) {
  return <Dock items={DOCK_ITEMS} className={className} />;
}

export type { DockProps };
