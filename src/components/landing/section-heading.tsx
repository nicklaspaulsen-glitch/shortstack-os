"use client";

import { ReactNode } from "react";

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
  className?: string;
}

/**
 * Shared heading for landing page sections.
 * Keeps eyebrow + title + subtitle typography consistent.
 */
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className = "",
}: SectionHeadingProps) {
  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <div className={`${alignClass} ${className}`}>
      {eyebrow && (
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: "#c8a855" }}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className="text-3xl md:text-5xl font-extrabold text-white mb-4"
        style={{ letterSpacing: "-0.03em" }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`text-gray-400 leading-relaxed ${
            align === "center" ? "max-w-2xl mx-auto" : "max-w-2xl"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
