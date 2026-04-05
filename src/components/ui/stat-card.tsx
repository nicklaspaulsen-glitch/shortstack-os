"use client";

import { ReactNode } from "react";

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

  return (
    <div className="stat-card group relative overflow-hidden">
      {/* Subtle gradient background on hover */}
      <div className="absolute inset-0 bg-glow-gold opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <span className="stat-label">{label}</span>
          {icon && <span className="text-gold/60 group-hover:text-gold transition-colors">{icon}</span>}
        </div>
        <span className="stat-value">{value}</span>
        {change && <span className={`text-[10px] ${changeColor}`}>{change}</span>}
      </div>
    </div>
  );
}
