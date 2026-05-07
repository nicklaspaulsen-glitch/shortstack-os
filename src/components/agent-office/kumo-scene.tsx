"use client";

/**
 * KumoScene — Apr 28 v13 redesign.
 *
 * User: "make them actually show live status… if their not working make
 * them sit on the couch if their working make them be at the desk or
 * running around… for each one like voice receptionist echo have a mic,
 * make Reef look a whiteboard… different things rather than a desk for
 * everybody".
 *
 * Major rewrite from the v12 version:
 *
 *   1. **Per-agent workstations** — each of the 10 agents now has a
 *      UNIQUE station that matches their role, not a generic desk:
 *
 *        echo     — phone booth with headset + lit-up phone
 *        lyra     — coaching booth with headphones + clipboard
 *        sage     — analytics desk with bar-chart monitor
 *        reef     — whiteboard with sticky notes + dry-erase markers
 *        onyx     — mailroom desk with envelope stacks + sorting tray
 *        nova     — news desk with newspaper + 2 monitors
 *        casper   — content easel with calendar grid + post mockups
 *        pixel    — design station with drawing tablet + photo board
 *        maven    — ads dashboard with line-graph monitor + dollar pile
 *        aria     — executive desk with 3 monitors + leather chair
 *
 *   2. **State-based positioning** — agents whose watched table fired
 *      in the last 6s render AT their workstation in a "working" pose
 *      (avatar leans forward, station tool glows). Idle agents render
 *      at random IDLE_SPOTS — couch, armchair, kitchen counter,
 *      window — so the office reads as humans relaxing between tasks.
 *
 *   3. **Higher fidelity per object** — each station has 4-8 detail
 *      elements (cable, mug, paper, lamp, plant, monitor stand, etc).
 *      Avatars now have a body silhouette below the head, varying
 *      shirt color per agent.
 */

import { useMemo } from "react";
import { AGENTS, type PixelAgent } from "@/lib/pixel-office/agents";
import Link from "next/link";

const RECENT_PULSE_MS = 6_000;

function hexFromInt(c: number): string {
  return `#${c.toString(16).padStart(6, "0")}`;
}

/* ─── Station coordinates (1200x600 viewBox) ──────────────────────── */

interface StationPos {
  /** Workstation pixel position. */
  x: number;
  y: number;
  /** Where the avatar sits when working at this station. */
  ax: number;
  ay: number;
  /** Where the avatar sits when idle (couch / kitchen / etc.) */
  idleX: number;
  idleY: number;
  zone: string;
  idleZone: string;
}

const STATIONS: Record<string, StationPos> = {
  echo:   { x: 180, y: 250, ax: 180, ay: 215, idleX: 200, idleY: 462, zone: "Phone booth",       idleZone: "Lounge · couch" },
  lyra:   { x: 360, y: 250, ax: 360, ay: 215, idleX: 320, idleY: 480, zone: "Coaching booth",    idleZone: "Lounge · armchair" },
  sage:   { x: 540, y: 250, ax: 540, ay: 215, idleX: 920, idleY: 460, zone: "Analytics desk",    idleZone: "Kitchen counter" },
  reef:   { x: 720, y: 250, ax: 720, ay: 215, idleX: 1020, idleY: 490, zone: "Whiteboard",       idleZone: "Espresso bar" },
  onyx:   { x: 900, y: 250, ax: 900, ay: 215, idleX: 600, idleY: 470, zone: "Mailroom",          idleZone: "Meeting · table" },
  nova:   { x: 1060, y: 250, ax: 1060, ay: 215, idleX: 540, idleY: 510, zone: "News desk",       idleZone: "Meeting · whiteboard" },
  casper: { x: 240, y: 460, ax: 240, ay: 425, idleX: 80, idleY: 200, zone: "Content easel",      idleZone: "Window seat" },
  pixel:  { x: 480, y: 460, ax: 480, ay: 425, idleX: 1130, idleY: 200, zone: "Design station",   idleZone: "Window seat" },
  maven:  { x: 720, y: 460, ax: 720, ay: 425, idleX: 600, idleY: 555, zone: "Ads dashboard",     idleZone: "Stretching" },
  aria:   { x: 1000, y: 460, ax: 1000, ay: 420, idleX: 600, idleY: 200, zone: "Executive office", idleZone: "Walking" },
};

/* ─── Avatar body (head + torso) ─────────────────────────────────── */

function Avatar({
  cx,
  cy,
  color,
  initial,
  shirtColor,
  isWorking,
  isPulsing,
  hovered,
}: {
  cx: number;
  cy: number;
  color: string;
  initial: string;
  shirtColor: string;
  isWorking: boolean;
  isPulsing: boolean;
  hovered: boolean;
}) {
  const headR = hovered ? 14 : 12;
  // Working pose: leans forward 4° (rotate around base)
  const tilt = isWorking ? -3 : 0;
  return (
    <g transform={`translate(${cx}, ${cy}) rotate(${tilt})`}>
      {isPulsing && (
        <>
          <circle cx={0} cy={0} r={14} fill="none" stroke={color} strokeWidth={1.4} opacity={0.55}>
            <animate attributeName="r" from={11} to={26} dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" from={0.7} to={0} dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx={0} cy={0} r={14} fill="none" stroke={color} strokeWidth={0.8} opacity={0.40}>
            <animate attributeName="r" from={11} to={22} dur="1.5s" begin="0.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" from={0.5} to={0} dur="1.5s" begin="0.4s" repeatCount="indefinite" />
          </circle>
        </>
      )}
      {/* Cast shadow */}
      <ellipse cx={0} cy={28} rx={headR * 1.2} ry={3} fill="rgba(0,0,0,0.40)" filter="url(#blur-soft)" />
      {/* Torso (T-shirt) */}
      <path
        d={`M ${-headR * 0.95} ${headR - 1}
            Q ${-headR * 1.4} ${headR + 8} ${-headR * 1.5} ${headR + 22}
            L ${headR * 1.5} ${headR + 22}
            Q ${headR * 1.4} ${headR + 8} ${headR * 0.95} ${headR - 1}
            Z`}
        fill={`url(#shirt-${initial})`}
      />
      {/* Shirt accent stripe */}
      <path
        d={`M ${-headR * 1.1} ${headR + 8}
            Q 0 ${headR + 14} ${headR * 1.1} ${headR + 8}
            L ${headR * 1.4} ${headR + 22}
            L ${-headR * 1.4} ${headR + 22}
            Z`}
        fill={shirtColor}
        opacity={0.22}
      />
      {/* Head outline glow */}
      <circle cx={0} cy={0} r={headR + 2} fill={color} opacity={0.20} />
      {/* Head */}
      <circle cx={0} cy={0} r={headR} fill={`url(#avatar-${initial})`} />
      <circle cx={0} cy={0} r={headR} fill="none" stroke="rgba(255,255,255,0.40)" strokeWidth={0.6} />
      {/* Initial */}
      <text
        x={0}
        y={4}
        textAnchor="middle"
        fontFamily="Inter, system-ui"
        fontWeight={700}
        fontSize={hovered ? 13 : 11}
        fill="#0A0A0B"
        style={{ textShadow: "0 1px 0 rgba(255,255,255,0.4)" }}
      >
        {initial}
      </text>
    </g>
  );
}

/* ─── Per-agent station renderers ────────────────────────────────── */

/** Echo — phone booth with headset + lit-up phone display. */
function PhoneBoothStation({ glowing, glowColor }: { glowing: boolean; glowColor: string }) {
  return (
    <g>
      <ellipse cx={0} cy={36} rx={48} ry={9} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      {/* Booth back panel */}
      <rect x={-46} y={-50} width={92} height={70} rx={4} fill="url(#booth-grad)" />
      {/* Phone display */}
      <rect x={-30} y={-40} width={60} height={20} rx={2} fill="#0A0A0B" />
      <rect x={-28} y={-38} width={56} height={16} fill={glowing ? glowColor : "#1F2937"} opacity={glowing ? 0.85 : 1} />
      {glowing && (
        <>
          <text x={0} y={-29} fontFamily="Inter" fontSize={6} textAnchor="middle" fill="#FFFFFF" fontWeight={700}>ON CALL</text>
          <ellipse cx={0} cy={-28} rx={36} ry={10} fill={glowColor} opacity={0.30} filter="url(#blur-soft)" />
        </>
      )}
      {/* Phone keypad */}
      {[0, 1, 2, 3].map(row =>
        [0, 1, 2].map(col => (
          <rect
            key={`${row}-${col}`}
            x={-15 + col * 10}
            y={-15 + row * 7}
            width={6}
            height={4}
            rx={0.8}
            fill="#374151"
          />
        ))
      )}
      {/* Headset on hook */}
      <g transform="translate(36, -40)">
        <path d="M -8 0 Q -8 -12 0 -12 Q 8 -12 8 0" fill="none" stroke="#0A0A0B" strokeWidth={2} />
        <ellipse cx={-8} cy={2} rx={3} ry={4} fill="#1F2937" />
        <ellipse cx={8} cy={2} rx={3} ry={4} fill="#1F2937" />
      </g>
      {/* Plant on counter */}
      <g transform="translate(-38, -8)">
        <path d="M -3 0 L 3 0 L 2 6 L -2 6 Z" fill="url(#pot-grad)" />
        <path d="M 0 0 Q -3 -4 -5 -6 Q -2 -8 0 -5 Z" fill="url(#leaf-grad)" />
        <path d="M 0 0 Q 3 -4 5 -6 Q 2 -8 0 -5 Z" fill="url(#leaf-grad)" />
      </g>
    </g>
  );
}

/** Lyra — coaching desk with headphones + clipboard. */
function CoachingStation({ glowing, glowColor }: { glowing: boolean; glowColor: string }) {
  return (
    <g>
      <ellipse cx={0} cy={36} rx={45} ry={9} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      <rect x={-40} y={-8} width={80} height={28} rx={3} fill="url(#desk-front-grad)" />
      <rect x={-40} y={-8} width={80} height={6} fill="url(#desk-top-grad)" />
      {/* Monitor — sales transcript */}
      <rect x={-22} y={-40} width={44} height={32} rx={2} fill="#0A0A0B" />
      <rect x={-20} y={-38} width={40} height={28} fill={glowing ? glowColor : "#1F2937"} opacity={glowing ? 0.85 : 1} />
      <rect x={-17} y={-34} width={20} height={1.4} fill="rgba(255,255,255,0.50)" />
      <rect x={-17} y={-30} width={32} height={1.4} fill="rgba(255,255,255,0.40)" />
      <rect x={-17} y={-26} width={26} height={1.4} fill="rgba(255,255,255,0.40)" />
      <rect x={-17} y={-22} width={18} height={1.4} fill="rgba(255,255,255,0.30)" />
      {glowing && <ellipse cx={0} cy={-24} rx={30} ry={10} fill={glowColor} opacity={0.30} filter="url(#blur-soft)" />}
      {/* Headphones beside monitor */}
      <g transform="translate(28, -8)">
        <path d="M -7 0 Q -7 -10 0 -10 Q 7 -10 7 0" fill="none" stroke="#0A0A0B" strokeWidth={2} />
        <ellipse cx={-7} cy={1} rx={3} ry={4} fill="#1F2937" />
        <ellipse cx={7} cy={1} rx={3} ry={4} fill="#1F2937" />
      </g>
      {/* Clipboard */}
      <g transform="translate(-28, -3)">
        <rect x={-6} y={-10} width={12} height={14} fill="#FAFAFA" />
        <rect x={-2} y={-12} width={4} height={3} fill="#0F766E" />
        <rect x={-4} y={-7} width={8} height={1} fill="#94A3B8" />
        <rect x={-4} y={-4} width={6} height={1} fill="#94A3B8" />
        <rect x={-4} y={-1} width={7} height={1} fill="#94A3B8" />
      </g>
    </g>
  );
}

/** Sage — analytics desk with bar-chart monitor. */
function AnalyticsDesk({ glowing, glowColor }: { glowing: boolean; glowColor: string }) {
  return (
    <g>
      <ellipse cx={0} cy={36} rx={45} ry={9} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      <rect x={-40} y={-8} width={80} height={28} rx={3} fill="url(#desk-front-grad)" />
      <rect x={-40} y={-8} width={80} height={6} fill="url(#desk-top-grad)" />
      {/* Monitor with bar chart */}
      <rect x={-25} y={-44} width={50} height={36} rx={2} fill="#0A0A0B" />
      <rect x={-23} y={-42} width={46} height={32} fill={glowing ? glowColor : "#1F2937"} opacity={glowing ? 0.85 : 1} />
      {/* Bar chart bars on screen */}
      <rect x={-19} y={-22} width={5} height={11} fill="#5EEAD4" />
      <rect x={-12} y={-26} width={5} height={15} fill="#5EEAD4" />
      <rect x={-5} y={-32} width={5} height={21} fill="#5EEAD4" />
      <rect x={2} y={-28} width={5} height={17} fill="#5EEAD4" />
      <rect x={9} y={-34} width={5} height={23} fill="#5EEAD4" />
      <rect x={16} y={-30} width={5} height={19} fill="#5EEAD4" />
      <line x1={-21} y1={-11} x2={21} y2={-11} stroke="rgba(255,255,255,0.35)" strokeWidth={0.5} />
      {glowing && <ellipse cx={0} cy={-26} rx={32} ry={11} fill={glowColor} opacity={0.30} filter="url(#blur-soft)" />}
      {/* Coffee mug */}
      <g transform="translate(28, -2)">
        <ellipse cx={0} cy={0} rx={3} ry={1} fill="rgba(0,0,0,0.35)" />
        <rect x={-2.5} y={-4} width={5} height={4} rx={0.5} fill="#0F766E" />
      </g>
    </g>
  );
}

/** Reef — whiteboard with sticky notes + dry-erase markers. */
function WhiteboardStation({ glowing, glowColor }: { glowing: boolean; glowColor: string }) {
  return (
    <g>
      <ellipse cx={0} cy={36} rx={48} ry={9} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      {/* Whiteboard frame */}
      <rect x={-50} y={-50} width={100} height={70} rx={2} fill="#0A0A0B" />
      <rect x={-47} y={-47} width={94} height={64} fill="#FAFAFA" />
      {/* Sticky notes */}
      <rect x={-40} y={-40} width={14} height={14} fill="#FCD34D" transform="rotate(-3 -33 -33)" />
      <rect x={-22} y={-42} width={14} height={14} fill="#5EEAD4" transform="rotate(2 -15 -35)" />
      <rect x={-2} y={-38} width={14} height={14} fill="#FECACA" transform="rotate(-1 5 -31)" />
      <rect x={18} y={-40} width={14} height={14} fill="#A7F3D0" transform="rotate(4 25 -33)" />
      {/* Whiteboard scribbles */}
      <line x1={-40} y1={-15} x2={-15} y2={-15} stroke="#0F766E" strokeWidth={1.5} />
      <line x1={-40} y1={-10} x2={-25} y2={-10} stroke="#0F766E" strokeWidth={1.5} />
      <circle cx={-5} cy={-12} r={4} fill="none" stroke="#0F766E" strokeWidth={1.5} />
      <line x1={5} y1={-15} x2={20} y2={-15} stroke="#0D9488" strokeWidth={1.5} />
      <line x1={5} y1={-10} x2={30} y2={-10} stroke="#0D9488" strokeWidth={1.5} />
      <path d="M -40 0 L -32 -3 L -25 0 L -18 -5 L -10 -1 L 0 -4 L 12 0 L 25 -2"
        fill="none" stroke="#0F766E" strokeWidth={1.2} />
      {glowing && (
        <rect x={-47} y={-47} width={94} height={64} fill={glowColor} opacity={0.18} />
      )}
      {/* Marker tray */}
      <rect x={-40} y={20} width={80} height={3} fill="#374151" />
      <rect x={-30} y={17} width={4} height={3} fill="#0F766E" />
      <rect x={-22} y={17} width={4} height={3} fill="#FECACA" />
      <rect x={-14} y={17} width={4} height={3} fill="#FCD34D" />
      {/* Eraser */}
      <rect x={20} y={16} width={12} height={5} fill="#0A0A0B" />
    </g>
  );
}

/** Onyx — mailroom desk with envelope stacks + sorting tray. */
function MailroomStation({ glowing, glowColor }: { glowing: boolean; glowColor: string }) {
  return (
    <g>
      <ellipse cx={0} cy={36} rx={45} ry={9} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      <rect x={-40} y={-8} width={80} height={28} rx={3} fill="url(#desk-front-grad)" />
      <rect x={-40} y={-8} width={80} height={6} fill="url(#desk-top-grad)" />
      {/* Sorting tray (3-tier) */}
      <g transform="translate(-25, -30)">
        <rect x={-12} y={0} width={24} height={6} fill="#374151" />
        <rect x={-12} y={-8} width={24} height={6} fill="#475569" />
        <rect x={-12} y={-16} width={24} height={6} fill="#374151" />
        {/* Envelopes in trays */}
        <rect x={-9} y={-3} width={9} height={3} fill="#FAFAFA" />
        <rect x={-9} y={-11} width={11} height={3} fill="#FAFAFA" />
        <rect x={-9} y={-19} width={8} height={3} fill="#FAFAFA" />
      </g>
      {/* Stack of envelopes */}
      <g transform="translate(15, -6)">
        <rect x={-12} y={-2} width={24} height={4} fill="#FAFAFA" />
        <rect x={-12} y={-6} width={24} height={4} fill="#F1F5F9" />
        <rect x={-12} y={-10} width={24} height={4} fill="#FAFAFA" />
        <rect x={-12} y={-14} width={24} height={4} fill="#F1F5F9" />
        {/* Top envelope flap */}
        <path d="M -12 -14 L 0 -10 L 12 -14 Z" fill="#E2E8F0" />
        {glowing && (
          <rect x={-12} y={-14} width={24} height={16} fill={glowColor} opacity={0.30} />
        )}
      </g>
      {/* Send button glow */}
      {glowing && (
        <circle cx={32} cy={4} r={6} fill={glowColor} opacity={0.55}>
          <animate attributeName="opacity" from={0.7} to={0.2} dur="1s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );
}

/** Nova — news desk with newspaper + 2 monitors. */
function NewsDesk({ glowing, glowColor }: { glowing: boolean; glowColor: string }) {
  return (
    <g>
      <ellipse cx={0} cy={36} rx={50} ry={9} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      <rect x={-44} y={-8} width={88} height={28} rx={3} fill="url(#desk-front-grad)" />
      <rect x={-44} y={-8} width={88} height={6} fill="url(#desk-top-grad)" />
      {/* Two monitors side-by-side (broadcast control room style) */}
      {[-22, 22].map((mx, i) => (
        <g key={i} transform={`translate(${mx}, -36)`}>
          <rect x={-14} y={0} width={28} height={20} rx={1.5} fill="#0A0A0B" />
          <rect x={-12.5} y={1.5} width={25} height={17} fill={glowing ? glowColor : "#1F2937"} opacity={glowing ? 0.85 : 1} />
          {/* Headline lines */}
          <rect x={-10} y={4} width={16} height={1} fill="rgba(255,255,255,0.5)" />
          <rect x={-10} y={7} width={20} height={1} fill="rgba(255,255,255,0.4)" />
          <rect x={-10} y={10} width={12} height={1} fill="rgba(255,255,255,0.4)" />
          {glowing && <ellipse cx={0} cy={9} rx={18} ry={6} fill={glowColor} opacity={0.30} filter="url(#blur-soft)" />}
        </g>
      ))}
      {/* Folded newspaper */}
      <g transform="translate(0, -3)">
        <rect x={-10} y={-5} width={20} height={8} fill="#FAFAFA" />
        <rect x={-9} y={-4} width={18} height={1.5} fill="#0A0A0B" />
        <rect x={-9} y={-1} width={12} height={1} fill="#94A3B8" />
        <rect x={-9} y={1} width={14} height={1} fill="#94A3B8" />
      </g>
    </g>
  );
}

/** Casper — content easel with calendar grid + post mockups. */
function ContentEasel({ glowing, glowColor }: { glowing: boolean; glowColor: string }) {
  return (
    <g>
      <ellipse cx={0} cy={36} rx={42} ry={9} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      {/* Easel legs */}
      <line x1={-18} y1={36} x2={-10} y2={-30} stroke="#3F2D1F" strokeWidth={2} />
      <line x1={18} y1={36} x2={10} y2={-30} stroke="#3F2D1F" strokeWidth={2} />
      {/* Canvas / calendar grid */}
      <rect x={-30} y={-50} width={60} height={50} fill="#FAFAFA" />
      <rect x={-30} y={-50} width={60} height={6} fill={glowing ? glowColor : "#0F766E"} />
      <text x={0} y={-46} fontFamily="Inter" fontSize={4} textAnchor="middle" fill="#FFFFFF" fontWeight={700}>APR 2026</text>
      {/* 7-col calendar grid */}
      {Array.from({ length: 5 }).map((_, row) =>
        Array.from({ length: 7 }).map((_, col) => {
          const isMarked = (row * 7 + col) % 4 === 1;
          return (
            <g key={`${row}-${col}`}>
              <rect
                x={-28 + col * 8.4}
                y={-38 + row * 7}
                width={8}
                height={6.5}
                fill="none"
                stroke="#E2E8F0"
                strokeWidth={0.3}
              />
              {isMarked && (
                <circle
                  cx={-24 + col * 8.4}
                  cy={-35 + row * 7}
                  r={1.5}
                  fill={glowing ? glowColor : "#0D9488"}
                  opacity={0.85}
                />
              )}
            </g>
          );
        })
      )}
      {glowing && (
        <rect x={-30} y={-50} width={60} height={50} fill={glowColor} opacity={0.18} />
      )}
    </g>
  );
}

/** Pixel — design station with drawing tablet + photo board. */
function DesignStation({ glowing, glowColor }: { glowing: boolean; glowColor: string }) {
  return (
    <g>
      <ellipse cx={0} cy={36} rx={45} ry={9} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      <rect x={-40} y={-8} width={80} height={28} rx={3} fill="url(#desk-front-grad)" />
      <rect x={-40} y={-8} width={80} height={6} fill="url(#desk-top-grad)" />
      {/* Drawing tablet on desk */}
      <rect x={-25} y={-3} width={50} height={20} rx={1} fill="#1F2937" />
      <rect x={-22} y={0} width={44} height={14} fill={glowing ? glowColor : "#0F172A"} opacity={glowing ? 0.85 : 1} />
      {/* Stylus */}
      <line x1={20} y1={-5} x2={32} y2={-15} stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" />
      {/* Pinned photo board behind */}
      <g transform="translate(0, -38)">
        <rect x={-30} y={-4} width={60} height={28} fill="#5C4534" />
        {/* 4 mini photo thumbnails on cork */}
        <rect x={-26} y={0} width={11} height={9} fill="#FAFAFA" />
        <rect x={-25} y={1} width={9} height={7} fill="#FCA5A5" />
        <rect x={-12} y={2} width={11} height={9} fill="#FAFAFA" transform="rotate(-3 -6.5 6.5)" />
        <rect x={-11} y={3} width={9} height={7} fill="#5EEAD4" transform="rotate(-3 -6.5 6.5)" />
        <rect x={2} y={1} width={11} height={9} fill="#FAFAFA" />
        <rect x={3} y={2} width={9} height={7} fill="#FCD34D" />
        <rect x={16} y={3} width={11} height={9} fill="#FAFAFA" transform="rotate(2 21.5 7.5)" />
        <rect x={17} y={4} width={9} height={7} fill="#A7F3D0" transform="rotate(2 21.5 7.5)" />
        {/* Pin dots */}
        {[-21, -7, 8, 22].map(px => (
          <circle key={px} cx={px} cy={1} r={0.8} fill="#FCD34D" />
        ))}
      </g>
      {glowing && (
        <ellipse cx={0} cy={6} rx={28} ry={10} fill={glowColor} opacity={0.30} filter="url(#blur-soft)" />
      )}
    </g>
  );
}

/** Maven — ads dashboard with line-graph monitor + dollar pile. */
function AdsDashboard({ glowing, glowColor }: { glowing: boolean; glowColor: string }) {
  return (
    <g>
      <ellipse cx={0} cy={36} rx={45} ry={9} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      <rect x={-40} y={-8} width={80} height={28} rx={3} fill="url(#desk-front-grad)" />
      <rect x={-40} y={-8} width={80} height={6} fill="url(#desk-top-grad)" />
      {/* Wide monitor — ad performance */}
      <rect x={-30} y={-44} width={60} height={36} rx={2} fill="#0A0A0B" />
      <rect x={-28} y={-42} width={56} height={32} fill={glowing ? glowColor : "#1F2937"} opacity={glowing ? 0.85 : 1} />
      {/* Line graph going up */}
      <polyline
        points="-25,-15 -19,-18 -13,-22 -7,-19 -1,-25 5,-23 11,-30 17,-28 23,-35"
        fill="none"
        stroke="#5EEAD4"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Y-axis labels */}
      <text x={-26} y={-38} fontFamily="Inter" fontSize={3} fill="rgba(255,255,255,0.5)">$5K</text>
      <text x={-26} y={-25} fontFamily="Inter" fontSize={3} fill="rgba(255,255,255,0.5)">$2K</text>
      <text x={-26} y={-12} fontFamily="Inter" fontSize={3} fill="rgba(255,255,255,0.5)">$0</text>
      {glowing && <ellipse cx={0} cy={-26} rx={36} ry={12} fill={glowColor} opacity={0.30} filter="url(#blur-soft)" />}
      {/* Dollar coin pile */}
      <g transform="translate(28, -2)">
        <ellipse cx={0} cy={4} rx={6} ry={2} fill="#FCD34D" />
        <ellipse cx={0} cy={2} rx={6} ry={2} fill="#FCD34D" />
        <ellipse cx={0} cy={0} rx={6} ry={2} fill="#FBBF24" />
        <text x={0} y={2.5} fontFamily="Inter" fontSize={4} textAnchor="middle" fill="#0A0A0B" fontWeight={800}>$</text>
      </g>
    </g>
  );
}

/** Aria — executive desk with 3 monitors + leather chair. */
function ExecutiveDesk({ glowing, glowColor }: { glowing: boolean; glowColor: string }) {
  return (
    <g>
      <ellipse cx={0} cy={36} rx={56} ry={10} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      <rect x={-50} y={-8} width={100} height={28} rx={3} fill="url(#desk-front-grad)" />
      <rect x={-50} y={-8} width={100} height={7} fill="url(#desk-top-grad)" />
      {/* 3 monitors */}
      {[-30, 0, 30].map((mx, i) => (
        <g key={i} transform={`translate(${mx}, -36)`}>
          <rect x={-13} y={0} width={26} height={20} rx={1.5} fill="#0A0A0B" />
          <rect x={-11.5} y={1.5} width={23} height={17} fill={glowing ? glowColor : "#1F2937"} opacity={glowing ? 0.85 : 1} />
          {/* Code/data lines */}
          <rect x={-9} y={4} width={14} height={1} fill="rgba(255,255,255,0.5)" />
          <rect x={-9} y={7} width={18} height={1} fill="rgba(255,255,255,0.4)" />
          <rect x={-9} y={10} width={10} height={1} fill="rgba(255,255,255,0.4)" />
          {glowing && <ellipse cx={0} cy={9} rx={16} ry={6} fill={glowColor} opacity={0.30} filter="url(#blur-soft)" />}
        </g>
      ))}
      {/* Leather chair behind */}
      <g transform="translate(0, -25)">
        <ellipse cx={0} cy={28} rx={16} ry={6} fill="rgba(0,0,0,0.40)" />
        <path d="M -14 0 L 14 0 L 16 26 L -16 26 Z" fill="url(#leather-grad)" />
        <path d="M -16 -14 L 16 -14 L 14 0 L -14 0 Z" fill="url(#leather-back-grad)" />
      </g>
    </g>
  );
}

const STATION_RENDERERS: Record<string, React.ComponentType<{ glowing: boolean; glowColor: string }>> = {
  echo: PhoneBoothStation,
  lyra: CoachingStation,
  sage: AnalyticsDesk,
  reef: WhiteboardStation,
  onyx: MailroomStation,
  nova: NewsDesk,
  casper: ContentEasel,
  pixel: DesignStation,
  maven: AdsDashboard,
  aria: ExecutiveDesk,
};

/* ─── Background props (couches, plants, kitchen) ─────────────────── */

function Couch({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <ellipse cx={0} cy={28} rx={70} ry={10} fill="rgba(0,0,0,0.35)" filter="url(#blur-soft)" />
      <rect x={-65} y={-5} width={130} height={32} rx={6} fill="url(#couch-grad)" />
      <rect x={-58} y={-8} width={36} height={20} rx={4} fill="url(#couch-cushion-grad)" />
      <rect x={-18} y={-8} width={36} height={20} rx={4} fill="url(#couch-cushion-grad)" />
      <rect x={22} y={-8} width={36} height={20} rx={4} fill="url(#couch-cushion-grad)" />
      <rect x={-65} y={-25} width={130} height={20} rx={4} fill="url(#couch-back-grad)" />
      <rect x={-72} y={-15} width={9} height={42} rx={3} fill="url(#couch-arm-grad)" />
      <rect x={63} y={-15} width={9} height={42} rx={3} fill="url(#couch-arm-grad)" />
    </g>
  );
}

function MeetingTable({ cx, cy }: { cx: number; cy: number }) {
  const r = 50;
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <ellipse cx={0} cy={r * 0.5 + 6} rx={r + 12} ry={r * 0.35} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const cx2 = Math.cos(angle) * (r + 16);
        const cy2 = Math.sin(angle) * (r * 0.5 + 8);
        return (
          <g key={i} transform={`translate(${cx2}, ${cy2})`}>
            <ellipse cx={0} cy={2} rx={9} ry={5} fill="url(#chair-grad)" />
            <ellipse cx={0} cy={-1} rx={7} ry={3.5} fill="url(#chair-back-grad)" />
          </g>
        );
      })}
      <ellipse cx={0} cy={0} rx={r} ry={r * 0.5} fill="url(#table-grad)" />
      <ellipse cx={0} cy={-2} rx={r - 4} ry={r * 0.5 - 3} fill="url(#table-top-grad)" />
      <rect x={-15} y={-4} width={14} height={8} fill="#FAFAFA" />
      <rect x={3} y={-2} width={1.5} height={10} fill="#0F766E" />
    </g>
  );
}

function CoffeeTable({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <ellipse cx={0} cy={14} rx={50} ry={7} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      <rect x={-46} y={-4} width={92} height={14} rx={3} fill="url(#table-grad)" />
      <rect x={-46} y={-4} width={92} height={5} fill="url(#table-top-grad)" />
      <rect x={-30} y={-10} width={20} height={6} rx={0.5} fill="#0F766E" />
      <rect x={-30} y={-13} width={20} height={3} rx={0.5} fill="#5EEAD4" />
    </g>
  );
}

function KitchenCounter({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <ellipse cx={0} cy={28} rx={75} ry={10} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      <rect x={-70} y={-2} width={140} height={28} rx={2} fill="url(#counter-grad)" />
      <rect x={-70} y={-2} width={140} height={5} fill="url(#counter-top-grad)" />
      <g transform="translate(-40, -4)">
        <rect x={-12} y={-22} width={24} height={22} rx={1} fill="#1F2937" />
        <rect x={-10} y={-20} width={20} height={6} rx={0.5} fill="#5EEAD4" opacity={0.6} />
        <rect x={-3} y={-12} width={6} height={3} fill="#0A0A0B" />
      </g>
      {[0, 1, 2, 3].map(i => (
        <g key={i} transform={`translate(${-5 + i * 12}, -6)`}>
          <rect x={-3} y={-6} width={6} height={6} rx={1} fill="#FAFAFA" />
          <ellipse cx={0} cy={-6} rx={3} ry={0.8} fill="#0F766E" />
        </g>
      ))}
    </g>
  );
}

function FloorPlant({ cx, cy, scale = 1 }: { cx: number; cy: number; scale?: number }) {
  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale})`}>
      <ellipse cx={0} cy={20} rx={14} ry={4} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      <path d="M -10 0 L 10 0 L 8 18 L -8 18 Z" fill="url(#pot-grad)" />
      <ellipse cx={0} cy={0} rx={10} ry={3} fill="#0F766E" />
      <ellipse cx={0} cy={0} rx={8} ry={2.4} fill="#042F2E" />
      <path d="M 0 0 Q -8 -16 -12 -22 Q -4 -28 0 -18 Z" fill="url(#leaf-grad)" />
      <path d="M 0 0 Q 8 -16 12 -22 Q 4 -28 0 -18 Z" fill="url(#leaf-grad)" />
      <path d="M 0 0 Q -3 -22 -2 -32 Q 2 -32 3 -22 Z" fill="url(#leaf-grad-light)" />
      <path d="M 0 0 Q 6 -14 10 -16 Q 6 -8 0 -6 Z" fill="url(#leaf-grad)" opacity={0.85} />
      <path d="M 0 0 Q -6 -14 -10 -16 Q -6 -8 0 -6 Z" fill="url(#leaf-grad)" opacity={0.85} />
    </g>
  );
}

function Window({ cx, cy, w = 100, h = 40 }: { cx: number; cy: number; w?: number; h?: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <rect x={-w / 2 - 2} y={-h / 2 - 2} width={w + 4} height={h + 4} rx={1} fill="#0A0A0B" />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="url(#sky-grad)" />
      <path
        d={`M ${-w / 2} ${h / 2 - 2} L ${-w / 2} 8 L ${-w / 2 + 12} 8 L ${-w / 2 + 12} 2 L ${-w / 2 + 24} 2 L ${-w / 2 + 24} -4 L ${-w / 2 + 36} -4 L ${-w / 2 + 36} 4 L ${-w / 2 + 50} 4 L ${-w / 2 + 50} -8 L ${-w / 2 + 60} -8 L ${-w / 2 + 60} 0 L ${-w / 2 + 70} 0 L ${-w / 2 + 70} -4 L ${-w / 2 + 84} -4 L ${-w / 2 + 84} 6 L ${w / 2} 6 L ${w / 2} ${h / 2 - 2} Z`}
        fill="#0F766E"
        opacity={0.85}
      />
      <line x1={0} y1={-h / 2} x2={0} y2={h / 2} stroke="#0A0A0B" strokeWidth={1} />
      <line x1={-w / 2} y1={0} x2={w / 2} y2={0} stroke="#0A0A0B" strokeWidth={1} />
      <path
        d={`M ${-w / 2} ${h / 2} L ${w / 2} ${h / 2} L ${w / 2 + 80} ${h / 2 + 100} L ${-w / 2 - 80} ${h / 2 + 100} Z`}
        fill="#FCD34D"
        opacity={0.06}
        filter="url(#blur-glow)"
      />
    </g>
  );
}

/* ─── Main scene ─────────────────────────────────────────────────── */

interface AgentDisplay {
  agent: PixelAgent;
  isWorking: boolean;
  isPulsing: boolean;
  x: number;
  y: number;
  zone: string;
}

export interface KumoSceneProps {
  variant?: "tile" | "full";
  recent: Record<string, number>;
  hovered: string | null;
  setHovered: (key: string | null) => void;
  onAgentClick?: (key: string) => void;
}

function buildDisplays(
  roster: readonly PixelAgent[],
  recent: Record<string, number>,
): AgentDisplay[] {
  const now = Date.now();
  return roster.map(agent => {
    const station = STATIONS[agent.key];
    if (!station) {
      return { agent, isWorking: false, isPulsing: false, x: 600, y: 460, zone: "Roaming" };
    }
    const ts = recent[agent.key] ?? 0;
    const isPulsing = ts > 0 && now - ts < RECENT_PULSE_MS;
    // "Working" if the agent had ANY activity in the last 60s — keeps
    // them at their station for a minute after the event so the office
    // doesn't constantly flicker.
    const isWorking = ts > 0 && now - ts < 60_000;
    const x = isWorking ? station.ax : station.idleX;
    const y = isWorking ? station.ay : station.idleY;
    const zone = isWorking ? station.zone : station.idleZone;
    return { agent, isWorking, isPulsing, x, y, zone };
  });
}

export default function KumoScene({
  variant = "tile",
  recent,
  hovered,
  setHovered,
  onAgentClick,
}: KumoSceneProps) {
  const roster = useMemo(
    () => (variant === "full" ? AGENTS : AGENTS) as readonly PixelAgent[],
    [],
  );

  const VB_W = 1200;
  const VB_H = 600;

  const displays = useMemo(() => buildDisplays(roster, recent), [roster, recent]);

  return (
    <div
      className="relative  overflow-hidden border border-border-subtle"
      style={{ background: "linear-gradient(180deg, #0F2C2A 0%, #042F2E 100%)" }}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height="auto"
        className="block"
        aria-hidden="true"
        style={{ imageRendering: "auto" }}
      >
        <defs>
          {/* Sky behind windows */}
          <linearGradient id="sky-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#5EEAD4" />
            <stop offset="60%" stopColor="#14B8A6" />
            <stop offset="100%" stopColor="#0D9488" />
          </linearGradient>

          {/* Wood floor */}
          <pattern id="wood-floor" x="0" y="0" width="120" height="36" patternUnits="userSpaceOnUse">
            <rect width="120" height="36" fill="#0F2C2A" />
            <line x1="0" y1="0" x2="120" y2="0" stroke="rgba(94,234,212,0.10)" strokeWidth="0.5" />
            <line x1="0" y1="36" x2="120" y2="36" stroke="rgba(94,234,212,0.10)" strokeWidth="0.5" />
            <line x1="40" y1="0" x2="40" y2="36" stroke="rgba(94,234,212,0.06)" strokeWidth="0.4" />
            <line x1="80" y1="0" x2="80" y2="36" stroke="rgba(94,234,212,0.06)" strokeWidth="0.4" />
            <line x1="0" y1="9" x2="120" y2="10" stroke="rgba(94,234,212,0.04)" strokeWidth="0.3" />
            <line x1="0" y1="22" x2="120" y2="21" stroke="rgba(94,234,212,0.03)" strokeWidth="0.3" />
            <line x1="0" y1="29" x2="120" y2="30" stroke="rgba(94,234,212,0.05)" strokeWidth="0.3" />
          </pattern>

          {/* Wall + floor glows */}
          <linearGradient id="wall-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0F766E" />
            <stop offset="100%" stopColor="#0A1F1E" />
          </linearGradient>
          <radialGradient id="floor-glow" cx="50%" cy="55%" r="55%">
            <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.32" />
            <stop offset="60%" stopColor="#0F766E" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#042F2E" stopOpacity="0" />
          </radialGradient>

          {/* Desks */}
          <linearGradient id="desk-top-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5EEAD4" />
            <stop offset="100%" stopColor="#0D9488" />
          </linearGradient>
          <linearGradient id="desk-side-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0D9488" />
            <stop offset="100%" stopColor="#0F766E" />
          </linearGradient>
          <linearGradient id="desk-front-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0F766E" />
            <stop offset="100%" stopColor="#0A2625" />
          </linearGradient>

          {/* Booth */}
          <linearGradient id="booth-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1F2937" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>

          {/* Couch */}
          <linearGradient id="couch-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#475569" /><stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
          <linearGradient id="couch-cushion-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#64748B" /><stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="couch-back-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3F4B5C" /><stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
          <linearGradient id="couch-arm-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#475569" /><stop offset="100%" stopColor="#1E293B" />
          </linearGradient>

          {/* Tables */}
          <linearGradient id="table-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#5C4534" /><stop offset="100%" stopColor="#3F2D1F" />
          </linearGradient>
          <linearGradient id="table-top-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7F5530" /><stop offset="100%" stopColor="#5C4534" />
          </linearGradient>

          {/* Chairs */}
          <linearGradient id="chair-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1F2937" /><stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id="chair-back-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#374151" /><stop offset="100%" stopColor="#1F2937" />
          </linearGradient>

          {/* Leather (executive) */}
          <linearGradient id="leather-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3F2D1F" /><stop offset="100%" stopColor="#1F1108" />
          </linearGradient>
          <linearGradient id="leather-back-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#5C4534" /><stop offset="100%" stopColor="#3F2D1F" />
          </linearGradient>

          {/* Counter */}
          <linearGradient id="counter-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FAFAFA" /><stop offset="100%" stopColor="#A1A1AA" />
          </linearGradient>
          <linearGradient id="counter-top-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E2E8F0" /><stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>

          {/* Plant */}
          <linearGradient id="pot-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7F5530" /><stop offset="100%" stopColor="#3F2D1F" />
          </linearGradient>
          <radialGradient id="leaf-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34D399" /><stop offset="100%" stopColor="#047857" />
          </radialGradient>
          <radialGradient id="leaf-grad-light" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6EE7B7" /><stop offset="100%" stopColor="#10B981" />
          </radialGradient>

          {/* Avatar gradients (head + shirt per agent) */}
          {displays.map(d => {
            const c = hexFromInt(d.agent.brandColor);
            const initial = d.agent.name.charAt(0);
            return (
              <g key={d.agent.key}>
                <radialGradient id={`avatar-${initial}`} cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                  <stop offset="35%" stopColor={c} />
                  <stop offset="100%" stopColor={c} stopOpacity="0.85" />
                </radialGradient>
                <linearGradient id={`shirt-${initial}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={c} stopOpacity="0.95" />
                  <stop offset="100%" stopColor={c} stopOpacity="0.65" />
                </linearGradient>
              </g>
            );
          })}

          {/* Filters */}
          <filter id="blur-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          <filter id="blur-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>

        {/* BACK WALL */}
        <rect x={0} y={0} width={VB_W} height={150} fill="url(#wall-grad)" />
        <rect x={0} y={148} width={VB_W} height={2} fill="#5EEAD4" opacity={0.32} />
        <ellipse cx={VB_W / 2} cy={150} rx={VB_W / 2} ry={50} fill="#14B8A6" opacity={0.18} filter="url(#blur-glow)" />
        <Window cx={200} cy={70} w={140} h={70} />
        <Window cx={500} cy={70} w={140} h={70} />
        <Window cx={800} cy={70} w={140} h={70} />
        <Window cx={1080} cy={70} w={140} h={70} />

        {/* FLOOR */}
        <rect x={0} y={150} width={VB_W} height={VB_H - 150} fill="url(#wood-floor)" />
        <ellipse cx={VB_W / 2} cy={VB_H / 2 + 40} rx={VB_W / 2} ry={140} fill="url(#floor-glow)" />
        {/* Sun rays */}
        <path d={`M 130 150 L 270 150 L 320 ${VB_H} L 80 ${VB_H} Z`} fill="#FCD34D" opacity={0.04} />
        <path d={`M 430 150 L 570 150 L 620 ${VB_H} L 380 ${VB_H} Z`} fill="#FCD34D" opacity={0.04} />
        <path d={`M 730 150 L 870 150 L 920 ${VB_H} L 680 ${VB_H} Z`} fill="#FCD34D" opacity={0.04} />
        <path d={`M 1010 150 L 1150 150 L 1180 ${VB_H} L 980 ${VB_H} Z`} fill="#FCD34D" opacity={0.04} />

        {/* Lounge / meeting / kitchen background props */}
        <Couch cx={260} cy={460} />
        <CoffeeTable cx={260} cy={530} />
        <MeetingTable cx={580} cy={490} />
        <KitchenCounter cx={970} cy={460} />
        <FloorPlant cx={50} cy={420} scale={1.4} />
        <FloorPlant cx={VB_W - 50} cy={400} scale={1.6} />

        {/* WORKSTATIONS — one per agent at their workstation position */}
        {displays.map(d => {
          const station = STATIONS[d.agent.key];
          if (!station) return null;
          const Renderer = STATION_RENDERERS[d.agent.key];
          if (!Renderer) return null;
          const color = hexFromInt(d.agent.brandColor);
          return (
            <g key={`station-${d.agent.key}`} transform={`translate(${station.x}, ${station.y})`}>
              <Renderer glowing={d.isWorking} glowColor={color} />
            </g>
          );
        })}

        {/* AGENTS — at their workstation if working, on couch/etc if idle */}
        {displays.map(d => {
          const color = hexFromInt(d.agent.brandColor);
          return (
            <g
              key={`avatar-${d.agent.key}`}
              onMouseEnter={() => setHovered(d.agent.key)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onAgentClick?.(d.agent.key)}
              style={{ cursor: "pointer" }}
            >
              <Avatar
                cx={d.x}
                cy={d.y}
                color={color}
                initial={d.agent.name.charAt(0)}
                shirtColor={color}
                isWorking={d.isWorking}
                isPulsing={d.isPulsing}
                hovered={hovered === d.agent.key}
              />
            </g>
          );
        })}
      </svg>

      {hovered && (() => {
        const d = displays.find(x => x.agent.key === hovered);
        if (!d) return null;
        return (
          <div
            className="absolute top-3 right-3 rounded-lg border border-border-subtle bg-bg-surface-2/95 backdrop-blur-sm px-3 py-2 text-[11px] shadow-xl pointer-events-none"
            style={{ minWidth: 220 }}
          >
            <p className="font-semibold text-text-primary text-[13px]">{d.agent.name}</p>
            <p className="text-text-secondary mt-0.5">{d.agent.role}</p>
            <p className="text-brand-accent text-[10px] mt-1.5 font-medium">{d.zone}</p>
            <p className="text-text-muted mt-1 text-[10px] leading-snug">{d.agent.blurb}</p>
            <p className="mt-2 inline-flex items-center gap-1 text-[10px]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${d.isWorking ? "bg-brand-accent animate-pulse" : "bg-text-muted"}`}
              />
              <span className={d.isWorking ? "text-brand-accent" : "text-text-muted"}>
                {d.isWorking ? "Working now" : "Idle"}
              </span>
            </p>
          </div>
        );
      })()}
    </div>
  );
}

/* Re-export the agent legend pill row */
export function AgentLegendPills({ recent }: { recent: Record<string, number> }) {
  const now = Date.now();
  return (
    <div className="flex flex-wrap gap-1.5">
      {AGENTS.slice(0, 10).map(agent => {
        const color = hexFromInt(agent.brandColor);
        const isWorking = !!recent[agent.key] && now - recent[agent.key] < 60_000;
        return (
          <Link
            key={agent.key}
            href={`/dashboard/agent-office?focus=${agent.key}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-light/60 px-2.5 py-1 text-[10px] transition-all hover:border-brand-accent/40 hover:bg-brand-accent/10"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: color,
                boxShadow: isWorking ? `0 0 8px ${color}, 0 0 4px ${color}` : undefined,
              }}
            />
            <span className="text-text-primary font-medium">{agent.name}</span>
            <span className="text-text-muted">· {agent.role}</span>
            {isWorking && <span className="text-brand-accent text-[9px] font-bold">●</span>}
          </Link>
        );
      })}
    </div>
  );
}
