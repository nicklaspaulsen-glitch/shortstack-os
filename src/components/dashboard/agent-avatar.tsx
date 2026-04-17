"use client";

/**
 * Animated SVG agent avatars with status states.
 * Each face has a unique design. Status drives glow, animation, and overlay.
 */

export type AgentStatus = "idle" | "working" | "thinking" | "error" | "success" | "offline";
export type AgentFace =
  | "robot" | "orb" | "panda" | "fox" | "cyborg" | "alien"
  | "knight" | "ninja" | "wizard" | "detective" | "scientist" | "chef";

interface AgentAvatarProps {
  status?: AgentStatus;
  face?: AgentFace;
  size?: number;
  label?: string;
  animated?: boolean;
}

const STATUS_COLORS: Record<AgentStatus, { glow: string; accent: string }> = {
  idle:     { glow: "rgba(59, 130, 246, 0.4)",  accent: "#60A5FA" },
  working:  { glow: "rgba(201, 168, 76, 0.5)",  accent: "#C9A84C" },
  thinking: { glow: "rgba(168, 85, 247, 0.5)",  accent: "#A855F7" },
  error:    { glow: "rgba(239, 68, 68, 0.5)",   accent: "#EF4444" },
  success:  { glow: "rgba(16, 185, 129, 0.5)",  accent: "#10B981" },
  offline:  { glow: "rgba(120, 120, 120, 0.2)", accent: "#6B7280" },
};

// Deterministic face selection from a name/id
export function pickFaceFromId(id: string): AgentFace {
  const faces: AgentFace[] = ["robot","orb","panda","fox","cyborg","alien","knight","ninja","wizard","detective","scientist","chef"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return faces[Math.abs(hash) % faces.length];
}

export default function AgentAvatar({
  status = "idle",
  face = "robot",
  size = 80,
  label,
  animated = true,
}: AgentAvatarProps) {
  const colors = STATUS_COLORS[status];
  const grayscale = status === "offline" ? "grayscale(1) opacity(0.5)" : "none";

  return (
    <div className="inline-flex flex-col items-center gap-1.5">
      <div
        className="relative"
        style={{
          width: size,
          height: size,
          filter: grayscale,
          animation: animated && status !== "offline" ? "ss-agent-bob 3s ease-in-out infinite" : "none",
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{
            filter: `drop-shadow(0 0 ${size / 6}px ${colors.glow})`,
            animation: animated && status === "error" ? "ss-agent-shake 0.4s ease-in-out infinite" : "none",
          }}
        >
          {renderFace(face, colors.accent, status)}
        </svg>

        {/* Status indicators */}
        {status === "working" && (
          <span className="absolute -top-1 -right-1 ss-agent-spin" style={{ animation: "ss-agent-spin 1.5s linear infinite" }}>
            <svg width={size * 0.22} height={size * 0.22} viewBox="0 0 24 24" fill={colors.accent}>
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1 0 2.8 2 2 0 0 1-2.8 0l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8 0 2 2 0 0 1 0-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 0-2.8 2 2 0 0 1 2.8 0l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 0 2 2 0 0 1 0 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
              <circle cx="12" cy="12" r="3" fill="#111"/>
            </svg>
          </span>
        )}

        {status === "thinking" && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-0.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="rounded-full"
                style={{
                  width: size * 0.07,
                  height: size * 0.07,
                  background: colors.accent,
                  animation: `ss-agent-dot 1.2s ease-in-out infinite ${i * 150}ms`,
                }}
              />
            ))}
          </div>
        )}

        {status === "success" && (
          <>
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/2"
                style={{
                  width: size * 0.1,
                  height: size * 0.1,
                  background: colors.accent,
                  borderRadius: "50%",
                  boxShadow: `0 0 6px ${colors.accent}`,
                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${size * 0.45}px)`,
                  animation: `ss-agent-sparkle 1.5s ease-in-out infinite ${i * 100}ms`,
                  opacity: 0,
                }}
              />
            ))}
          </>
        )}

        {status === "error" && (
          <span className="absolute -top-1 -right-1 rounded-full bg-red-500 text-white flex items-center justify-center font-bold" style={{ width: size * 0.25, height: size * 0.25, fontSize: size * 0.14 }}>
            !
          </span>
        )}

        {status === "offline" && (
          <span className="absolute -top-2 right-0 text-muted font-mono" style={{ fontSize: size * 0.14 }}>
            zZz
          </span>
        )}
      </div>

      {label && <span className="text-[10px] text-muted max-w-[100px] truncate">{label}</span>}

      <style jsx>{`
        @keyframes ss-agent-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes ss-agent-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
        @keyframes ss-agent-spin { to { transform: rotate(360deg); } }
        @keyframes ss-agent-dot { 0%,80%,100% { transform: scale(0.5); opacity: 0.3; } 40% { transform: scale(1.2); opacity: 1; } }
        @keyframes ss-agent-sparkle { 0%,100% { opacity: 0; } 30%,70% { opacity: 1; } }
      `}</style>
    </div>
  );
}

/* ────────────── Face renderers ────────────── */

function renderFace(face: AgentFace, accent: string, status: AgentStatus) {
  const eyesActive = status !== "offline";

  switch (face) {
    case "robot":
      return (
        <>
          {/* Antenna */}
          <line x1="40" y1="15" x2="35" y2="5" stroke="#888" strokeWidth="2" />
          <line x1="60" y1="15" x2="65" y2="5" stroke="#888" strokeWidth="2" />
          <circle cx="35" cy="5" r="3" fill={accent}>
            <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="65" cy="5" r="3" fill={accent} />
          {/* Head */}
          <rect x="20" y="20" width="60" height="55" rx="8" fill="#3A3A3A" stroke="#555" strokeWidth="2" />
          {/* Eyes */}
          <circle cx="38" cy="42" r="6" fill={eyesActive ? accent : "#333"} />
          <circle cx="62" cy="42" r="6" fill={eyesActive ? accent : "#333"} />
          {eyesActive && <><circle cx="38" cy="42" r="2" fill="#fff" /><circle cx="62" cy="42" r="2" fill="#fff" /></>}
          {/* Mouth */}
          <rect x="35" y="58" width="30" height="4" rx="1" fill="#222" />
          <line x1="45" y1="58" x2="45" y2="62" stroke="#888" strokeWidth="1" />
          <line x1="55" y1="58" x2="55" y2="62" stroke="#888" strokeWidth="1" />
          {/* Side panel */}
          <rect x="12" y="40" width="8" height="20" rx="2" fill="#2a2a2a" />
          <rect x="80" y="40" width="8" height="20" rx="2" fill="#2a2a2a" />
        </>
      );

    case "orb":
      return (
        <>
          <defs>
            <radialGradient id="orbGrad">
              <stop offset="0%" stopColor={accent} stopOpacity="0.9" />
              <stop offset="70%" stopColor={accent} stopOpacity="0.4" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="38" fill="url(#orbGrad)" />
          <circle cx="50" cy="50" r="22" fill={accent} opacity="0.3">
            <animate attributeName="r" values="20;26;20" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="50" cy="50" r="12" fill={accent} opacity="0.9" />
          {/* Inner particles */}
          <circle cx="44" cy="46" r="2" fill="#fff" opacity="0.7" />
          <circle cx="56" cy="54" r="1.5" fill="#fff" opacity="0.5" />
        </>
      );

    case "panda":
      return (
        <>
          {/* Ears */}
          <circle cx="28" cy="28" r="10" fill="#1a1a1a" />
          <circle cx="72" cy="28" r="10" fill="#1a1a1a" />
          {/* Face */}
          <ellipse cx="50" cy="55" rx="34" ry="32" fill="#fff" />
          {/* Eye patches */}
          <ellipse cx="38" cy="50" rx="9" ry="11" fill="#1a1a1a" transform="rotate(-15 38 50)" />
          <ellipse cx="62" cy="50" rx="9" ry="11" fill="#1a1a1a" transform="rotate(15 62 50)" />
          {/* Eyes */}
          <circle cx="38" cy="52" r="3" fill={eyesActive ? accent : "#fff"} />
          <circle cx="62" cy="52" r="3" fill={eyesActive ? accent : "#fff"} />
          {eyesActive && <><circle cx="39" cy="51" r="1" fill="#fff" /><circle cx="63" cy="51" r="1" fill="#fff" /></>}
          {/* Nose */}
          <ellipse cx="50" cy="64" rx="4" ry="3" fill="#1a1a1a" />
          {/* Mouth */}
          <path d="M 46 72 Q 50 76 54 72" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
        </>
      );

    case "fox":
      return (
        <>
          {/* Ears */}
          <path d="M 20 40 L 28 15 L 38 30 Z" fill="#D97706" />
          <path d="M 80 40 L 72 15 L 62 30 Z" fill="#D97706" />
          <path d="M 24 32 L 29 20 L 34 30 Z" fill="#111" />
          <path d="M 76 32 L 71 20 L 66 30 Z" fill="#111" />
          {/* Face */}
          <path d="M 20 42 Q 20 72 50 82 Q 80 72 80 42 Q 70 36 50 36 Q 30 36 20 42" fill="#EA580C" />
          {/* Cheek fluff */}
          <path d="M 20 60 Q 25 70 30 72" fill="#fff" />
          <path d="M 80 60 Q 75 70 70 72" fill="#fff" />
          {/* Eyes */}
          <circle cx="38" cy="50" r="3.5" fill={eyesActive ? accent : "#111"} />
          <circle cx="62" cy="50" r="3.5" fill={eyesActive ? accent : "#111"} />
          {eyesActive && <><circle cx="39" cy="49" r="1" fill="#fff" /><circle cx="63" cy="49" r="1" fill="#fff" /></>}
          {/* Nose */}
          <path d="M 46 64 L 54 64 L 50 70 Z" fill="#111" />
        </>
      );

    case "cyborg":
      return (
        <>
          {/* Head */}
          <ellipse cx="50" cy="52" rx="32" ry="36" fill="#D4A574" />
          {/* Metal half */}
          <path d="M 50 16 Q 82 16 82 52 Q 82 88 50 88 L 50 16" fill="#555" />
          <path d="M 50 16 Q 82 16 82 52 Q 82 88 50 88 L 50 16" fill="url(#metalGrad)" opacity="0.3" />
          <defs>
            <linearGradient id="metalGrad"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#000" /></linearGradient>
          </defs>
          {/* Seam */}
          <line x1="50" y1="16" x2="50" y2="88" stroke="#222" strokeWidth="1" />
          {/* Human eye */}
          <circle cx="38" cy="48" r="4" fill="#fff" />
          <circle cx="38" cy="48" r="2" fill={eyesActive ? "#3B82F6" : "#888"} />
          {/* Robot eye */}
          <rect x="58" y="44" width="10" height="8" rx="1" fill="#111" />
          <circle cx="63" cy="48" r="2.5" fill={eyesActive ? "#EF4444" : "#555"}>
            {eyesActive && <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />}
          </circle>
          {/* Mouth */}
          <path d="M 40 68 Q 50 72 60 68" fill="none" stroke="#222" strokeWidth="1.5" strokeLinecap="round" />
        </>
      );

    case "alien":
      return (
        <>
          {/* Large head */}
          <ellipse cx="50" cy="48" rx="32" ry="38" fill="#6EE7B7" />
          <ellipse cx="50" cy="38" rx="30" ry="10" fill="#A7F3D0" opacity="0.4" />
          {/* Large eyes */}
          <ellipse cx="38" cy="48" rx="7" ry="11" fill="#111" />
          <ellipse cx="62" cy="48" rx="7" ry="11" fill="#111" />
          {eyesActive && (
            <>
              <ellipse cx="38" cy="46" rx="2" ry="4" fill="#fff" />
              <ellipse cx="62" cy="46" rx="2" ry="4" fill="#fff" />
              <ellipse cx="40" cy="42" rx="1" ry="1.5" fill={accent} />
              <ellipse cx="64" cy="42" rx="1" ry="1.5" fill={accent} />
            </>
          )}
          {/* Tiny mouth */}
          <line x1="47" y1="72" x2="53" y2="72" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
        </>
      );

    case "knight":
      return (
        <>
          {/* Helmet */}
          <path d="M 20 40 Q 20 20 50 18 Q 80 20 80 40 L 80 80 L 20 80 Z" fill="#9CA3AF" />
          <path d="M 20 40 Q 20 20 50 18 Q 80 20 80 40" fill="url(#helmGrad)" opacity="0.4" />
          <defs>
            <linearGradient id="helmGrad"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#555" /></linearGradient>
          </defs>
          {/* Plume */}
          <path d="M 45 18 Q 50 8 55 18 Q 58 6 50 4 Q 42 6 45 18" fill="#EF4444" />
          {/* Visor */}
          <rect x="28" y="45" width="44" height="10" rx="2" fill="#111" />
          {/* Eye glow */}
          {eyesActive && (
            <>
              <circle cx="38" cy="50" r="2" fill={accent}>
                <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
              </circle>
              <circle cx="62" cy="50" r="2" fill={accent} />
            </>
          )}
          {/* Chin guard */}
          <rect x="30" y="62" width="40" height="18" rx="3" fill="#6B7280" />
          <line x1="40" y1="62" x2="40" y2="80" stroke="#555" />
          <line x1="50" y1="62" x2="50" y2="80" stroke="#555" />
          <line x1="60" y1="62" x2="60" y2="80" stroke="#555" />
        </>
      );

    case "ninja":
      return (
        <>
          {/* Head */}
          <ellipse cx="50" cy="55" rx="34" ry="34" fill="#1a1a1a" />
          {/* Mask band */}
          <rect x="14" y="42" width="72" height="18" fill="#111" />
          <line x1="14" y1="42" x2="86" y2="42" stroke="#333" strokeWidth="1" />
          <line x1="14" y1="60" x2="86" y2="60" stroke="#333" strokeWidth="1" />
          {/* Eye slit */}
          <rect x="32" y="49" width="36" height="4" fill="#fff" opacity="0.1" />
          {/* Eyes */}
          {eyesActive && (
            <>
              <circle cx="38" cy="51" r="2.5" fill={accent} />
              <circle cx="62" cy="51" r="2.5" fill={accent} />
            </>
          )}
          {/* Headband ties */}
          <path d="M 16 48 Q 8 54 12 62" stroke="#DC2626" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 18 52 Q 10 60 14 68" stroke="#DC2626" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );

    case "wizard":
      return (
        <>
          {/* Hat */}
          <path d="M 30 36 L 50 8 L 70 36 Z" fill="#6366F1" />
          <path d="M 30 36 L 50 8 L 70 36 Z" fill="url(#hatGrad)" opacity="0.4" />
          <defs>
            <linearGradient id="hatGrad"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#000" /></linearGradient>
          </defs>
          {/* Star on hat */}
          <circle cx="45" cy="22" r="1.5" fill={accent} />
          <circle cx="55" cy="18" r="1" fill={accent} />
          <circle cx="50" cy="28" r="1.2" fill={accent} />
          {/* Hat brim */}
          <ellipse cx="50" cy="36" rx="22" ry="4" fill="#4F46E5" />
          {/* Face */}
          <ellipse cx="50" cy="56" rx="24" ry="26" fill="#FED7AA" />
          {/* Beard */}
          <path d="M 30 60 Q 32 90 50 90 Q 68 90 70 60 Q 70 70 60 75 Q 50 78 40 75 Q 30 70 30 60" fill="#F3F4F6" />
          {/* Eyes */}
          <circle cx="40" cy="54" r="2" fill={eyesActive ? accent : "#333"} />
          <circle cx="60" cy="54" r="2" fill={eyesActive ? accent : "#333"} />
          {/* Eyebrows */}
          <path d="M 35 49 Q 40 46 45 49" stroke="#D1D5DB" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M 55 49 Q 60 46 65 49" stroke="#D1D5DB" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      );

    case "detective":
      return (
        <>
          {/* Fedora hat */}
          <ellipse cx="50" cy="28" rx="30" ry="5" fill="#1f2937" />
          <rect x="26" y="10" width="48" height="22" rx="3" fill="#374151" />
          <rect x="26" y="24" width="48" height="4" fill="#1f2937" />
          {/* Face */}
          <ellipse cx="50" cy="58" rx="26" ry="28" fill="#FCD34D" />
          {/* Eyes */}
          <circle cx="40" cy="54" r="3" fill={eyesActive ? "#111" : "#888"} />
          <circle cx="60" cy="54" r="3" fill={eyesActive ? "#111" : "#888"} />
          {/* Monocle */}
          <circle cx="60" cy="54" r="8" fill="none" stroke={accent} strokeWidth="2" />
          <line x1="66" y1="58" x2="72" y2="68" stroke={accent} strokeWidth="1.5" />
          {/* Mouth */}
          <path d="M 44 72 Q 50 75 56 72" fill="none" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
          {/* Mustache */}
          <path d="M 40 66 Q 45 68 50 66 Q 55 68 60 66" fill="#111" />
        </>
      );

    case "scientist":
      return (
        <>
          {/* Crazy hair */}
          <path d="M 20 30 Q 15 15 25 18 Q 28 10 38 15 Q 40 8 50 12 Q 55 6 65 14 Q 72 8 75 18 Q 85 15 80 30" fill="#E5E7EB" />
          {/* Face */}
          <ellipse cx="50" cy="56" rx="26" ry="28" fill="#FDE68A" />
          {/* Lab coat collar */}
          <path d="M 20 85 L 35 75 L 50 82 L 65 75 L 80 85 L 80 100 L 20 100 Z" fill="#fff" />
          <line x1="50" y1="82" x2="50" y2="100" stroke="#999" strokeWidth="1" />
          {/* Glasses */}
          <circle cx="38" cy="54" r="8" fill="rgba(255,255,255,0.3)" stroke="#333" strokeWidth="2" />
          <circle cx="62" cy="54" r="8" fill="rgba(255,255,255,0.3)" stroke="#333" strokeWidth="2" />
          <line x1="46" y1="54" x2="54" y2="54" stroke="#333" strokeWidth="2" />
          {/* Eyes behind glasses */}
          <circle cx="38" cy="54" r="2" fill={eyesActive ? accent : "#555"} />
          <circle cx="62" cy="54" r="2" fill={eyesActive ? accent : "#555"} />
          {/* Mouth */}
          <path d="M 44 70 Q 50 74 56 70" fill="none" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
        </>
      );

    case "chef":
      return (
        <>
          {/* Chef hat */}
          <ellipse cx="50" cy="16" rx="18" ry="8" fill="#fff" />
          <ellipse cx="35" cy="20" rx="10" ry="7" fill="#fff" />
          <ellipse cx="65" cy="20" rx="10" ry="7" fill="#fff" />
          <rect x="32" y="26" width="36" height="8" fill="#fff" />
          <rect x="30" y="32" width="40" height="6" fill="#f5f5f5" />
          {/* Face */}
          <ellipse cx="50" cy="58" rx="26" ry="28" fill="#FDBA74" />
          {/* Eyes */}
          <circle cx="40" cy="54" r="2.5" fill={eyesActive ? "#111" : "#555"} />
          <circle cx="60" cy="54" r="2.5" fill={eyesActive ? "#111" : "#555"} />
          {/* Rosy cheeks */}
          <circle cx="32" cy="62" r="4" fill="#F472B6" opacity="0.4" />
          <circle cx="68" cy="62" r="4" fill="#F472B6" opacity="0.4" />
          {/* Mustache */}
          <path d="M 38 68 Q 45 70 50 68 Q 55 70 62 68 Q 58 74 50 72 Q 42 74 38 68" fill="#6B4423" />
          {/* Smile */}
          <path d="M 44 76 Q 50 80 56 76" fill="none" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
        </>
      );
  }
}
