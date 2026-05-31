"use client";

/**
 * Client component wrapper for Phosphor icons used in the getting-started
 * page. Isolation is necessary because @phosphor-icons/react calls
 * React.createContext() at module init, which crashes Next.js "Collecting
 * page data" phase when the import lives in a Server Component.
 *
 * See fix(build) 84a8c91f — same pattern fixed for /_not-found.
 */

import {
  BookOpen,
  Calendar,
  CaretRight,
  ChatCircle,
  Envelope,
  FileText,
  FolderOpen,
  Gear,
  Lightning,
  MapTrifold,
  Phone,
  Receipt,
  Shield,
  Sparkle,
  Star,
  Users,
} from "@phosphor-icons/react";

const ICON_MAP: Record<string, typeof Sparkle> = {
  Sparkle,
  Lightning,
  MapTrifold,
  ChatCircle,
  FolderOpen,
  Receipt,
  Calendar,
  Users,
  Shield,
  Star,
  Gear,
  BookOpen,
  Envelope,
  Phone,
  FileText,
};

export function SectionIcon({
  name,
  brandColor,
}: {
  name: string;
  brandColor: string;
}) {
  const Icon = ICON_MAP[name] || Sparkle;
  return (
    <div
      className="inline-flex w-10 h-10 items-center justify-center rounded-xl mb-4"
      style={{ background: `${brandColor}15`, color: brandColor }}
    >
      <Icon size={20} />
    </div>
  );
}

export function CaretRightIcon({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return <CaretRight size={size} className={className} />;
}
