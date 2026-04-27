"use client";

import Link from "next/link";
import { Calendar, Mail, PhoneCall, Sparkles, UserPlus, Workflow, Zap } from "lucide-react";
import { tokens } from "@/lib/brand/tokens";
import { BentoTile } from "./bento-tile";

/**
 * QuickActionsGrid — 6 icon-button tiles in a 3x2 inner grid.
 *
 * Each tile is a static link to a known route. No data fetching — this is
 * the "I want to start something" surface. The icons are lucide-react;
 * hover state lifts the card and brightens the lime border.
 */
interface Action {
  href: string;
  label: string;
  Icon: typeof Zap;
}

const ACTIONS: Action[] = [
  { href: "/dashboard/leads/new", label: "New lead", Icon: UserPlus },
  { href: "/dashboard/conversations", label: "Send email", Icon: Mail },
  { href: "/dashboard/voice-receptionist", label: "Make call", Icon: PhoneCall },
  { href: "/dashboard/calendar", label: "Schedule", Icon: Calendar },
  { href: "/dashboard/social-studio", label: "Generate post", Icon: Sparkles },
  { href: "/dashboard/automations", label: "Run workflow", Icon: Workflow },
];

interface Props {
  index?: number;
}

export default function QuickActionsGrid({ index = 0 }: Props) {
  return (
    <BentoTile
      title="Quick actions"
      icon={<Zap size={14} />}
      span="lg:col-span-4 lg:row-span-1"
      index={index}
    >
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all duration-220"
            style={{
              background: tokens.bg.surface2,
              border: `1px solid ${tokens.border.subtle}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.bg.surface3;
              e.currentTarget.style.borderColor = tokens.border.strong;
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = tokens.bg.surface2;
              e.currentTarget.style.borderColor = tokens.border.subtle;
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <action.Icon
              size={16}
              style={{ color: tokens.brand.lime }}
              className="transition-transform group-hover:scale-110"
            />
            <span
              className="text-[10px] font-medium text-center"
              style={{ color: tokens.text.secondary }}
            >
              {action.label}
            </span>
          </Link>
        ))}
      </div>
    </BentoTile>
  );
}

