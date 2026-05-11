"use client";

import Link from "next/link";
import Image from "next/image";
import { Mail, PhoneCall, UserPlus } from "lucide-react";
import { tokens, themeTokens } from "@/lib/brand/tokens";
import { BentoTile } from "./bento-tile";
import type { OwnerProfile } from "./types";

/**
 * OwnerProfileTile — 4×1 bento tile showing the agency owner's mini-profile
 * plus three quick-action shortcuts.
 *
 * Replaces QuickActionsGrid in Row 3 of the bento grid (same 4-col span).
 * Data arrives via the /api/dashboard-bento payload — no client-side fetch.
 *
 * Layout:
 *   [Avatar]  First Name              $X MRR
 *             Plan badge  · N clients
 *   ────────────────────────────────────────
 *   [New Lead]  [Inbox]  [Call]
 */

interface Props {
  profile: OwnerProfile;
  index?: number;
}

const QUICK: Array<{
  href: string;
  label: string;
  Icon: typeof UserPlus;
}> = [
  { href: "/dashboard/leads/new", label: "New lead", Icon: UserPlus },
  { href: "/dashboard/conversations", label: "Inbox", Icon: Mail },
  { href: "/dashboard/voice-receptionist", label: "Call", Icon: PhoneCall },
];

function planLabel(tier: string | null): string {
  if (!tier) return "Starter";
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function fmtMrr(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

/** Circular avatar — falls back to a coloured initial if no URL. */
function AvatarCircle({
  firstName,
  avatarUrl,
}: {
  firstName: string;
  avatarUrl: string | null;
}) {
  const ringStyle = {
    border: `2px solid ${tokens.brand.accent}22`,
  } as React.CSSProperties;

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={firstName}
        width={44}
        height={44}
        className="rounded-full object-cover shrink-0"
        style={ringStyle}
      />
    );
  }

  return (
    <div
      className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-display font-bold text-[17px] select-none"
      style={{
        background: `linear-gradient(135deg, ${tokens.brand.accent}18 0%, ${tokens.brand.accentSoft}26 100%)`,
        border: `2px solid ${tokens.brand.accent}22`,
        color: tokens.brand.accent,
        boxShadow: `0 0 0 4px ${tokens.brand.accent}08`,
      }}
    >
      {firstName.charAt(0).toUpperCase()}
    </div>
  );
}

export default function OwnerProfileTile({ profile, index = 0 }: Props) {
  const { firstName, avatarUrl, planTier, clientCount, mrr } = profile;

  return (
    <BentoTile
      title="My agency"
      icon={<UserPlus size={14} />}
      span="lg:col-span-4 lg:row-span-1"
      link={{ href: "/dashboard/settings/profile", label: "Profile" }}
      index={index}
    >
      <div className="flex flex-col gap-4">
        {/* Profile row */}
        <div className="flex items-center gap-3 min-w-0">
          <AvatarCircle firstName={firstName} avatarUrl={avatarUrl} />

          <div className="flex-1 min-w-0">
            <p
              className="font-semibold text-[14px] truncate leading-tight"
              style={{ color: themeTokens.text.primary }}
            >
              {firstName}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Plan badge */}
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none"
                style={{
                  background: `${tokens.brand.accent}12`,
                  color: tokens.brand.accent,
                  border: `1px solid ${tokens.brand.accent}22`,
                }}
              >
                {planLabel(planTier)}
              </span>
              {/* Client count */}
              <span
                className="text-[11px] tabular-nums"
                style={{ color: themeTokens.text.muted }}
              >
                {clientCount} client{clientCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* MRR badge — right-anchored */}
          <div className="text-right shrink-0">
            <span
              className="block font-display text-[16px] font-semibold tabular-nums leading-tight"
              style={{ color: tokens.brand.accent }}
            >
              {fmtMrr(mrr)}
            </span>
            <span
              className="text-[9px] uppercase tracking-[0.8px] font-medium"
              style={{ color: themeTokens.text.muted }}
            >
              MRR
            </span>
          </div>
        </div>

        {/* Quick-action strip */}
        <div className="grid grid-cols-3 gap-2">
          {QUICK.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all duration-220"
              style={{
                background: themeTokens.bg.surface2,
                border: `1px solid ${tokens.border.subtle}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = themeTokens.bg.surface3;
                e.currentTarget.style.borderColor = tokens.border.strong;
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = themeTokens.bg.surface2;
                e.currentTarget.style.borderColor = tokens.border.subtle;
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <action.Icon
                size={15}
                style={{ color: tokens.brand.lime }}
                className="transition-transform group-hover:scale-110"
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: themeTokens.text.secondary }}
              >
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </BentoTile>
  );
}
