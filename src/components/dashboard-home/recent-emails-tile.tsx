"use client";

import { Mail } from "lucide-react";
import { tokens } from "@/lib/brand/tokens";
import { formatRelativeTime } from "@/lib/utils";
import { BentoTile, BentoEmpty } from "./bento-tile";
import type { OutreachEmailRow } from "./types";

interface Props {
  emails: OutreachEmailRow[];
  index?: number;
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "replied") return tokens.brand.lime;
  if (s === "opened" || s === "clicked") return tokens.status.success;
  if (s === "bounced" || s === "failed") return tokens.status.error;
  if (s === "queued" || s === "pending") return tokens.status.warning;
  return tokens.text.secondary;
}

export default function RecentEmailsTile({ emails, index = 0 }: Props) {
  return (
    <BentoTile
      title="Recent emails"
      icon={<Mail size={14} />}
      span="lg:col-span-4 lg:row-span-1"
      link={{ href: "/dashboard/conversations", label: "Inbox" }}
      index={index}
    >
      {emails.length === 0 ? (
        <BentoEmpty
          copy="No outbound email yet — connect Resend or SMTP to start sending."
          cta={{ label: "Connect email", href: "/dashboard/settings" }}
        />
      ) : (
        <ul className="space-y-1.5">
          {emails.map((email) => (
            <li
              key={email.id}
              className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0"
              style={{ borderColor: tokens.border.subtle }}
            >
              <div className="min-w-0 flex-1">
                <p
                  className="text-[12px] font-medium truncate"
                  style={{ color: tokens.text.primary }}
                >
                  {email.subject || "(no subject)"}
                </p>
                <p
                  className="text-[10px] truncate"
                  style={{ color: tokens.text.muted }}
                >
                  {email.recipient || "Unknown"}
                  <span className="mx-1.5 opacity-30">·</span>
                  {formatRelativeTime(email.sent_at)}
                </p>
              </div>
              <span
                className="shrink-0 text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  color: statusColor(email.status),
                  background: `${statusColor(email.status)}1a`,
                  border: `1px solid ${statusColor(email.status)}33`,
                }}
              >
                {email.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </BentoTile>
  );
}
