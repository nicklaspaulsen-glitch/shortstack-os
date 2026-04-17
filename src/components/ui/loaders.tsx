"use client";

/**
 * Loader library — 10 unique loading animations.
 * All pure CSS + SVG, no dependencies.
 * Use: <DotsPulse /> or <OrbitLoader size={60} color="gold" label="Loading..." />
 */

import { useEffect, useState } from "react";

export interface LoaderProps {
  size?: number;
  color?: string;
  label?: string;
  className?: string;
}

/* 1. DotsPulse — 3 dots scaling in sequence */
export function DotsPulse({ size = 40, color = "var(--gold, #C9A84C)", label, className = "" }: LoaderProps) {
  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div style={{ width: size, height: size / 3 }} className="inline-flex items-center gap-[6px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: size / 6,
              height: size / 6,
              background: color,
              animationDelay: `${i * 150}ms`,
            }}
            className="rounded-full ss-dot-pulse"
          />
        ))}
      </div>
      {label && <span className="text-[10px] text-muted">{label}</span>}
      <style jsx>{`
        @keyframes ssDotPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1.2); opacity: 1; }
        }
        .ss-dot-pulse { animation: ssDotPulse 1.1s ease-in-out infinite both; }
      `}</style>
    </div>
  );
}

/* 2. OrbitLoader — 3 dots orbiting center */
export function OrbitLoader({ size = 40, color = "var(--gold, #C9A84C)", label, className = "" }: LoaderProps) {
  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute inset-0 ss-orbit"
            style={{ animationDelay: `${i * -0.4}s` }}
          >
            <span
              className="absolute rounded-full"
              style={{
                width: size / 6,
                height: size / 6,
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
                background: color,
                boxShadow: `0 0 ${size / 5}px ${color}`,
              }}
            />
          </div>
        ))}
      </div>
      {label && <span className="text-[10px] text-muted">{label}</span>}
      <style jsx>{`
        @keyframes ssOrbit { to { transform: rotate(360deg); } }
        .ss-orbit { animation: ssOrbit 1.2s linear infinite; }
      `}</style>
    </div>
  );
}

/* 3. WaveBars — audio visualizer */
export function WaveBars({ size = 40, color = "var(--gold, #C9A84C)", label, className = "" }: LoaderProps) {
  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div className="inline-flex items-end gap-[3px]" style={{ height: size, width: size }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="rounded-sm ss-wave"
            style={{
              width: size / 8,
              background: color,
              animationDelay: `${i * 100}ms`,
              minHeight: 4,
            }}
          />
        ))}
      </div>
      {label && <span className="text-[10px] text-muted">{label}</span>}
      <style jsx>{`
        @keyframes ssWave {
          0%, 100% { height: 20%; opacity: 0.5; }
          50% { height: 100%; opacity: 1; }
        }
        .ss-wave { animation: ssWave 1s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

/* 4. InfinityLoader — figure-8 trail */
export function InfinityLoader({ size = 60, color = "var(--gold, #C9A84C)", label, className = "" }: LoaderProps) {
  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <svg width={size} height={size / 2} viewBox="0 0 100 50" style={{ overflow: "visible" }}>
        <path
          d="M 25 25 C 25 10, 45 10, 50 25 C 55 40, 75 40, 75 25 C 75 10, 55 10, 50 25 C 45 40, 25 40, 25 25 Z"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="150 150"
          strokeDashoffset="0"
          className="ss-infinity"
        />
      </svg>
      {label && <span className="text-[10px] text-muted">{label}</span>}
      <style jsx>{`
        @keyframes ssInfinity { to { stroke-dashoffset: -300; } }
        .ss-infinity { animation: ssInfinity 2s linear infinite; }
      `}</style>
    </div>
  );
}

/* 5. MorphShapes — shape morphing via border-radius */
export function MorphShapes({ size = 40, color = "var(--gold, #C9A84C)", label, className = "" }: LoaderProps) {
  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <span
        className="ss-morph"
        style={{ width: size, height: size, background: color }}
      />
      {label && <span className="text-[10px] text-muted">{label}</span>}
      <style jsx>{`
        @keyframes ssMorph {
          0%, 100% { border-radius: 10%; transform: rotate(0); }
          25% { border-radius: 50%; transform: rotate(90deg); }
          50% { border-radius: 10% 50%; transform: rotate(180deg); }
          75% { border-radius: 50% 10%; transform: rotate(270deg); }
        }
        .ss-morph {
          display: inline-block;
          animation: ssMorph 2.8s ease-in-out infinite;
          box-shadow: 0 0 20px currentColor;
        }
      `}</style>
    </div>
  );
}

/* 6. ParticleBurst — 8 particles radiating */
export function ParticleBurst({ size = 50, color = "var(--gold, #C9A84C)", label, className = "" }: LoaderProps) {
  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 ss-particle"
            style={{
              width: size / 10,
              height: size / 10,
              background: color,
              borderRadius: "50%",
              transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-${size / 3}px)`,
              animationDelay: `${i * 100}ms`,
            }}
          />
        ))}
        <span
          className="absolute left-1/2 top-1/2 rounded-full ss-particle-core"
          style={{
            width: size / 5,
            height: size / 5,
            background: color,
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>
      {label && <span className="text-[10px] text-muted">{label}</span>}
      <style jsx>{`
        @keyframes ssParticle {
          0% { opacity: 0; transform: translate(-50%, -50%) rotate(var(--r, 0deg)) translateY(-10%); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -50%) rotate(var(--r, 0deg)) translateY(-200%); }
        }
        @keyframes ssParticleCore {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.4); }
        }
        .ss-particle {
          animation: ssParticle 1.8s ease-in-out infinite;
          box-shadow: 0 0 6px currentColor;
        }
        .ss-particle-core {
          animation: ssParticleCore 1.8s ease-in-out infinite;
          box-shadow: 0 0 12px currentColor;
        }
      `}</style>
    </div>
  );
}

/* 7. TypewriterLoader — "Loading..." dots cycling */
export function TypewriterLoader({ prefix = "Loading", size = 14, color, className = "" }: LoaderProps & { prefix?: string }) {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);
  return (
    <span className={`inline-flex items-baseline ${className}`} style={{ fontSize: size, color: color || "inherit" }}>
      <span>{prefix}</span>
      <span className="inline-block min-w-[1.5em] text-left">{dots}</span>
    </span>
  );
}

/* 8. SphereLoader — rotating conic-gradient sphere */
export function SphereLoader({ size = 40, color = "var(--gold, #C9A84C)", label, className = "" }: LoaderProps) {
  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div
        className="ss-sphere rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(from 0deg, transparent 0deg, ${color} 180deg, transparent 360deg)`,
          boxShadow: `0 0 ${size / 2}px ${color}80, inset 0 0 ${size / 3}px rgba(0,0,0,0.3)`,
        }}
      />
      {label && <span className="text-[10px] text-muted">{label}</span>}
      <style jsx>{`
        @keyframes ssSphere { to { transform: rotate(360deg); } }
        .ss-sphere { animation: ssSphere 1.5s linear infinite; }
      `}</style>
    </div>
  );
}

/* 9. ScanLineLoader — horizontal line sweeping */
export function ScanLineLoader({ size = 100, color = "var(--gold, #C9A84C)", label, className = "" }: LoaderProps) {
  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div
        className="relative overflow-hidden rounded-lg border border-white/5"
        style={{ width: size, height: size * 0.4, background: "rgba(255,255,255,0.02)" }}
      >
        <span
          className="absolute left-0 right-0 h-[2px] ss-scanline"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      </div>
      {label && <span className="text-[10px] text-muted">{label}</span>}
      <style jsx>{`
        @keyframes ssScanLine {
          0%, 100% { top: 10%; }
          50% { top: calc(100% - 10%); }
        }
        .ss-scanline { animation: ssScanLine 1.8s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

/* 10. QuantumLoader — 3 concentric rotating circles */
export function QuantumLoader({ size = 50, color = "var(--gold, #C9A84C)", label, className = "" }: LoaderProps) {
  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute inset-0 rounded-full border-2 ss-quantum"
            style={{
              borderColor: "transparent",
              borderTopColor: color,
              borderRightColor: i === 1 ? color : "transparent",
              opacity: 1 - i * 0.25,
              transform: `scale(${1 - i * 0.2})`,
              animationDuration: `${1 + i * 0.6}s`,
              animationDirection: i % 2 === 0 ? "normal" : "reverse",
            }}
          />
        ))}
      </div>
      {label && <span className="text-[10px] text-muted">{label}</span>}
      <style jsx>{`
        @keyframes ssQuantum { to { transform: rotate(360deg) scale(var(--s, 1)); } }
        .ss-quantum { animation-name: ssQuantum; animation-timing-function: linear; animation-iteration-count: infinite; }
      `}</style>
    </div>
  );
}

/* Bonus: Shimmer skeleton */
export function Shimmer({ children, loading, className = "" }: { children: React.ReactNode; loading: boolean; className?: string }) {
  if (!loading) return <>{children}</>;
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="opacity-40">{children}</div>
      <span className="absolute inset-0 ss-shimmer" />
      <style jsx>{`
        @keyframes ssShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .ss-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          animation: ssShimmer 1.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

/* Full-screen loader (useful for page transitions) */
export function FullScreenLoader({ label = "Loading", variant = "quantum" }: { label?: string; variant?: "quantum" | "sphere" | "orbit" | "particle" }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        {variant === "quantum" && <QuantumLoader size={64} />}
        {variant === "sphere" && <SphereLoader size={64} />}
        {variant === "orbit" && <OrbitLoader size={64} />}
        {variant === "particle" && <ParticleBurst size={80} />}
        <TypewriterLoader prefix={label} size={13} />
      </div>
    </div>
  );
}
