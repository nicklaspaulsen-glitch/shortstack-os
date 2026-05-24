"use client";

import React, { useState, useRef } from 'react';

// effects-os.tsx — visual effect primitives ported from effects.jsx
// Exports: GlowText, MomentumCard, SlideInButton

// ---------------------------------------------------------------------------
// GlowText — glowing text on hover
// ---------------------------------------------------------------------------

// Valid HTML element tags that accept style + mouse events
type GlowTag = 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div' | 'label';

export interface GlowTextProps {
  children: React.ReactNode;
  /** Glow + text color on hover. Defaults to chartreuse lime. */
  color?: string;
  /** Render element. Default "span". */
  as?: GlowTag;
  style?: React.CSSProperties;
  className?: string;
}

export function GlowText({
  children,
  color,
  as: As = 'span',
  style,
  className,
}: GlowTextProps) {
  const c = color ?? 'oklch(0.88 0.18 130)';

  const handleEnter: React.MouseEventHandler<HTMLElement> = (e) => {
    const el = e.currentTarget as HTMLElement;
    el.style.textShadow = `0 0 18px ${c}, 0 0 38px color-mix(in oklch, ${c}, transparent 50%)`;
    el.style.color = c;
  };

  const handleLeave: React.MouseEventHandler<HTMLElement> = (e) => {
    const el = e.currentTarget as HTMLElement;
    el.style.textShadow = 'none';
    el.style.color = '';
  };

  // Cast through unknown to satisfy the polymorphic element type union
  const El = As as unknown as React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
    onMouseEnter: React.MouseEventHandler<HTMLElement>;
    onMouseLeave: React.MouseEventHandler<HTMLElement>;
    children: React.ReactNode;
  }>;

  return (
    <El
      className={className}
      style={{
        transition: 'text-shadow .4s ease, color .3s ease, transform .25s ease',
        ...style,
      }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
    </El>
  );
}

// ---------------------------------------------------------------------------
// MomentumCard — 3D tilt card driven by cursor position with glare overlay
// ---------------------------------------------------------------------------

interface TiltState {
  rx: number;
  ry: number;
  gx: number;
  gy: number;
}

export interface MomentumCardProps {
  children: React.ReactNode;
  /** Maximum rotation in degrees. Default 12. */
  max?: number;
  /** Show radial glare overlay. Default true. */
  glare?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function MomentumCard({
  children,
  max = 12,
  glare = true,
  style,
  className,
}: MomentumCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<TiltState>({ rx: 0, ry: 0, gx: 50, gy: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setTilt({
      rx: -(y - 0.5) * 2 * max,
      ry: (x - 0.5) * 2 * max,
      gx: x * 100,
      gy: y * 100,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 50 });
  };

  const isNeutral = tilt.rx === 0 && tilt.ry === 0;

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: 1000,
        transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        transition: 'transform .35s cubic-bezier(.2,.85,.25,1.05)',
        transformStyle: 'preserve-3d',
        position: 'relative',
        ...style,
      }}
    >
      {children}
      {glare && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            pointerEvents: 'none',
            background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,.18), transparent 50%)`,
            mixBlendMode: 'screen',
            opacity: isNeutral ? 0 : 1,
            transition: 'opacity .3s ease',
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SlideInButton — button with an icon that slides in on hover
// ---------------------------------------------------------------------------

export interface SlideInButtonProps {
  children: React.ReactNode;
  /** Icon element shown on the left when hovered. */
  icon?: React.ReactNode;
  /** Apply primary button styling class. */
  primary?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  style?: React.CSSProperties;
  className?: string;
}

export function SlideInButton({
  children,
  icon,
  primary,
  onClick,
  style,
  className,
}: SlideInButtonProps) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      className={['btn', primary ? 'btn-primary' : '', className]
        .filter(Boolean)
        .join(' ')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        paddingLeft: hover ? 30 : 14,
        paddingRight: 14,
        transition: 'padding .35s cubic-bezier(.2,.85,.25,1.05)',
        ...style,
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: hover ? 10 : -16,
          opacity: hover ? 1 : 0,
          transition:
            'left .35s cubic-bezier(.2,.85,.25,1.05), opacity .25s ease',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        {icon}
      </span>
      <span>{children}</span>
    </button>
  );
}
