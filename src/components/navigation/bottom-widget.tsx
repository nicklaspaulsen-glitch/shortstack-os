"use client";
import { Gear } from "@phosphor-icons/react";

import Link from "next/link";

import { useAuth } from "@/lib/auth-context";

/**
 * BottomWidget — fixed bottom-left corner account chip.
 * Shows avatar initials, display name, role, and settings shortcut.
 * Mirrors the `.corner-widget` from the reference design.
 */
export default function BottomWidget() {
  const { profile } = useAuth();

  const initials = profile
    ? `${profile.full_name?.split(" ")[0]?.[0] ?? ""}${profile.full_name?.split(" ")[1]?.[0] ?? ""}`.toUpperCase() || "U"
    : "U";

  const displayName = profile?.full_name ?? "User";
  const role = profile?.role === "admin" ? "Owner" : profile?.role === "team_member" ? "Team" : "Client";

  return (
    <div className="corner-widget" aria-label="Account">
      {/* Avatar */}
      <div className="corner-avatar" aria-hidden="true">
        {initials}
      </div>

      {/* Name + role */}
      <div className="corner-info" aria-label={`${displayName}, ${role}`}>
        <span className="corner-name">{displayName}</span>
        <span className="corner-role">{role}</span>
      </div>

      {/* Gear cog */}
      <Link
        href="/dashboard/settings"
        className="corner-cog"
        aria-label="Gear"
        title="Gear"
      >
        <Gear size={13} strokeWidth={1.8} />
      </Link>
    </div>
  );
}
