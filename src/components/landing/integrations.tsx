"use client";

import {
  SiStripe,
  SiMeta,
  SiGoogleads,
  SiTiktok,
  SiGooglechrome,
  SiNotion,
  SiGmail,
  SiOpenai,
  SiSupabase,
  SiTwilio,
  SiCalendly,
  SiSlack,
  SiZapier,
  SiHubspot,
  SiDiscord,
  SiYoutube,
  SiInstagram,
  SiX,
  SiWhatsapp,
} from "react-icons/si";
import { FaLinkedin } from "react-icons/fa";
import type { IconType } from "react-icons";
import { BRAND } from "@/lib/brand-config";
import Reveal from "./reveal";
import SectionHeading from "./section-heading";

interface Integration {
  name: string;
  Icon: IconType;
  /** Hex color of the brand glyph. */
  color: string;
}

// Curated list — recognisable brand glyphs only. Order matters: each row
// should mix categories so the marquee feels rich rather than blocky.
const INTEGRATIONS: Integration[] = [
  { name: "Stripe", Icon: SiStripe, color: "#635BFF" },
  { name: "Meta Ads", Icon: SiMeta, color: "#0866FF" },
  { name: "Google Ads", Icon: SiGoogleads, color: "#4285F4" },
  { name: "TikTok", Icon: SiTiktok, color: "#FFFFFF" },
  { name: "LinkedIn", Icon: FaLinkedin, color: "#0A66C2" },
  { name: "Instagram", Icon: SiInstagram, color: "#E4405F" },
  { name: "YouTube", Icon: SiYoutube, color: "#FF0000" },
  { name: "X", Icon: SiX, color: "#FFFFFF" },
  { name: "Notion", Icon: SiNotion, color: "#FFFFFF" },
  { name: "Gmail", Icon: SiGmail, color: "#EA4335" },
  { name: "OpenAI", Icon: SiOpenai, color: "#FFFFFF" },
  { name: "Twilio", Icon: SiTwilio, color: "#F22F46" },
  { name: "Supabase", Icon: SiSupabase, color: "#3ECF8E" },
  { name: "Calendly", Icon: SiCalendly, color: "#006BFF" },
  { name: "Slack", Icon: SiSlack, color: "#4A154B" },
  { name: "Zapier", Icon: SiZapier, color: "#FF4F00" },
  { name: "HubSpot", Icon: SiHubspot, color: "#FF7A59" },
  { name: "Discord", Icon: SiDiscord, color: "#5865F2" },
  { name: "WhatsApp", Icon: SiWhatsapp, color: "#25D366" },
  { name: "Google", Icon: SiGooglechrome, color: "#FFFFFF" },
];

/**
 * Two infinite-scrolling rows moving in opposite directions, with a soft
 * gradient mask on the edges so logos fade in/out instead of clipping.
 * Pure CSS — no JS animation loop, no scroll listener, no perf cost.
 */
export default function Integrations() {
  // Duplicate so the loop is seamless. CSS translate -50% lands on the
  // boundary of the second copy, then snaps back to 0 invisibly.
  const row = INTEGRATIONS;
  const rowRev = [...INTEGRATIONS].reverse();

  return (
    <section
      className="py-20 md:py-28 px-6 overflow-hidden"
      style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
    >
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <SectionHeading
            eyebrow="Plays well with everything"
            title="20+ integrations. One platform."
            subtitle={`${BRAND.product_name} talks to the platforms agencies actually run on — Stripe, Meta, Google, TikTok, LinkedIn, OpenAI, Twilio, and the rest. Native integrations ship with the product. No paying for a third-party iPaaS to glue it together.`}
            className="mb-14"
          />
        </Reveal>
      </div>

      {/* Scrolling marquee — full-bleed so logos stream off the edges */}
      <div className="relative">
        {/* Edge fade masks */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 md:w-48"
          style={{ background: "linear-gradient(to right, #0b0d12, transparent)" }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 md:w-48"
          style={{ background: "linear-gradient(to left, #0b0d12, transparent)" }}
        />

        <Marquee items={row} duration="50s" />
        <div className="h-3" />
        <Marquee items={rowRev} duration="65s" reverse />
      </div>

      <div className="max-w-6xl mx-auto mt-12">
        <Reveal delay={0.2}>
          <p className="text-center text-xs text-gray-500">
            …and new integrations ship every month. Need one? Tell us — we
            build the ones our customers actually ask for.
          </p>
        </Reveal>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        @keyframes marquee-reverse {
          0% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(0);
          }
        }
      `}</style>
    </section>
  );
}

function Marquee({
  items,
  duration,
  reverse = false,
}: {
  items: Integration[];
  duration: string;
  reverse?: boolean;
}) {
  return (
    <div className="flex w-full overflow-hidden">
      <div
        className="flex shrink-0 gap-3 md:gap-4 pr-3 md:pr-4 hover:[animation-play-state:paused]"
        style={{
          animation: `${reverse ? "marquee-reverse" : "marquee"} ${duration} linear infinite`,
        }}
      >
        {[...items, ...items].map((integration, idx) => (
          <IntegrationChip key={`${integration.name}-${idx}`} integration={integration} />
        ))}
      </div>
    </div>
  );
}

function IntegrationChip({ integration }: { integration: Integration }) {
  const { name, Icon, color } = integration;
  return (
    <div
      className="group flex items-center gap-3 rounded-xl px-4 md:px-5 py-3 md:py-3.5 shrink-0 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        minWidth: 170,
      }}
    >
      <div
        className="w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center transition-all"
        style={{
          background: `${color}14`,
          border: `1px solid ${color}30`,
        }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <span className="text-[13px] font-semibold text-white whitespace-nowrap">
        {name}
      </span>
    </div>
  );
}
