"use client";

/**
 * IosVideoPlayer — Framer-style styled HTML5 video player.
 *
 * Custom UI over the native <video> element:
 *   - Play/pause with animated icon swap
 *   - Scrubber bar with buffered progress
 *   - Time display (current / duration)
 *   - Volume + mute toggle
 *   - Fullscreen button
 *   - Glass frosted control bar (fades out on inactivity)
 *
 * Usage:
 *   <IosVideoPlayer src="/video/demo.mp4" poster="/video/poster.jpg" />
 */

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Icon primitives (inline SVG — no icon library dep)
// ---------------------------------------------------------------------------

function PlayIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 3.75L20.25 12 6 20.25V3.75z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="5" y="3" width="4.5" height="18" rx="1.5" />
      <rect x="14.5" y="3" width="4.5" height="18" rx="1.5" />
    </svg>
  );
}
function VolumeIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 9h4l5-5v16l-5-5H3V9zM17 9l4 4m0-4l-4 4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  ) : (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
      <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
      <path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" />
    </svg>
  );
}
function FullscreenIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Control Button
// ---------------------------------------------------------------------------

function CtrlBtn({
  onClick,
  children,
  label,
}: {
  onClick: () => void;
  children: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex items-center justify-center w-8 h-8 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors duration-150"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// IosVideoPlayer
// ---------------------------------------------------------------------------

interface IosVideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
  /** Aspect ratio CSS value (default: "16/9") */
  aspectRatio?: string;
  /** Show controls immediately without hover (default: false) */
  alwaysShowControls?: boolean;
}

export function IosVideoPlayer({
  src,
  poster,
  autoPlay = false,
  loop = false,
  className = "",
  aspectRatio = "16/9",
  alwaysShowControls = false,
}: IosVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [playing, setPlaying]       = useState(autoPlay);
  const [muted, setMuted]           = useState(autoPlay); // autoplay needs muted
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]     = useState(0);
  const [buffered, setBuffered]     = useState(0);
  const [controlsVisible, setControlsVisible] = useState(alwaysShowControls);

  // Sync play state
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) v.play().catch(() => { setPlaying(false); });
    else v.pause();
  }, [playing]);

  // Sync muted
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = muted;
  }, [muted]);

  // Event listeners
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onTime = () => {
      setCurrentTime(v.currentTime);
      if (v.buffered.length > 0) {
        setBuffered((v.buffered.end(v.buffered.length - 1) / v.duration) * 100);
      }
    };
    const onMeta = () => setDuration(v.duration || 0);
    const onEnded = () => { if (!loop) setPlaying(false); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("ended", onEnded);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);

    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [loop]);

  // Controls visibility
  const showControls = useCallback(() => {
    if (alwaysShowControls) return;
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 2500);
  }, [alwaysShowControls]);

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  const seek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const t = Number(e.target.value);
    v.currentTime = t;
    setCurrentTime(t);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl group select-none ${className}`}
      style={{ aspectRatio, background: "#070708" }}
      onMouseMove={showControls}
      onMouseEnter={showControls}
      onMouseLeave={() => { if (!alwaysShowControls) setControlsVisible(false); }}
      onTouchStart={showControls}
      onClick={togglePlay}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        loop={loop}
        muted={muted}
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
        aria-label="Video player"
      />

      {/* Big centre play/pause on click */}
      <AnimatePresence>
        {!playing && (
          <motion.div
            key="bigplay"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div
              className="flex items-center justify-center w-16 h-16 rounded-full"
              style={{
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.14)",
              }}
            >
              <PlayIcon />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control bar */}
      <AnimatePresence>
        {(controlsVisible || alwaysShowControls) && (
          <motion.div
            key="controls"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.80) 0%, transparent 100%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Scrubber */}
            <div className="relative h-1 mb-2.5 rounded-full overflow-hidden bg-white/20">
              {/* Buffered */}
              <div
                className="absolute inset-y-0 left-0 bg-white/30 rounded-full"
                style={{ width: `${buffered}%` }}
              />
              {/* Played */}
              <div
                className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={seek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Seek"
              />
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-1">
              <CtrlBtn onClick={togglePlay} label={playing ? "Pause" : "Play"}>
                <AnimatePresence mode="wait" initial={false}>
                  {playing ? (
                    <motion.span key="pause" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }} transition={{ duration: 0.14 }}>
                      <PauseIcon />
                    </motion.span>
                  ) : (
                    <motion.span key="play" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }} transition={{ duration: 0.14 }}>
                      <PlayIcon />
                    </motion.span>
                  )}
                </AnimatePresence>
              </CtrlBtn>

              <CtrlBtn onClick={() => setMuted((m) => !m)} label={muted ? "Unmute" : "Mute"}>
                <VolumeIcon muted={muted} />
              </CtrlBtn>

              <span className="text-[10px] text-white/60 font-mono ml-1 mr-auto">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <CtrlBtn onClick={toggleFullscreen} label="Fullscreen">
                <FullscreenIcon />
              </CtrlBtn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
