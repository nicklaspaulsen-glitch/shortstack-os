"use client";

/**
 * TrinityOrbVisual — the faceted low-poly 3D head SVG that sits at the
 * top of the orb. Extracted from trinity-orb.tsx so the orb shell loads
 * as little code as possible up front. Pure presentational — no data
 * fetching, no heavy handlers.
 */

import { useEffect, useRef, useState } from "react";

type TrinityState = "idle" | "thinking" | "listening";

export default function TrinityOrbVisual({
  size,
  pulsing,
  state = "idle",
}: {
  size: "large" | "small";
  pulsing: boolean;
  state?: TrinityState;
}) {
  const px = size === "large" ? 170 : 80;
  const wrapRef = useRef<HTMLDivElement>(null);
  // Head turn (-1..1 on each axis) driven by cursor position relative to component.
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [reduced, setReduced] = useState(false);

  // Detect reduced motion preference once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  // Cursor-tracked head turn — subtle parallax, capped at ~12deg.
  useEffect(() => {
    if (reduced) return;
    function onMove(e: MouseEvent) {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / Math.max(window.innerWidth / 2, 1);
      const dy = (e.clientY - cy) / Math.max(window.innerHeight / 2, 1);
      setTilt({
        x: Math.max(-1, Math.min(1, dx)),
        y: Math.max(-1, Math.min(1, dy)),
      });
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [reduced]);

  const ringSpeed = state === "thinking" ? "5s" : state === "listening" ? "8s" : "16s";
  const breathSpeed = pulsing ? "1.4s" : state === "listening" ? "2.2s" : "5s";
  const eyeIntensity = state === "listening" ? 1 : state === "thinking" ? 0.8 : 0.55;
  const tiltDeg = reduced ? { x: 0, y: 0 } : { x: tilt.x * 10, y: tilt.y * -8 };
  const eyeOffset = reduced ? { x: 0, y: 0 } : { x: tilt.x * 1.2, y: tilt.y * 1.0 };
  const voiceRings = state === "listening" ? [0, 1, 2] : [];

  const ariaLabel =
    state === "thinking"
      ? "Trinity is thinking"
      : state === "listening"
      ? "Trinity is listening"
      : "Trinity AI assistant";

  return (
    <div
      ref={wrapRef}
      className="relative select-none"
      style={{ width: px, height: px, perspective: 600 }}
      role="img"
      aria-label={ariaLabel}
    >
      <div
        className="absolute inset-[-32%] rounded-full blur-2xl pointer-events-none"
        style={{
          background:
            state === "listening"
              ? "radial-gradient(circle at 50% 50%, rgba(200,168,85,0.55), rgba(139,92,246,0.25) 45%, transparent 72%)"
              : state === "thinking"
              ? "radial-gradient(circle at 50% 50%, rgba(200,168,85,0.50), rgba(59,130,246,0.20) 50%, transparent 75%)"
              : "radial-gradient(circle at 50% 50%, rgba(200,168,85,0.40), rgba(200,168,85,0.10) 50%, transparent 70%)",
          animation: reduced ? undefined : `trinity-breath ${breathSpeed} ease-in-out infinite`,
        }}
        aria-hidden
      />

      <div
        className="absolute inset-[-4%] rounded-full opacity-70 pointer-events-none"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(200,168,85,0) 0%, rgba(200,168,85,0.55) 22%, rgba(139,92,246,0.40) 50%, rgba(59,130,246,0.35) 78%, rgba(200,168,85,0) 100%)",
          filter: "blur(5px)",
          animation: reduced ? undefined : `trinity-spin ${ringSpeed} linear infinite`,
        }}
        aria-hidden
      />

      {voiceRings.map((i) => (
        <div
          key={i}
          aria-hidden
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: "1px solid rgba(200,168,85,0.55)",
            animation: reduced
              ? undefined
              : `trinity-voicering 1.6s ease-out ${i * 0.5}s infinite`,
            opacity: 0,
          }}
        />
      ))}

      <div
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateY(${tiltDeg.x}deg) rotateX(${tiltDeg.y}deg)`,
          transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
          animation: reduced ? undefined : `trinity-breath ${breathSpeed} ease-in-out infinite`,
        }}
      >
        <svg
          viewBox="0 0 100 100"
          width={px}
          height={px}
          className="overflow-visible block"
          aria-hidden
        >
          <defs>
            <linearGradient id="trinity-facet-light" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff1c2" />
              <stop offset="55%" stopColor="#e8c870" />
              <stop offset="100%" stopColor="#c8a855" />
            </linearGradient>
            <linearGradient id="trinity-facet-mid" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d8b766" />
              <stop offset="55%" stopColor="#c8a855" />
              <stop offset="100%" stopColor="#8a7032" />
            </linearGradient>
            <linearGradient id="trinity-facet-dark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8a7032" />
              <stop offset="55%" stopColor="#5a4720" />
              <stop offset="100%" stopColor="#241b08" />
            </linearGradient>
            <radialGradient id="trinity-eye" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="40%" stopColor="#ffe9a8" stopOpacity={eyeIntensity} />
              <stop offset="100%" stopColor="#c8a855" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="trinity-scan" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,247,210,0)" />
              <stop offset="50%" stopColor="rgba(255,247,210,0.7)" />
              <stop offset="100%" stopColor="rgba(255,247,210,0)" />
            </linearGradient>
          </defs>

          <g>
            <polygon points="32,22 50,12 68,22 60,32 40,32" fill="url(#trinity-facet-light)" />
            <polygon points="68,22 78,34 70,42 60,32" fill="url(#trinity-facet-mid)" />
            <polygon points="32,22 22,34 30,42 40,32" fill="url(#trinity-facet-light)" opacity="0.92" />
            <polygon points="78,34 80,52 70,58 70,42" fill="url(#trinity-facet-dark)" />
            <polygon points="22,34 20,52 30,58 30,42" fill="url(#trinity-facet-mid)" opacity="0.95" />
            <polygon points="40,32 60,32 70,42 65,52 50,50 35,52 30,42" fill="url(#trinity-facet-light)" />
            <polygon points="50,42 54,56 46,56" fill="url(#trinity-facet-light)" opacity="0.9" />
            <polygon points="65,52 70,58 64,68 54,64" fill="url(#trinity-facet-mid)" />
            <polygon points="35,52 30,58 36,68 46,64" fill="url(#trinity-facet-mid)" opacity="0.95" />
            <polygon points="46,64 54,64 50,72" fill="url(#trinity-facet-dark)" />
            <g
              style={{
                transformOrigin: "50px 64px",
                animation:
                  reduced || state === "idle"
                    ? undefined
                    : state === "listening"
                    ? "trinity-jaw 0.6s ease-in-out infinite"
                    : "trinity-jaw 1.1s ease-in-out infinite",
              }}
            >
              <polygon points="36,68 64,68 58,80 50,84 42,80" fill="url(#trinity-facet-dark)" />
              <polygon points="50,72 58,80 50,84" fill="url(#trinity-facet-mid)" opacity="0.85" />
              <polygon points="50,72 42,80 50,84" fill="url(#trinity-facet-mid)" opacity="0.75" />
            </g>

            <g
              fill="none"
              stroke="rgba(255,235,180,0.18)"
              strokeWidth="0.4"
              strokeLinejoin="round"
            >
              <polyline points="32,22 50,12 68,22" />
              <polyline points="22,34 32,22" />
              <polyline points="68,22 78,34" />
              <polyline points="22,34 20,52 30,58 36,68 42,80 50,84 58,80 64,68 70,58 80,52 78,34" />
              <line x1="40" y1="32" x2="60" y2="32" />
              <line x1="30" y1="42" x2="70" y2="42" />
              <line x1="35" y1="52" x2="65" y2="52" />
              <line x1="46" y1="64" x2="54" y2="64" />
              <line x1="50" y1="42" x2="50" y2="56" />
              <line x1="40" y1="32" x2="30" y2="42" />
              <line x1="60" y1="32" x2="70" y2="42" />
              <line x1="35" y1="52" x2="30" y2="58" />
              <line x1="65" y1="52" x2="70" y2="58" />
            </g>

            <g
              style={{
                transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
                transition: "transform 220ms ease-out",
              }}
            >
              <circle cx="42" cy="46" r="5" fill="url(#trinity-eye)" />
              <circle cx="58" cy="46" r="5" fill="url(#trinity-eye)" />
              <circle
                cx="42"
                cy="46"
                r="1.6"
                fill="#fff7d8"
                style={{
                  animation: reduced
                    ? undefined
                    : state === "thinking"
                    ? "trinity-blink 2.4s ease-in-out infinite"
                    : "trinity-blink 5.5s ease-in-out infinite",
                  transformOrigin: "42px 46px",
                }}
              />
              <circle
                cx="58"
                cy="46"
                r="1.6"
                fill="#fff7d8"
                style={{
                  animation: reduced
                    ? undefined
                    : state === "thinking"
                    ? "trinity-blink 2.4s ease-in-out infinite"
                    : "trinity-blink 5.5s ease-in-out infinite",
                  transformOrigin: "58px 46px",
                }}
              />
            </g>

            <ellipse
              cx="44"
              cy="22"
              rx="9"
              ry="2.4"
              fill="rgba(255,247,210,0.45)"
              transform="rotate(-15 44 22)"
            />

            {state === "thinking" && !reduced && (
              <rect
                x="18"
                y="0"
                width="64"
                height="6"
                fill="url(#trinity-scan)"
                style={{
                  animation: "trinity-scan 2.6s linear infinite",
                  mixBlendMode: "screen",
                }}
              />
            )}
          </g>
        </svg>
      </div>

      <style jsx>{`
        @keyframes trinity-breath {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.045); }
        }
        @keyframes trinity-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes trinity-voicering {
          0% { transform: scale(0.85); opacity: 0.65; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes trinity-jaw {
          0%, 100% { transform: scaleY(1) translateY(0); }
          50% { transform: scaleY(1.18) translateY(1px); }
        }
        @keyframes trinity-blink {
          0%, 92%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
        @keyframes trinity-scan {
          0% { transform: translateY(10px); opacity: 0; }
          15% { opacity: 0.9; }
          85% { opacity: 0.9; }
          100% { transform: translateY(95px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(*) { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
    </div>
  );
}
