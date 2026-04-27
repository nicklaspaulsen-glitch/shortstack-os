"use client";

import { PhoneCall } from "lucide-react";
import { tokens } from "@/lib/brand/tokens";
import { formatRelativeTime } from "@/lib/utils";
import { BentoTile, BentoEmpty } from "./bento-tile";
import type { VoiceCallRow } from "./types";

interface Props {
  calls: VoiceCallRow[];
  index?: number;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds < 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${mins}m ${rem.toString().padStart(2, "0")}s`;
}

function formatPhone(num: string | null): string {
  if (!num) return "Unknown";
  // Light formatting: strip leading + and pad with -
  const cleaned = num.replace(/^\+/, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return num;
}

function outcomeColor(outcome: string | null): string {
  const o = (outcome || "").toLowerCase();
  if (o.includes("book") || o.includes("interested") || o.includes("hot")) return tokens.brand.lime;
  if (o.includes("voicemail") || o.includes("nointerest")) return tokens.text.muted;
  if (o.includes("decline") || o.includes("dnc") || o.includes("hostile")) return tokens.status.error;
  return tokens.text.secondary;
}

export default function RecentCallsTile({ calls, index = 0 }: Props) {
  return (
    <BentoTile
      title="Recent calls"
      icon={<PhoneCall size={14} />}
      span="lg:col-span-4 lg:row-span-1"
      link={{ href: "/dashboard/voice-receptionist", label: "All calls" }}
      index={index}
    >
      {calls.length === 0 ? (
        <BentoEmpty
          copy="No calls yet — connect Twilio to let Echo answer your inbound line."
          cta={{ label: "Set up voice", href: "/dashboard/voice-receptionist" }}
        />
      ) : (
        <ul className="space-y-1.5">
          {calls.map((call) => (
            <li
              key={call.id}
              className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0"
              style={{ borderColor: tokens.border.subtle }}
            >
              <div className="min-w-0 flex-1">
                <p
                  className="text-[12px] font-medium truncate"
                  style={{ color: tokens.text.primary }}
                >
                  {formatPhone(call.from_number) || formatPhone(call.to_number)}
                </p>
                <p
                  className="text-[10px]"
                  style={{ color: tokens.text.muted }}
                >
                  {formatDuration(call.duration_seconds)}
                  <span className="mx-1.5 opacity-30">·</span>
                  {formatRelativeTime(call.started_at)}
                </p>
              </div>
              {call.outcome && (
                <span
                  className="shrink-0 text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    color: outcomeColor(call.outcome),
                    background: `${outcomeColor(call.outcome)}1a`,
                    border: `1px solid ${outcomeColor(call.outcome)}33`,
                  }}
                >
                  {call.outcome.replace(/_/g, " ")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </BentoTile>
  );
}

