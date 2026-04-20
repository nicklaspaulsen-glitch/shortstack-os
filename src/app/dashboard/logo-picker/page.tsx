"use client";

/**
 * Logo Picker — 20 SVG concepts for ShortStack OS / Trinity branding.
 *
 * Each logo is inline SVG so it renders instantly, scales cleanly, and can
 * be iterated in code. Click "Pick this" to save your choice to localStorage
 * (later we wire it to the agency's brand kit).
 *
 * Design system: gold accent #C9A84C + #FFDD7A, dark surfaces, no stock art.
 */

import { useState } from "react";
import { Check } from "lucide-react";
import toast from "react-hot-toast";

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#FFDD7A";
const GOLD_DARK = "#8A7230";

interface LogoConcept {
  id: string;
  name: string;
  tagline: string;
  svg: React.ReactNode;
}

const LOGOS: LogoConcept[] = [
  {
    id: "gold_triangle_stack",
    name: "Triangle Stack",
    tagline: "Layered trinity — three triangles, descending scale.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={GOLD_LIGHT} />
            <stop offset="1" stopColor={GOLD_DARK} />
          </linearGradient>
        </defs>
        <polygon points="100,30 170,150 30,150" fill="url(#g1)" opacity="0.35" />
        <polygon points="100,60 150,140 50,140" fill="url(#g1)" opacity="0.65" />
        <polygon points="100,90 130,130 70,130" fill="url(#g1)" />
      </svg>
    ),
  },
  {
    id: "s_stack_monogram",
    name: "S-Stack Monogram",
    tagline: "Bold S where each curve is a stacked pancake.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M 150 60 Q 150 40 120 40 L 80 40 Q 50 40 50 70 Q 50 100 80 100 L 120 100 Q 150 100 150 130 Q 150 160 120 160 L 50 160"
          stroke={GOLD}
          strokeWidth="14"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="80" cy="40" r="3" fill={GOLD_LIGHT} />
        <circle cx="120" cy="100" r="3" fill={GOLD_LIGHT} />
        <circle cx="120" cy="160" r="3" fill={GOLD_LIGHT} />
      </svg>
    ),
  },
  {
    id: "trinity_prism",
    name: "Trinity Prism",
    tagline: "Upward triangle splits light into 3 beams.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <polygon points="100,40 160,140 40,140" fill="none" stroke={GOLD} strokeWidth="5" />
        <line x1="160" y1="140" x2="190" y2="170" stroke={GOLD_LIGHT} strokeWidth="4" strokeLinecap="round" />
        <line x1="100" y1="140" x2="100" y2="180" stroke={GOLD_LIGHT} strokeWidth="4" strokeLinecap="round" />
        <line x1="40" y1="140" x2="10" y2="170" stroke={GOLD_LIGHT} strokeWidth="4" strokeLinecap="round" />
        <circle cx="100" cy="100" r="8" fill={GOLD_LIGHT} />
      </svg>
    ),
  },
  {
    id: "hex_node_web",
    name: "Hex Node Web",
    tagline: "Six nodes connected — agency network + AI hub.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        {[0, 60, 120, 180, 240, 300].map((angle) => {
          const x = 100 + 60 * Math.cos((angle * Math.PI) / 180);
          const y = 100 + 60 * Math.sin((angle * Math.PI) / 180);
          return (
            <g key={angle}>
              <line x1="100" y1="100" x2={x} y2={y} stroke={GOLD_DARK} strokeWidth="1.5" />
              <circle cx={x} cy={y} r="8" fill={GOLD} />
            </g>
          );
        })}
        <circle cx="100" cy="100" r="14" fill={GOLD_LIGHT} />
      </svg>
    ),
  },
  {
    id: "circuit_crown",
    name: "Circuit Crown",
    tagline: "Crown silhouette made of circuit traces — premium + tech.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path d="M 30 140 L 30 80 L 70 110 L 100 50 L 130 110 L 170 80 L 170 140 Z"
              fill="none" stroke={GOLD} strokeWidth="5" strokeLinejoin="round" />
        <circle cx="30" cy="80" r="5" fill={GOLD_LIGHT} />
        <circle cx="70" cy="110" r="5" fill={GOLD_LIGHT} />
        <circle cx="100" cy="50" r="7" fill={GOLD_LIGHT} />
        <circle cx="130" cy="110" r="5" fill={GOLD_LIGHT} />
        <circle cx="170" cy="80" r="5" fill={GOLD_LIGHT} />
        <line x1="30" y1="150" x2="170" y2="150" stroke={GOLD} strokeWidth="5" />
      </svg>
    ),
  },
  {
    id: "orbital_os",
    name: "Orbital OS",
    tagline: "AI core with 3 orbiting rings — the operating system.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="100" cy="100" rx="75" ry="20" fill="none" stroke={GOLD_DARK} strokeWidth="2" transform="rotate(-20 100 100)" />
        <ellipse cx="100" cy="100" rx="75" ry="20" fill="none" stroke={GOLD} strokeWidth="2" transform="rotate(20 100 100)" />
        <ellipse cx="100" cy="100" rx="75" ry="20" fill="none" stroke={GOLD_LIGHT} strokeWidth="2" />
        <circle cx="100" cy="100" r="18" fill={GOLD_LIGHT} />
        <circle cx="100" cy="100" r="10" fill={GOLD_DARK} />
      </svg>
    ),
  },
  {
    id: "wave_bars",
    name: "Wave Bars",
    tagline: "Seven bars rising into a wave — voice / data.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        {[40, 60, 110, 140, 110, 60, 40].map((h, i) => (
          <rect
            key={i}
            x={30 + i * 22}
            y={100 - h / 2}
            width="14"
            height={h}
            rx="6"
            fill={i === 3 ? GOLD_LIGHT : GOLD}
          />
        ))}
      </svg>
    ),
  },
  {
    id: "diamond_facets",
    name: "Diamond Facets",
    tagline: "Faceted gold diamond — premium, sharp, unbreakable.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <polygon points="100,30 170,80 140,170 60,170 30,80" fill={GOLD} />
        <line x1="100" y1="30" x2="100" y2="170" stroke={GOLD_DARK} strokeWidth="1.5" />
        <line x1="30" y1="80" x2="170" y2="80" stroke={GOLD_DARK} strokeWidth="1.5" />
        <line x1="100" y1="30" x2="60" y2="170" stroke={GOLD_LIGHT} strokeWidth="0.8" />
        <line x1="100" y1="30" x2="140" y2="170" stroke={GOLD_LIGHT} strokeWidth="0.8" />
      </svg>
    ),
  },
  {
    id: "infinity_stack",
    name: "Infinity Stack",
    tagline: "Infinity loop made of stacked bars — endless scale.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M 50 100 C 50 70, 90 70, 100 100 C 110 130, 150 130, 150 100 C 150 70, 110 70, 100 100 C 90 130, 50 130, 50 100 Z"
          fill="none"
          stroke={GOLD}
          strokeWidth="8"
          strokeLinecap="round"
        />
        <circle cx="50" cy="100" r="5" fill={GOLD_LIGHT} />
        <circle cx="150" cy="100" r="5" fill={GOLD_LIGHT} />
      </svg>
    ),
  },
  {
    id: "neural_hex",
    name: "Neural Hex",
    tagline: "Hexagon with neural network inside — AI-native.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <polygon points="100,25 160,60 160,140 100,175 40,140 40,60" fill="none" stroke={GOLD} strokeWidth="4" />
        <circle cx="70" cy="80" r="5" fill={GOLD_LIGHT} />
        <circle cx="130" cy="80" r="5" fill={GOLD_LIGHT} />
        <circle cx="100" cy="110" r="6" fill={GOLD_LIGHT} />
        <circle cx="70" cy="140" r="5" fill={GOLD_LIGHT} />
        <circle cx="130" cy="140" r="5" fill={GOLD_LIGHT} />
        <line x1="70" y1="80" x2="100" y2="110" stroke={GOLD} strokeWidth="1.5" />
        <line x1="130" y1="80" x2="100" y2="110" stroke={GOLD} strokeWidth="1.5" />
        <line x1="100" y1="110" x2="70" y2="140" stroke={GOLD} strokeWidth="1.5" />
        <line x1="100" y1="110" x2="130" y2="140" stroke={GOLD} strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "motion_s",
    name: "Motion S",
    tagline: "Italic bold S with speed lines — velocity.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <text x="100" y="140" fontSize="140" fontWeight="900" fontStyle="italic" fill={GOLD} textAnchor="middle" fontFamily="Impact, Arial Black, sans-serif">S</text>
        <line x1="20" y1="70" x2="50" y2="70" stroke={GOLD_LIGHT} strokeWidth="3" strokeLinecap="round" />
        <line x1="10" y1="90" x2="45" y2="90" stroke={GOLD_LIGHT} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        <line x1="15" y1="110" x2="40" y2="110" stroke={GOLD_LIGHT} strokeWidth="3" strokeLinecap="round" opacity="0.4" />
      </svg>
    ),
  },
  {
    id: "triple_dot",
    name: "Triple Dot",
    tagline: "Three stacked dots — minimal, iconic, memorable.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="50" r="18" fill={GOLD} opacity="0.5" />
        <circle cx="100" cy="100" r="22" fill={GOLD_LIGHT} />
        <circle cx="100" cy="150" r="18" fill={GOLD} opacity="0.5" />
      </svg>
    ),
  },
  {
    id: "pyramid_light",
    name: "Pyramid of Light",
    tagline: "3D pyramid with rays — apex of AI.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <polygon points="100,50 150,160 50,160" fill={GOLD_DARK} />
        <polygon points="100,50 150,160 100,160" fill={GOLD} />
        <polygon points="100,50 100,160 50,160" fill={GOLD_LIGHT} opacity="0.7" />
        <line x1="100" y1="50" x2="100" y2="20" stroke={GOLD_LIGHT} strokeWidth="2" strokeLinecap="round" />
        <line x1="100" y1="50" x2="130" y2="25" stroke={GOLD_LIGHT} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <line x1="100" y1="50" x2="70" y2="25" stroke={GOLD_LIGHT} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <line x1="100" y1="50" x2="140" y2="40" stroke={GOLD_LIGHT} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        <line x1="100" y1="50" x2="60" y2="40" stroke={GOLD_LIGHT} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
  },
  {
    id: "arrow_stack",
    name: "Arrow Stack",
    tagline: "Three ascending arrows — growth, growth, growth.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <polyline points="50,160 100,100 150,160" fill="none" stroke={GOLD_DARK} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
        <polyline points="50,130 100,70 150,130" fill="none" stroke={GOLD} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        <polyline points="50,100 100,40 150,100" fill="none" stroke={GOLD_LIGHT} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "ripple_circle",
    name: "Ripple",
    tagline: "Concentric circles — signal broadcasting out.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="20" fill={GOLD_LIGHT} />
        <circle cx="100" cy="100" r="40" fill="none" stroke={GOLD} strokeWidth="3" opacity="0.7" />
        <circle cx="100" cy="100" r="60" fill="none" stroke={GOLD} strokeWidth="3" opacity="0.45" />
        <circle cx="100" cy="100" r="80" fill="none" stroke={GOLD} strokeWidth="3" opacity="0.2" />
      </svg>
    ),
  },
  {
    id: "shield_triangle",
    name: "Shield Triangle",
    tagline: "Triangular shield — trust, security, agency.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path d="M 100 30 L 160 60 Q 160 130 100 170 Q 40 130 40 60 Z" fill={GOLD} />
        <polygon points="100,60 130,115 70,115" fill={GOLD_DARK} />
        <circle cx="100" cy="120" r="6" fill={GOLD_LIGHT} />
      </svg>
    ),
  },
  {
    id: "chevron_cascade",
    name: "Chevron Cascade",
    tagline: "Three chevrons — momentum stacking.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <polyline points="50,155 100,105 150,155" fill="none" stroke={GOLD_DARK} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="50,120 100,70 150,120" fill="none" stroke={GOLD} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="50,85 100,35 150,85" fill="none" stroke={GOLD_LIGHT} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "golden_spiral",
    name: "Golden Spiral",
    tagline: "Fibonacci / phi — natural growth.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M 100 100 m -60 0 a 60 60 0 1 0 120 0 a 40 40 0 1 0 -80 0 a 25 25 0 1 0 50 0 a 15 15 0 1 0 -30 0"
          fill="none"
          stroke={GOLD}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="100" cy="100" r="4" fill={GOLD_LIGHT} />
      </svg>
    ),
  },
  {
    id: "pancake_tilt",
    name: "Pancake Tilt",
    tagline: "Stacked pancakes at isometric angle — literal ShortStack.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="100" cy="60" rx="70" ry="16" fill={GOLD_LIGHT} />
        <ellipse cx="100" cy="60" rx="70" ry="16" fill="none" stroke={GOLD_DARK} strokeWidth="2" />
        <rect x="30" y="60" width="140" height="14" fill={GOLD} />
        <ellipse cx="100" cy="74" rx="70" ry="16" fill={GOLD_LIGHT} />
        <ellipse cx="100" cy="74" rx="70" ry="16" fill="none" stroke={GOLD_DARK} strokeWidth="2" />
        <rect x="30" y="108" width="140" height="14" fill={GOLD} />
        <ellipse cx="100" cy="122" rx="70" ry="16" fill={GOLD_LIGHT} />
        <ellipse cx="100" cy="122" rx="70" ry="16" fill="none" stroke={GOLD_DARK} strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: "nova_starburst",
    name: "Nova Starburst",
    tagline: "Center triangle with rays — new-agency energy.",
    svg: (
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
          const r1 = 45;
          const r2 = 80;
          const x1 = 100 + r1 * Math.cos((angle * Math.PI) / 180);
          const y1 = 100 + r1 * Math.sin((angle * Math.PI) / 180);
          const x2 = 100 + r2 * Math.cos((angle * Math.PI) / 180);
          const y2 = 100 + r2 * Math.sin((angle * Math.PI) / 180);
          return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke={GOLD_LIGHT} strokeWidth="3" strokeLinecap="round" />;
        })}
        <polygon points="100,75 125,118 75,118" fill={GOLD} />
      </svg>
    ),
  },
];

export default function LogoPickerPage() {
  const [selected, setSelected] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("ss-selected-logo");
  });

  function pick(id: string) {
    setSelected(id);
    try {
      localStorage.setItem("ss-selected-logo", id);
    } catch {
      /* ignore */
    }
    const name = LOGOS.find((l) => l.id === id)?.name || id;
    toast.success(`Logo "${name}" selected — tell Claude tomorrow to finalize it.`);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1400px] px-6 py-10">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">Pick a Logo</h1>
          <p className="text-sm text-muted">
            20 SVG concepts for ShortStack OS / Trinity. Click <span className="text-gold">Pick this</span> on
            your favourite. Tomorrow I&apos;ll render the winner at production quality (raster + vector export,
            favicon, social OG, email-header versions).
          </p>
          {selected && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-gold/15 px-3 py-1 text-xs font-medium text-gold">
              <Check size={13} /> Currently selected: {LOGOS.find((l) => l.id === selected)?.name}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LOGOS.map((logo, i) => {
            const isSelected = selected === logo.id;
            return (
              <div
                key={logo.id}
                className={`group relative overflow-hidden rounded-xl border transition ${
                  isSelected
                    ? "border-gold bg-gold/5 ring-2 ring-gold/40"
                    : "border-border/50 bg-surface-light/30 hover:border-gold/40"
                }`}
              >
                <div className="absolute left-2 top-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-mono text-muted backdrop-blur">
                  #{i + 1}
                </div>

                {/* Large preview */}
                <div className="flex aspect-square items-center justify-center p-6">
                  <div className="h-full w-full">{logo.svg}</div>
                </div>

                {/* Small icons (simulate favicon + sidebar size) */}
                <div className="flex items-center justify-center gap-4 border-t border-border/30 py-2">
                  <div className="flex h-4 w-4 items-center justify-center">{logo.svg}</div>
                  <div className="flex h-6 w-6 items-center justify-center">{logo.svg}</div>
                  <div className="flex h-8 w-8 items-center justify-center">{logo.svg}</div>
                </div>

                <div className="border-t border-border/30 p-3">
                  <p className="mb-0.5 text-sm font-semibold">{logo.name}</p>
                  <p className="mb-2 text-[11px] text-muted">{logo.tagline}</p>
                  <button
                    onClick={() => pick(logo.id)}
                    className={`w-full rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      isSelected
                        ? "bg-gold text-black"
                        : "bg-surface-light text-foreground hover:bg-gold/15 hover:text-gold"
                    }`}
                  >
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1">
                        <Check size={12} /> Picked
                      </span>
                    ) : (
                      "Pick this"
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-lg border border-dashed border-border/50 bg-surface-light/20 p-4 text-xs text-muted">
          <p className="mb-1 font-semibold text-foreground">Next steps after you pick:</p>
          <ol className="ml-4 list-decimal space-y-0.5">
            <li>
              Tell Claude tomorrow: <span className="text-gold">&quot;finalize logo [name]&quot;</span>
            </li>
            <li>Claude generates: favicon.ico, apple-touch-icon, OG image (1200×630), email header, PDF header, light + dark variants</li>
            <li>Claude swaps the existing Trinity head SVG and the dashboard logo site-wide</li>
            <li>Updates <code>/app/opengraph-image.tsx</code> and <code>/app/icon.tsx</code> for automatic Next.js metadata handling</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
