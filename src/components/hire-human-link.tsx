"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import type { ProServiceCategory } from "@/lib/pro-services";

/**
 * Drop-in "Prefer a human?" pill link used on AI generation pages
 * (thumbnails, AI video, copywriter, etc). Clicking routes to the
 * Pro Services directory, pre-filtered to the given category and
 * (optionally) pre-populates the quote modal title via ?title=…
 */
interface Props {
  category: ProServiceCategory;
  title?: string;
  size?: "xs" | "sm";
  label?: string;
  className?: string;
}

export default function HireHumanLink({
  category,
  title,
  size = "sm",
  label = "Prefer a human?",
  className = "",
}: Props) {
  const params = new URLSearchParams();
  params.set("category", category);
  if (title && title.trim()) params.set("title", title.trim().slice(0, 140));
  const href = `/dashboard/hire?${params.toString()}`;

  const sizing =
    size === "xs"
      ? "text-[10px] px-2 py-[3px] gap-1"
      : "text-[11px] px-2.5 py-1 gap-1.5";

  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 hover:border-gold/50 transition-colors ${sizing} ${className}`}
      title="Browse vetted human freelancers for this type of work"
    >
      <Users size={size === "xs" ? 10 : 12} />
      <span className="font-medium">{label}</span>
    </Link>
  );
}
