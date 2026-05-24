"use client";
import { Chat, Envelope, PaperPlaneTilt, Phone } from "@phosphor-icons/react";


import type { OutreachChannel } from "@/lib/outreach/types";

interface ChannelIconProps {
  channel: OutreachChannel;
  size?: number;
  className?: string;
}

export default function ChannelIcon({ channel, size = 14, className = "" }: ChannelIconProps) {
  switch (channel) {
    case "voice_call":
      return <Phone size={size} className={`text-amber-600 ${className}`} />;
    case "email":
      return <Envelope size={size} className={`text-sky-600 ${className}`} />;
    case "sms":
      return <Chat size={size} className={`text-emerald-600 ${className}`} />;
    case "dm":
      return <PaperPlaneTilt size={size} className={`text-pink-600 ${className}`} />;
  }
}
