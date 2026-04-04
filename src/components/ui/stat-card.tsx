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
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {icon && <span className="text-gold">{icon}</span>}
      </div>
      <span className="stat-value">{value}</span>
      {change && <span className={`text-xs ${changeColor}`}>{change}</span>}
    </div>
  );
}
