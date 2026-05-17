"use client";

/**
 * 21st.dev Component Library — adapted for ShortStack OS
 *
 * Components sourced from 21st.dev community library and adapted
 * to ShortStack's OLED dark × Blue accent brand tokens.
 *
 * Exports:
 *   SpotlightCard      — hover-activated radial spotlight wrapper
 *   useSpotlight       — hook for composing spotlight into existing elements
 *   ActionSearchBar    — animated command-palette search with stagger results
 *   NetworkAnimation   — canvas particle network (agent office backdrop)
 *   PixelCursorTrail   — pixelated cursor trail overlay
 */

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  type HTMLAttributes,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── SpotlightCard ─────────────────────────────────────────────────────────
// Source: berkcangumusisik / 21st.dev — adapted with ShortStack blue accent.
// Drop-in wrapper. Gives any card a mouse-tracked radial spotlight on hover.

interface SpotlightCardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Spotlight color — defaults to ShortStack blue at 14% opacity */
  spotlightColor?: string;
}

export function SpotlightCard({
  children,
  className,
  spotlightColor = "rgba(59, 130, 246, 0.14)",
  ...props
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={cn("relative", className)}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`,
        }}
      />
      {children}
    </div>
  );
}

// ─── useSpotlight ──────────────────────────────────────────────────────────
// Hook for composing spotlight into existing motion.div / motion.button.
// Returns handlers to spread on the element + overlay to render inside.
//
// Usage:
//   const { handlers, overlay } = useSpotlight();
//   <motion.div {...handlers} className="relative overflow-hidden ...">
//     {overlay}
//     {children}
//   </motion.div>

export function useSpotlight(spotlightColor = "rgba(59, 130, 246, 0.14)") {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handlers = {
    onMouseMove: handleMouseMove,
    onMouseEnter: useCallback(() => setVisible(true), []),
    onMouseLeave: useCallback(() => setVisible(false), []),
  };

  const overlay = (
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-px rounded-[inherit] transition-opacity duration-300"
      style={{
        opacity: visible ? 1 : 0,
        background: `radial-gradient(520px circle at ${pos.x}px ${pos.y}px, ${spotlightColor}, transparent 40%)`,
      }}
    />
  );

  return { handlers, overlay };
}

// ─── ActionSearchBar ───────────────────────────────────────────────────────
// Source: 21st.dev — animated command-palette search bar.
// Shows staggered result items in a dropdown. Debounced at 140ms.

export interface SearchAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  tag?: string;
  onSelect?: () => void;
}

interface ActionSearchBarProps {
  actions: SearchAction[];
  placeholder?: string;
  className?: string;
  /** Called on every query change (for external filter state) */
  onSearch?: (query: string) => void;
}

const listVariants = {
  hidden: { opacity: 0, height: 0 },
  show: {
    opacity: 1,
    height: "auto",
    transition: {
      height: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
      staggerChildren: 0.04,
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: {
      height: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
      opacity: { duration: 0.14 },
    },
  },
};

const resultItemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.12 } },
};

export function ActionSearchBar({
  actions,
  placeholder = "Search...",
  className,
  onSearch,
}: ActionSearchBarProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 140);
    return () => clearTimeout(t);
  }, [query]);

  const filtered =
    debouncedQuery.trim().length > 0
      ? actions.filter(
          (a) =>
            a.label.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
            a.description?.toLowerCase().includes(debouncedQuery.toLowerCase()),
        )
      : [];

  const showDropdown = focused && filtered.length > 0;

  return (
    <div className={cn("relative", className)}>
      <div className="relative flex items-center">
        <svg
          className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          aria-label={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            onSearch?.(e.target.value);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 160)}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-xl border border-border-subtle bg-[rgba(19,24,39,0.80)]",
            "py-2 pl-9 pr-8 text-[12px] text-text-primary placeholder:text-text-muted",
            "outline-none transition-all duration-[220ms]",
            "focus:border-[rgba(59,130,246,0.38)] focus:bg-[rgba(19,24,39,0.95)]",
            "focus:shadow-[0_0_0_2px_rgba(59,130,246,0.10)]",
          )}
        />
        {query && (
          <button
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              onSearch?.("");
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 text-text-muted transition-colors hover:text-text-primary"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            role="listbox"
            variants={listVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border-subtle bg-[rgba(13,17,32,0.97)] shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <div className="p-1.5">
              {filtered.map((action) => (
                <motion.button
                  key={action.id}
                  role="option"
                  variants={resultItemVariants}
                  onClick={() => {
                    action.onSelect?.();
                    setQuery("");
                    setFocused(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.05]"
                >
                  {action.icon && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-accent/[0.12] text-brand-accent">
                      {action.icon}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[11.5px] font-semibold text-text-primary">{action.label}</span>
                    {action.description && (
                      <span className="truncate text-[9.5px] text-text-muted">{action.description}</span>
                    )}
                  </div>
                  {action.tag && (
                    <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[8px] text-text-muted">
                      {action.tag}
                    </span>
                  )}
                </motion.button>
              ))}
            </div>
            <div className="border-t border-border-subtle px-3 py-1.5">
              <span className="text-[9px] text-text-muted">
                {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── NetworkAnimation ──────────────────────────────────────────────────────
// Source: 21st.dev — canvas-based interactive particle network.
// Tracks mouse for gentle attraction; particles draw connecting lines.
// Adapted for ShortStack's OLED dark + blue accent.

interface NetworkAnimationProps {
  /** Max distance for line connections. Default: 140 */
  maxDistance?: number;
  /** Background fill color. Pass "transparent" to skip fill. */
  backgroundColor?: string;
  /** Particle RGBA prefix — no closing paren, e.g. "rgba(59,130,246," */
  particleColor?: string;
  /** Line RGBA prefix */
  lineColor?: string;
  /** Number of initial particles. Default: 55 */
  particleCount?: number;
  className?: string;
}

export function NetworkAnimation({
  maxDistance = 140,
  backgroundColor = "#020711",
  particleColor = "rgba(59,130,246,",
  lineColor = "rgba(99,146,255,",
  particleCount = 55,
  className,
}: NetworkAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // canvas.getContext("2d") always returns a context for a real canvas element.
    // TypeScript doesn't narrow the type across closures, so we assert here.
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    let animId: number;
    let W = canvas.offsetWidth;
    let H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    const mouse = { x: W / 2, y: H / 2 };

    type Particle = { x: number; y: number; vx: number; vy: number; r: number; alpha: number };

    function mkParticle(): Particle {
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.55,
        vy: (Math.random() - 0.5) * 0.55,
        r: Math.random() * 1.4 + 0.7,
        alpha: Math.random() * 0.45 + 0.25,
      };
    }

    const particles: Particle[] = Array.from({ length: particleCount }, mkParticle);

    function draw() {
      ctx.clearRect(0, 0, W, H);

      if (backgroundColor !== "transparent") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, W, H);
      }

      for (const p of particles) {
        // Gentle mouse pull
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 220 && dist > 0) {
          p.vx += (dx / dist) * 0.014;
          p.vy += (dy / dist) * 0.014;
        }

        // Speed cap
        const spd = Math.hypot(p.vx, p.vy);
        if (spd > 1.1) { p.vx *= 0.94; p.vy *= 0.94; }

        // Move + wrap
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;

        // Draw dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `${particleColor}${p.alpha})`;
        ctx.fill();
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < maxDistance) {
            const alpha = (1 - d / maxDistance) * 0.38;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `${lineColor}${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);

    const onMouseMove = (e: globalThis.MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const onResize = () => {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = W;
      canvas.height = H;
    };

    canvas.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
    };
  }, [backgroundColor, particleColor, lineColor, maxDistance, particleCount]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("block h-full w-full", className)}
      aria-hidden
    />
  );
}

// ─── PixelCursorTrail ──────────────────────────────────────────────────────
// Source: 21st.dev — pixelated squares that follow the cursor and fade out.
// Mounts a fixed overlay canvas over the whole viewport.

interface PixelCursorTrailProps {
  /** Pixel block size in px. Default: 10 */
  blockSize?: number;
  /** Max trail squares. Default: 30 */
  trailLength?: number;
  /** Hex color. Default: ShortStack blue accent */
  color?: string;
}

export function PixelCursorTrail({
  blockSize = 10,
  trailLength = 30,
  color = "#3B82F6",
}: PixelCursorTrailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    let animId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    type Square = { x: number; y: number; age: number };
    const squares: Square[] = [];

    // Parse hex once
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const FADE = 0.028;

    const onMouseMove = (e: globalThis.MouseEvent) => {
      const sx = Math.floor(e.clientX / blockSize) * blockSize;
      const sy = Math.floor(e.clientY / blockSize) * blockSize;
      if (squares.length === 0 || squares[0].x !== sx || squares[0].y !== sy) {
        squares.unshift({ x: sx, y: sy, age: 0 });
        if (squares.length > trailLength) squares.pop();
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const sq of squares) {
        sq.age += FADE;
        const alpha = Math.max(0, 1 - sq.age);
        const sz = blockSize * Math.max(0.25, 1 - sq.age * 0.65);
        const off = (blockSize - sz) / 2;
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.82})`;
        ctx.fillRect(sq.x + off, sq.y + off, sz, sz);
      }
      animId = requestAnimationFrame(draw);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", resize);
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", resize);
    };
  }, [blockSize, trailLength, color]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[9999]"
      aria-hidden
    />
  );
}
