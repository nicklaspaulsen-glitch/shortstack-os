"use client";

import { Phone, Mail, MessageSquare, Send } from "lucide-react";
import type { OutreachChannel } from "@/lib/outreach/types";

interface ChannelIconProps {
  channel: OutreachChannel;
  size?: number;
  className?: string;
}

export default function ChannelIcon({ channel, size = 14, className = "" }: ChannelIconProps) {
  switch (channel) {
    case "voice_call":
      return <Phone size={size} className={`text-amber-300 ${className}`} />;
    case "email":
      return <Mail size={size} className={`text-sky-300 ${className}`} />;
    case "sms":
      return <MessageSquare size={size} className={`text-emerald-300 ${className}`} />;
    case "dm":
      return <Send size={size} className={`text-pink-300 ${className}`} />;
  }
}
