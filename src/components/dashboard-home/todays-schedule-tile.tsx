"use client";
import { Calendar, Chat, Sparkle, Users } from "@phosphor-icons/react";


import { tokens, themeTokens } from "@/lib/brand/tokens";
import { BentoTile, BentoEmpty } from "./bento-tile";
import type { ScheduledItem } from "./types";

interface Props {
  schedule: ScheduledItem[];
  index?: number;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function kindIcon(kind: ScheduledItem["kind"]) {
  switch (kind) {
    case "post":
      return <Sparkle size={11} />;
    case "meeting":
      return <Users size={11} />;
    case "calendar":
      return <Calendar size={11} />;
    default:
      return <Chat size={11} />;
  }
}

function kindColor(kind: ScheduledItem["kind"]): string {
  // Three visible, distinct hues on the light theme:
  //   post    → primary blue (brand accent)
  //   meeting → lighter sky-blue (accent soft)
  //   calendar → readable steel-gray
  // plumHover (#E4E4E7) was previously used for calendar — invisible on white.
  switch (kind) {
    case "post":
      return tokens.brand.lime;         // #D4FF00 (lime brand)
    case "meeting":
      return tokens.brand.accentSoft;   // #E8FF4D (lime hover)
    case "calendar":
      return tokens.text.secondary;     // #52525B — neutral gray
    default:
      return tokens.text.secondary;
  }
}

export default function TodaysScheduleTile({ schedule, index = 0 }: Props) {
  return (
    <BentoTile
      title="Today's schedule"
      icon={<Calendar size={14} />}
      span="lg:col-span-4 lg:row-span-2"
      link={{ href: "/dashboard/calendar", label: "Calendar" }}
      index={index}
    >
      {schedule.length === 0 ? (
        <BentoEmpty
          copy="Nothing on the calendar yet — schedule a post or book a meeting to start."
          cta={{ label: "Open calendar", href: "/dashboard/calendar" }}
        />
      ) : (
        <ol className="relative space-y-2.5 pl-5">
          {/* Vertical timeline rail */}
          <span
            className="absolute left-1.5 top-2 bottom-2 w-px"
            style={{ background: tokens.border.subtle }}
            aria-hidden
          />
          {schedule.map((item) => {
            const color = kindColor(item.kind);
            return (
              <li key={item.id} className="relative group">
                {/* Bullet on the rail */}
                <span
                  className="absolute -left-[18px] top-1.5 w-3 h-3 rounded-full flex items-center justify-center"
                  style={{
                    background: themeTokens.bg.base,
                    border: `1.5px solid ${color}`,
                    boxShadow: `0 0 8px ${color}66`,
                  }}
                  aria-hidden
                >
                  <span style={{ color }}>{kindIcon(item.kind)}</span>
                </span>
                <div className="flex items-baseline gap-2 min-w-0">
                  <span
                    className="text-[10px] font-mono font-medium tabular-nums shrink-0"
                    style={{ color: themeTokens.text.muted }}
                  >
                    {formatTime(item.scheduled_at)}
                  </span>
                  <p
                    className="text-[12px] font-medium truncate"
                    style={{ color: themeTokens.text.primary }}
                  >
                    {item.title}
                  </p>
                </div>
                {item.detail && (
                  <p
                    className="text-[10px] mt-0.5 truncate"
                    style={{ color: themeTokens.text.muted }}
                  >
                    {item.detail}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </BentoTile>
  );
}
