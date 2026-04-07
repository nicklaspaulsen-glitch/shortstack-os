"use client";

import { ReactNode, useEffect, useRef, useState, useCallback } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: ReactNode;
  premium?: boolean;
}

function useAnimatedNumber(target: number, duration = 1200, enabled = false) {
  const [current, setCurrent] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || target === 0) { setCurrent(target); return; }
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration, enabled]);

  return current;
}

export default function StatCard({ label, value, change, changeType = "neutral", icon, premium }: StatCardProps) {
  const changeColor = {
    positive: "text-success",
    negative: "text-danger",
    neutral: "text-muted",
  }[changeType];

  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  // Parse numeric value for animation
  const numericValue = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  const isNumeric = !isNaN(numericValue) && typeof value === "number";
  const animatedNum = useAnimatedNumber(isNumeric ? numericValue : 0, 1200, visible);

  // Format value with original prefix/suffix
  const displayValue = isNumeric ? animatedNum : value;

  // Track mouse for hover glow
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty("--mouse-x", `${x}%`);
    e.currentTarget.style.setProperty("--mouse-y", `${y}%`);
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`group relative overflow-hidden transition-all duration-500 ${
        premium ? "card-premium hover-glow" : "stat-card"
      } ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}
    >
      {/* Ambient glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: "radial-gradient(circle at 50% 50%, rgba(201,168,76,0.04) 0%, transparent 70%)" }} />

      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <span className="stat-label">{label}</span>
          {icon && (
            <span className="text-gold/40 group-hover:text-gold group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(201,168,76,0.4)] transition-all duration-300">
              {icon}
            </span>
          )}
        </div>
        <span className={`stat-value ${visible ? "count-up" : ""} ${premium ? "stat-glow" : ""}`}>
          {typeof value === "string" && value.startsWith("$")
            ? `$${animatedNum.toLocaleString()}`
            : displayValue}
        </span>
        {change && <span className={`text-[10px] ${changeColor}`}>{change}</span>}
      </div>
    </div>
  );
}
