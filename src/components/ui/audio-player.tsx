"use client";

import { useRef, useState, useEffect } from "react";
import { Play, Pause } from "lucide-react";

export interface AudioPlayerProps {
  src: string;
  autoPlay?: boolean;
}

export function AudioPlayer({ src, autoPlay = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => { setPlaying(false); setProgress(0); };
    const onTime = () => { if (a.duration) setProgress(a.currentTime / a.duration); };
    const onMeta = () => setDuration(a.duration);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    if (autoPlay) a.play().catch(() => {});
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
    };
  }, [autoPlay]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play().catch(() => {}); } else { a.pause(); }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2.5 px-0.5">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-brand-accent text-[#020711] hover:bg-brand-accent/80 transition-colors cursor-pointer"
      >
        {playing ? <Pause size={9} /> : <Play size={9} />}
      </button>
      <div
        role="slider"
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        tabIndex={0}
        className="flex-1 relative h-[3px] rounded-full bg-[rgba(212,255,0,0.10)] overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-accent/50"
        onClick={(e) => {
          const a = audioRef.current;
          if (!a || !a.duration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
        }}
        onKeyDown={(e) => {
          const a = audioRef.current;
          if (!a) return;
          if (e.key === "ArrowRight") a.currentTime = Math.min(a.duration || 0, a.currentTime + 5);
          if (e.key === "ArrowLeft") a.currentTime = Math.max(0, a.currentTime - 5);
        }}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-brand-accent"
          style={{ width: `${progress * 100}%`, transition: "width 100ms linear" }}
        />
      </div>
      <span className="flex-shrink-0 text-[9px] tabular-nums text-text-secondary">
        {duration > 0 ? (playing ? fmt(progress * duration) : fmt(duration)) : "--:--"}
      </span>
    </div>
  );
}

export default AudioPlayer;
