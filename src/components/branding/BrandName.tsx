"use client";

import { useWhiteLabel } from "@/lib/white-label-context";

interface BrandNameProps {
  className?: string;
  fallback?: string;
}

export default function BrandName({ className, fallback = "ShortStack" }: BrandNameProps) {
  const { config } = useWhiteLabel();
  const name = config.company_name || fallback;
  return <span className={className}>{name}</span>;
}
