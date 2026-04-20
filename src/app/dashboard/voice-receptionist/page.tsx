"use client";

import { PhoneCall } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function VoiceReceptionistPage() {
  return (
    <ComingSoon
      title="AI Voice Receptionist"
      tagline="A 24/7 phone agent that books calls, qualifies leads, and never misses a ring."
      icon={PhoneCall}
      eta="~4 weeks"
      features={[
        "ElevenLabs voice clone — sounds like your best salesperson",
        "Always-on answering with zero hold times, even at 3am",
        "Books qualified calls directly into your connected calendar",
        "Screens spam callers and logs every call transcript to CRM",
        "Custom script per business line (support vs. sales vs. triage)",
        "SMS follow-up sent automatically after every missed call",
      ]}
      alternatives={[
        { label: "ElevenAgents", href: "/dashboard/eleven-agents" },
        { label: "Phone / Email", href: "/dashboard/phone-email" },
        { label: "Calendar", href: "/dashboard/calendar" },
      ]}
      gradient={["#2c1a55", "#1a1033"]}
    />
  );
}
