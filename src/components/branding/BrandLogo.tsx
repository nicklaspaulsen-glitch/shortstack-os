"use client";

import Image from "next/image";
import { useWhiteLabel } from "@/lib/white-label-context";

interface BrandLogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

const DEFAULT_LOGO = "/icons/shortstack-logo.svg";

export default function BrandLogo({ size = 32, className, alt }: BrandLogoProps) {
  const { config } = useWhiteLabel();
  const src = config.logo_url || DEFAULT_LOGO;
  const altText = alt || config.company_name || "ShortStack";

  const isExternal = /^https?:\/\//.test(src);
  if (isExternal) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={altText}
        className={className}
        style={{ height: size, width: "auto", objectFit: "contain" }}
      />
    );
  }
  return (
    <Image src={src} alt={altText} width={size} height={size} className={className} priority />
  );
}
