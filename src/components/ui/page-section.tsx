import React from "react";
import { cn } from "@/lib/utils";

interface PageSectionProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  topBorder?: boolean;
  className?: string;
  titleClassName?: string;
}

/**
 * PageSection — server-safe layout primitive for consistent vertical
 * section rhythm across dashboard pages.
 *
 * Enforces the dark OLED × lime-border design system:
 * - Top border uses `rgba(212,255,0,0.08)` (--border-subtle lime tint)
 * - Title uses Satoshi via font-display, matching InsightPanel label pattern
 * - Description uses --text-secondary (#A8A8B2)
 */
export function PageSection({
  title,
  description,
  action,
  children,
  topBorder = true,
  className,
  titleClassName,
}: PageSectionProps) {
  return (
    <div
      className={cn(
        "pt-6 pb-10",
        topBorder && "border-t border-[rgba(212,255,0,0.08)]",
        className
      )}
    >
      {title && (
        <SectionHeader
          title={title}
          description={description}
          action={action}
          className="mb-5"
          titleClassName={titleClassName}
        />
      )}
      {children}
    </div>
  );
}

/**
 * SectionHeader — just the header row, without wrapper padding.
 * Use when the section's outer spacing is already handled by the page.
 */
export function SectionHeader({
  title,
  description,
  action,
  className,
  titleClassName,
}: Omit<PageSectionProps, "children" | "topBorder">) {
  if (!title && !action) return null;

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="min-w-0 flex-1">
        {title && (
          <p
            className={cn(
              "font-display text-sm font-semibold text-[#F0F0F4] tracking-[-0.005em]",
              titleClassName
            )}
          >
            {title}
          </p>
        )}
        {description && (
          <p className="text-xs text-[#A8A8B2] mt-0.5">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  );
}

export default PageSection;
