"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: ReactNode;
}

export default function StatCard({ label, value, change, changeType = "neutral", icon }: StatCardProps) {
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

  return (
    <div
      ref={ref}
      className={`stat-card group relative overflow-hidden transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}
    >
      {/* Hover glow */}
      <div className="absolute inset-0 bg-glow-gold opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <span className="stat-label">{label}</span>
          {icon && (
            <span className="text-gold/50 group-hover:text-gold group-hover:scale-110 transition-all duration-300">
              {icon}
            </span>
          )}
        </div>
        <span className={`stat-value ${visible ? "count-up" : ""}`}>{value}</span>
        {change && <span className={`text-[10px] ${changeColor}`}>{change}</span>}
      </div>
    </div>
  );
}
