"use client";

import { ReactNode } from "react";

/* ─── Shared defs: gradients, shadows, palette ───────────────────── */
function Defs({ id }: { id: string }) {
  return (
    <defs>
      {/* Gold gradient */}
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#E4C876" />
        <stop offset="50%" stopColor="#C9A84C" />
        <stop offset="100%" stopColor="#8A7430" />
      </linearGradient>
      {/* Blue gradient */}
      <linearGradient id={`${id}-blue`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#60A5FA" />
        <stop offset="100%" stopColor="#2563EB" />
      </linearGradient>
      {/* Purple gradient */}
      <linearGradient id={`${id}-purple`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#C084FC" />
        <stop offset="100%" stopColor="#7C3AED" />
      </linearGradient>
      {/* Success/green gradient */}
      <linearGradient id={`${id}-green`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#6EE7B7" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
      {/* Warm sunset */}
      <linearGradient id={`${id}-sunset`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FCA5A5" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
      {/* Surface/muted gradient for backdrops */}
      <linearGradient id={`${id}-surface`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.12" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.04" />
      </linearGradient>
      {/* Radial glow */}
      <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.28" />
        <stop offset="100%" stopColor="#C9A84C" stopOpacity="0" />
      </radialGradient>
      {/* Soft shadow blur filter */}
      <filter id={`${id}-soft-shadow`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
        <feOffset dx="0" dy="3" />
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.35" />
        </feComponentTransfer>
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

/* ─── Illustrations ─────────────────────────────────────────────── */

export function EmptyLeadsIllustration({ size = 200 }: { size?: number }) {
  const id = "ill-leads";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted">
      <Defs id={id} />
      <circle cx="100" cy="100" r="90" fill={`url(#${id}-glow)`} />
      {/* Floating business cards behind */}
      <g filter={`url(#${id}-soft-shadow)`} opacity="0.9">
        <rect x="30" y="60" width="60" height="40" rx="6" fill={`url(#${id}-blue)`} transform="rotate(-10 60 80)" />
        <rect x="38" y="72" width="24" height="3" rx="1" fill="white" opacity="0.7" transform="rotate(-10 50 74)" />
        <rect x="38" y="80" width="38" height="2" rx="1" fill="white" opacity="0.5" transform="rotate(-10 57 81)" />
      </g>
      <g filter={`url(#${id}-soft-shadow)`} opacity="0.95">
        <rect x="110" y="55" width="60" height="40" rx="6" fill="#1a1a2e" transform="rotate(8 140 75)" />
        <circle cx="125" cy="72" r="5" fill={`url(#${id}-gold)`} transform="rotate(8 125 72)" />
        <rect x="135" y="68" width="24" height="3" rx="1" fill="white" opacity="0.7" transform="rotate(8 147 70)" />
        <rect x="135" y="76" width="18" height="2" rx="1" fill="white" opacity="0.5" transform="rotate(8 144 77)" />
      </g>
      {/* Magnifying glass */}
      <g filter={`url(#${id}-soft-shadow)`}>
        <circle cx="90" cy="120" r="32" fill={`url(#${id}-surface)`} stroke={`url(#${id}-gold)`} strokeWidth="4" />
        <circle cx="90" cy="120" r="24" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="1.5" opacity="0.35" />
        <line x1="113" y1="143" x2="135" y2="165" stroke={`url(#${id}-gold)`} strokeWidth="7" strokeLinecap="round" />
        {/* Sparkles inside lens */}
        <circle cx="82" cy="112" r="2" fill="white" opacity="0.8" />
        <circle cx="96" cy="124" r="1.2" fill="white" opacity="0.6" />
      </g>
    </svg>
  );
}

export function EmptyClientsIllustration({ size = 200 }: { size?: number }) {
  const id = "ill-clients";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted">
      <Defs id={id} />
      <circle cx="100" cy="100" r="90" fill={`url(#${id}-glow)`} />
      <g filter={`url(#${id}-soft-shadow)`}>
        {/* Body */}
        <path d="M60 170 Q60 125 100 125 Q140 125 140 170 Z" fill={`url(#${id}-blue)`} />
        {/* Head */}
        <circle cx="100" cy="95" r="30" fill={`url(#${id}-gold)`} />
        {/* Face highlights */}
        <circle cx="100" cy="95" r="30" fill="white" opacity="0.08" />
        {/* Eyes */}
        <circle cx="90" cy="92" r="2.5" fill="#1a1a2e" />
        <circle cx="110" cy="92" r="2.5" fill="#1a1a2e" />
        {/* Smile */}
        <path d="M88 104 Q100 112 112 104" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </g>
      {/* Plus icon badge */}
      <g filter={`url(#${id}-soft-shadow)`}>
        <circle cx="145" cy="60" r="20" fill={`url(#${id}-green)`} />
        <line x1="145" y1="50" x2="145" y2="70" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="135" y1="60" x2="155" y2="60" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function EmptyContentIllustration({ size = 200 }: { size?: number }) {
  const id = "ill-content";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted">
      <Defs id={id} />
      <circle cx="100" cy="100" r="90" fill={`url(#${id}-glow)`} />
      <g filter={`url(#${id}-soft-shadow)`}>
        {/* Document */}
        <path d="M65 45 L120 45 L145 70 L145 165 Q145 170 140 170 L65 170 Q60 170 60 165 L60 50 Q60 45 65 45 Z" fill="white" opacity="0.96" />
        <path d="M120 45 L120 70 L145 70 Z" fill={`url(#${id}-gold)`} opacity="0.7" />
        {/* Lines */}
        <rect x="72" y="92" width="62" height="3" rx="1.5" fill={`url(#${id}-gold)`} opacity="0.4" />
        <rect x="72" y="104" width="50" height="3" rx="1.5" fill={`url(#${id}-gold)`} opacity="0.3" />
        <rect x="72" y="116" width="58" height="3" rx="1.5" fill={`url(#${id}-gold)`} opacity="0.3" />
        <rect x="72" y="128" width="40" height="3" rx="1.5" fill={`url(#${id}-gold)`} opacity="0.2" />
        <rect x="72" y="140" width="54" height="3" rx="1.5" fill={`url(#${id}-gold)`} opacity="0.2" />
      </g>
      {/* Sparkles */}
      <g>
        <path d="M155 55 L158 61 L164 64 L158 67 L155 73 L152 67 L146 64 L152 61 Z" fill={`url(#${id}-gold)`} />
        <path d="M40 110 L42 114 L46 116 L42 118 L40 122 L38 118 L34 116 L38 114 Z" fill={`url(#${id}-blue)`} />
        <path d="M160 135 L161.5 138 L164.5 139.5 L161.5 141 L160 144 L158.5 141 L155.5 139.5 L158.5 138 Z" fill={`url(#${id}-purple)`} />
      </g>
    </svg>
  );
}

export function EmptyMessagesIllustration({ size = 200 }: { size?: number }) {
  const id = "ill-msgs";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted">
      <Defs id={id} />
      <circle cx="100" cy="100" r="90" fill={`url(#${id}-glow)`} />
      {/* Floating bubbles */}
      <g filter={`url(#${id}-soft-shadow)`} opacity="0.9">
        <rect x="25" y="50" width="42" height="26" rx="13" fill={`url(#${id}-blue)`} />
        <circle cx="38" cy="63" r="2" fill="white" opacity="0.8" />
        <circle cx="46" cy="63" r="2" fill="white" opacity="0.8" />
        <circle cx="54" cy="63" r="2" fill="white" opacity="0.8" />
      </g>
      <g filter={`url(#${id}-soft-shadow)`} opacity="0.85">
        <rect x="138" y="35" width="36" height="22" rx="11" fill="#1a1a2e" />
        <rect x="148" y="44" width="16" height="3" rx="1.5" fill="white" opacity="0.7" />
      </g>
      {/* Paper plane */}
      <g filter={`url(#${id}-soft-shadow)`}>
        <path d="M70 165 L170 110 L145 100 L120 150 L100 130 Z" fill={`url(#${id}-gold)`} />
        <path d="M100 130 L120 150 L125 135 Z" fill="#8A7430" />
        <path d="M70 165 L100 130 L120 150 Z" fill={`url(#${id}-gold)`} opacity="0.7" />
      </g>
    </svg>
  );
}

export function EmptyCampaignsIllustration({ size = 200 }: { size?: number }) {
  const id = "ill-camp";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted">
      <Defs id={id} />
      <circle cx="100" cy="100" r="90" fill={`url(#${id}-glow)`} />
      {/* Trajectory */}
      <path d="M40 160 Q70 90 140 50" stroke={`url(#${id}-gold)`} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 6" fill="none" opacity="0.6" />
      {/* Stars around */}
      <circle cx="50" cy="140" r="1.5" fill={`url(#${id}-gold)`} />
      <circle cx="80" cy="80" r="1.2" fill="white" opacity="0.7" />
      <circle cx="165" cy="90" r="1.8" fill="white" opacity="0.8" />
      <circle cx="55" cy="90" r="1" fill={`url(#${id}-gold)`} />
      {/* Rocket body */}
      <g filter={`url(#${id}-soft-shadow)`} transform="rotate(45 120 80)">
        <path d="M115 40 Q125 40 125 55 L125 110 L115 110 Z" fill="white" />
        <path d="M125 40 Q125 40 125 55 L125 110 L135 110 L135 55 Q135 40 125 40 Z" fill={`url(#${id}-gold)`} />
        <circle cx="125" cy="65" r="7" fill={`url(#${id}-blue)`} />
        <circle cx="125" cy="65" r="4" fill="white" opacity="0.3" />
        {/* Fins */}
        <path d="M115 100 L105 120 L115 115 Z" fill={`url(#${id}-gold)`} />
        <path d="M135 100 L145 120 L135 115 Z" fill="#8A7430" />
        {/* Flame */}
        <path d="M120 112 L125 130 L130 112 Q125 120 120 112 Z" fill={`url(#${id}-sunset)`} opacity="0.9" />
      </g>
    </svg>
  );
}

export function EmptyAnalyticsIllustration({ size = 200 }: { size?: number }) {
  const id = "ill-analytics";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted">
      <Defs id={id} />
      <circle cx="100" cy="100" r="90" fill={`url(#${id}-glow)`} />
      <g filter={`url(#${id}-soft-shadow)`}>
        {/* Chart background */}
        <rect x="35" y="45" width="130" height="120" rx="10" fill="white" opacity="0.96" />
        {/* Grid lines */}
        <line x1="45" y1="70" x2="155" y2="70" stroke="#e5e7eb" strokeWidth="1" />
        <line x1="45" y1="95" x2="155" y2="95" stroke="#e5e7eb" strokeWidth="1" />
        <line x1="45" y1="120" x2="155" y2="120" stroke="#e5e7eb" strokeWidth="1" />
        <line x1="45" y1="145" x2="155" y2="145" stroke="#e5e7eb" strokeWidth="1" />
        {/* Bars */}
        <rect x="55" y="125" width="14" height="20" rx="2" fill={`url(#${id}-blue)`} opacity="0.6" />
        <rect x="78" y="105" width="14" height="40" rx="2" fill={`url(#${id}-blue)`} opacity="0.7" />
        <rect x="101" y="118" width="14" height="27" rx="2" fill={`url(#${id}-gold)`} opacity="0.7" />
        <rect x="124" y="90" width="14" height="55" rx="2" fill={`url(#${id}-gold)`} />
      </g>
      {/* Upward arrow */}
      <g filter={`url(#${id}-soft-shadow)`}>
        <path d="M60 130 L90 105 L115 115 L150 75" stroke={`url(#${id}-green)`} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M135 70 L152 72 L150 89 Z" fill={`url(#${id}-green)`} />
      </g>
    </svg>
  );
}

export function EmptyCalendarIllustration({ size = 200 }: { size?: number }) {
  const id = "ill-cal";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted">
      <Defs id={id} />
      <circle cx="100" cy="100" r="90" fill={`url(#${id}-glow)`} />
      <g filter={`url(#${id}-soft-shadow)`}>
        {/* Calendar body */}
        <rect x="40" y="55" width="120" height="115" rx="10" fill="white" opacity="0.96" />
        {/* Header strip */}
        <path d="M40 65 Q40 55 50 55 L150 55 Q160 55 160 65 L160 82 L40 82 Z" fill={`url(#${id}-gold)`} />
        {/* Rings */}
        <rect x="60" y="45" width="6" height="20" rx="3" fill="#1a1a2e" />
        <rect x="134" y="45" width="6" height="20" rx="3" fill="#1a1a2e" />
        {/* Dates */}
        {[0,1,2,3,4].map(r => [0,1,2,3,4,5].map(c => (
          <circle key={`${r}-${c}`} cx={54 + c*18} cy={96 + r*14} r="3.5" fill="#C9A84C" opacity={r*5+c === 8 ? 1 : 0.18} />
        )))}
      </g>
      {/* Sparkle */}
      <g>
        <path d="M155 115 L158 122 L165 125 L158 128 L155 135 L152 128 L145 125 L152 122 Z" fill={`url(#${id}-gold)`} />
      </g>
    </svg>
  );
}

export function EmptyFilesIllustration({ size = 200 }: { size?: number }) {
  const id = "ill-files";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted">
      <Defs id={id} />
      <circle cx="100" cy="100" r="90" fill={`url(#${id}-glow)`} />
      <g filter={`url(#${id}-soft-shadow)`}>
        {/* Folder back */}
        <path d="M30 75 L30 155 Q30 165 40 165 L160 165 Q170 165 170 155 L170 90 Q170 80 160 80 L95 80 L85 70 L40 70 Q30 70 30 75 Z" fill={`url(#${id}-blue)`} />
        {/* Folder front */}
        <path d="M30 95 L170 95 L170 155 Q170 165 160 165 L40 165 Q30 165 30 155 Z" fill={`url(#${id}-gold)`} opacity="0.95" />
        <path d="M30 95 L170 95 L170 155 Q170 165 160 165 L40 165 Q30 165 30 155 Z" fill="white" opacity="0.12" />
      </g>
      {/* Upload arrow */}
      <g filter={`url(#${id}-soft-shadow)`}>
        <circle cx="100" cy="120" r="25" fill="white" />
        <path d="M100 108 L100 135" stroke={`url(#${id}-gold)`} strokeWidth="4" strokeLinecap="round" />
        <path d="M90 117 L100 107 L110 117" stroke={`url(#${id}-gold)`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </svg>
  );
}

export function EmptyReviewsIllustration({ size = 200 }: { size?: number }) {
  const id = "ill-reviews";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted">
      <Defs id={id} />
      <circle cx="100" cy="100" r="90" fill={`url(#${id}-glow)`} />
      {/* Speech bubble */}
      <g filter={`url(#${id}-soft-shadow)`}>
        <path d="M40 65 Q40 50 55 50 L150 50 Q165 50 165 65 L165 115 Q165 130 150 130 L90 130 L72 150 L75 130 L55 130 Q40 130 40 115 Z" fill="white" opacity="0.96" />
      </g>
      {/* Stars */}
      <g filter={`url(#${id}-soft-shadow)`}>
        {[0,1,2,3,4].map(i => (
          <path key={i}
            d={`M${60 + i*22} 80 L${66 + i*22} 94 L${81 + i*22} 96 L${70 + i*22} 106 L${73 + i*22} 120 L${60 + i*22} 113 L${47 + i*22} 120 L${50 + i*22} 106 L${39 + i*22} 96 L${54 + i*22} 94 Z`}
            fill={`url(#${id}-gold)`}
            opacity={i === 0 ? 1 : 0.2}
          />
        ))}
      </g>
    </svg>
  );
}

export function EmptyInvoicesIllustration({ size = 200 }: { size?: number }) {
  const id = "ill-inv";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted">
      <Defs id={id} />
      <circle cx="100" cy="100" r="90" fill={`url(#${id}-glow)`} />
      <g filter={`url(#${id}-soft-shadow)`}>
        {/* Receipt body */}
        <path d="M55 35 L145 35 L145 170 L135 165 L125 170 L115 165 L105 170 L95 165 L85 170 L75 165 L65 170 L55 165 Z" fill="white" opacity="0.97" />
        {/* Top strip */}
        <rect x="55" y="35" width="90" height="22" fill={`url(#${id}-green)`} />
        {/* Lines */}
        <rect x="66" y="70" width="52" height="3" rx="1.5" fill={`url(#${id}-gold)`} opacity="0.5" />
        <rect x="66" y="82" width="68" height="2.5" rx="1.25" fill="#cbd5e1" />
        <rect x="66" y="92" width="60" height="2.5" rx="1.25" fill="#cbd5e1" />
        <rect x="66" y="102" width="64" height="2.5" rx="1.25" fill="#cbd5e1" />
        <rect x="66" y="125" width="68" height="3" rx="1.5" fill="#94a3b8" />
      </g>
      {/* Dollar badge */}
      <g filter={`url(#${id}-soft-shadow)`}>
        <circle cx="145" cy="85" r="22" fill={`url(#${id}-green)`} />
        <text x="145" y="94" textAnchor="middle" fill="white" fontSize="22" fontWeight="700" fontFamily="Inter, sans-serif">$</text>
      </g>
    </svg>
  );
}

export function EmptyComingSoonIllustration({ size = 200 }: { size?: number }) {
  const id = "ill-soon";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted">
      <Defs id={id} />
      <circle cx="100" cy="100" r="90" fill={`url(#${id}-glow)`} />
      {/* Large gear */}
      <g filter={`url(#${id}-soft-shadow)`} transform="translate(70 70)">
        <path d="M30 0 L35 0 L37 10 Q42 11 46 14 L54 9 L58 13 L53 21 Q56 25 57 30 L67 32 L67 37 L57 39 Q56 44 53 48 L58 56 L54 60 L46 55 Q42 58 37 59 L35 69 L30 69 L28 59 Q23 58 19 55 L11 60 L7 56 L12 48 Q9 44 8 39 L-2 37 L-2 32 L8 30 Q9 25 12 21 L7 13 L11 9 L19 14 Q23 11 28 10 Z" fill={`url(#${id}-gold)`} />
        <circle cx="32.5" cy="34.5" r="10" fill="white" />
      </g>
      {/* Small gear */}
      <g filter={`url(#${id}-soft-shadow)`} transform="translate(115 110)">
        <path d="M18 0 L22 0 L23.5 6 Q27 7 30 9 L35 6 L38 9 L35 14 Q37 17 37.5 21 L43 22 L43 26 L37.5 27 Q37 31 35 34 L38 39 L35 42 L30 38 Q27 41 23.5 42 L22 48 L18 48 L17 42 Q13 41 10 38 L5 42 L2 39 L5 34 Q3 31 2 27 L-3 26 L-3 22 L2 21 Q3 17 5 14 L2 9 L5 6 L10 9 Q13 7 17 6 Z" fill={`url(#${id}-blue)`} />
        <circle cx="20" cy="24" r="6.5" fill="white" />
      </g>
    </svg>
  );
}

export function EmptyErrorIllustration({ size = 200 }: { size?: number }) {
  const id = "ill-err";
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted">
      <Defs id={id} />
      <circle cx="100" cy="100" r="90" fill={`url(#${id}-glow)`} />
      <g filter={`url(#${id}-soft-shadow)`}>
        <circle cx="100" cy="100" r="55" fill={`url(#${id}-sunset)`} />
        <circle cx="100" cy="100" r="55" fill="white" opacity="0.12" />
        {/* Eyes */}
        <circle cx="85" cy="92" r="4" fill="white" />
        <circle cx="115" cy="92" r="4" fill="white" />
        <circle cx="86" cy="93" r="2" fill="#1a1a2e" />
        <circle cx="116" cy="93" r="2" fill="#1a1a2e" />
        {/* Frown */}
        <path d="M82 125 Q100 110 118 125" stroke="white" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      </g>
      {/* Broken link lines */}
      <line x1="30" y1="50" x2="44" y2="64" stroke={`url(#${id}-sunset)`} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <line x1="155" y1="50" x2="170" y2="36" stroke={`url(#${id}-sunset)`} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <line x1="30" y1="150" x2="44" y2="136" stroke={`url(#${id}-sunset)`} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <line x1="155" y1="150" x2="170" y2="164" stroke={`url(#${id}-sunset)`} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

/* ─── Type registry ─────────────────────────────────────────────── */

export type EmptyStateType =
  | "no-leads"
  | "no-clients"
  | "no-content"
  | "no-messages"
  | "no-campaigns"
  | "no-analytics"
  | "no-calendar"
  | "no-files"
  | "no-reviews"
  | "no-invoices"
  | "coming-soon"
  | "error";

const REGISTRY: Record<EmptyStateType, (props: { size?: number }) => JSX.Element> = {
  "no-leads": EmptyLeadsIllustration,
  "no-clients": EmptyClientsIllustration,
  "no-content": EmptyContentIllustration,
  "no-messages": EmptyMessagesIllustration,
  "no-campaigns": EmptyCampaignsIllustration,
  "no-analytics": EmptyAnalyticsIllustration,
  "no-calendar": EmptyCalendarIllustration,
  "no-files": EmptyFilesIllustration,
  "no-reviews": EmptyReviewsIllustration,
  "no-invoices": EmptyInvoicesIllustration,
  "coming-soon": EmptyComingSoonIllustration,
  "error": EmptyErrorIllustration,
};

/* ─── Unified EmptyState ────────────────────────────────────────── */

interface EmptyStateProps {
  type: EmptyStateType;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: number;
  className?: string;
}

export function EmptyState({ type, title, description, action, size = 180, className = "" }: EmptyStateProps) {
  const Illustration = REGISTRY[type];
  return (
    <div className={`flex flex-col items-center justify-center py-10 gap-3 fade-in ${className}`}>
      <div className="float">
        <Illustration size={size} />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-[11px] text-muted text-center max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
