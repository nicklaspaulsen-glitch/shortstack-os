"use client";

import { STATUS_META } from "@/lib/social-studio/constants";
import type { SocialPostStatus } from "@/lib/social-studio/types";

interface StatusBadgeProps {
  status: SocialPostStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const meta = STATUS_META[status] ?? { label: status, color: "#A1A1AA", bg: "rgba(161,161,170,0.10)" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        background: meta.bg,
        border: `1px solid ${meta.color}33`,
        color: meta.color,
      }}
    >
      {meta.label}
    </span>
  );
}
