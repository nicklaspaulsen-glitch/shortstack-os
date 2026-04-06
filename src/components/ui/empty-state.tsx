"use client";

import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 fade-in">
      {icon && (
        <div className="text-muted/30 mb-1 float">{icon}</div>
      )}
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {description && <p className="text-[10px] text-muted text-center max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
