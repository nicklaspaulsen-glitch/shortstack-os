"use client";

import { getStatusBgColor } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  return (
    <span className={`badge ${getStatusBgColor(status)} ${className}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
