"use client";

import {
  SiMailchimp,
  SiHubspot,
  SiCanva,
  SiBuffer,
  SiAsana,
  SiCalendly,
  SiLoom,
  SiZapier,
  SiSlack,
  SiClickup,
} from "react-icons/si";
import { Building2, Search, FileSignature, BarChart3 } from "lucide-react";
import type { IconType } from "react-icons";
import type { LucideIcon } from "lucide-react";
import { BRAND } from "@/lib/brand-config";
import Reveal from "./reveal";
import SectionHeading from "./section-heading";

interface Tool {
  name: string;
  category: string;
  saved: number;
  Icon: IconType | LucideIcon;
  /** Brand color for the badge background. */
  color: string;
}

// Each tool ShortStack replaces, with the actual brand mark when available
// and a recognisable category icon when the tool doesn't ship a public glyph
// (GoHighLevel, Apollo, PandaDoc, AgencyAnalytics).
const TOOLS: Tool[] = [
  { name: "GoHighLevel", category: "CRM & Automation", saved: 97, Icon: Building2, color: "#FF6E2A" },
  { name: "Apollo", category: "Lead Scraping", saved: 99, Icon: Search, color: "#0073E6" },
  { name: "Mailchimp", category: "Email Outreach", saved: 50, Icon: SiMailchimp, color: "#FFE01B" },
  { name: "HubSpot", category: "Client Management", saved: 45, Icon: SiHubspot, color: "#FF7A59" },
  { name: "Canva Pro", category: "Design Assets", saved: 13, Icon: SiCanva, color: "#00C4CC" },
  { name: "Buffer", category: "Social Scheduling", saved: 25, Icon: SiBuffer, color: "#168EEA" },
  { name: "PandaDoc", category: "Contracts & e-Sign", saved: 35, Icon: FileSignature, color: "#22C55E" },
  { name: "ClickUp", category: "Project Management", saved: 12, Icon: SiClickup, color: "#7B68EE" },
  { name: "Asana", category: "Project Tracking", saved: 11, Icon: SiAsana, color: "#F06A6A" },
  { name: "Calendly", category: "Scheduling", saved: 12, Icon: SiCalendly, color: "#006BFF" },
  { name: "Loom", category: "Client Updates", saved: 15, Icon: SiLoom, color: "#625DF5" },
  { name: "Zapier", category: "Integrations", saved: 29, Icon: SiZapier, color: "#FF4F00" },
  { name: "Slack Premium", category: "Team Comms", saved: 8, Icon: SiSlack, color: "#4A154B" },
  { name: "AgencyAnalytics", category: "Reporting", saved: 59, Icon: BarChart3, color: "#0EA5E9" },
];

const TOTAL_SAVED = TOOLS.reduce((sum, t) => sum + t.saved, 0);

export default function ReplaceStack() {
  return (
    <section
      className="py-20 md:py-28 px-6"
      style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
    >
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <SectionHeading
            eyebrow="One platform, not fourteen"
            title="Cancel these subscriptions."
            subtitle={`Here's the math most agencies run in a Saturday-morning panic. ${BRAND.product_name} replaces these with a single platform — and that's before counting the hours your team saves not re-keying data across a dozen tabs.`}
            className="mb-14"
          />
        </Reveal>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {TOOLS.map((tool, i) => (
            <Reveal key={tool.name} delay={0.04 * i}>
              <ToolCard tool={tool} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.5}>
          <div
            className="text-center mt-10 py-7 rounded-2xl relative overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(200,168,85,0.08), rgba(226,200,120,0.04))",
              border: "1px solid rgba(200,168,85,0.18)",
            }}
          >
            {/* Soft glow */}
            <div
              className="absolute inset-0 -z-0 opacity-40 blur-3xl pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at 30% 50%, rgba(200,168,85,0.18) 0%, transparent 60%)",
              }}
            />
            <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1.5 relative">
              Typical agency monthly bill
            </p>
            <p
              className="text-4xl md:text-5xl font-extrabold mb-2 relative"
              style={{
                background:
                  "linear-gradient(135deg, #c8a855, #e2c878 60%, #fff8e1)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              ${TOTAL_SAVED}+ saved / month
            </p>
            <p className="text-sm text-gray-400 relative">
              That&apos;s <span className="text-white font-semibold">${TOTAL_SAVED * 12}+ a year</span>{" "}
              back in your pocket — without counting the hours you stop losing
              between {TOOLS.length} different logins.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  const { name, category, saved, Icon, color } = tool;
  return (
    <div
      className="rounded-xl p-4 transition-all duration-300 hover:-translate-y-0.5 relative overflow-hidden group"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Cross-out diagonal line on hover-reveal */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, transparent 48%, rgba(239,68,68,0.4) 49%, rgba(239,68,68,0.4) 51%, transparent 52%)",
        }}
      />

      <div className="flex items-start gap-3 relative">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 grayscale opacity-50"
          style={{
            background: `${color}14`,
            border: `1px solid ${color}30`,
          }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white line-through opacity-60 truncate">
            {name}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5 truncate">{category}</p>
          <p
            className="text-[10px] font-bold mt-1.5"
            style={{ color: "#10b981" }}
          >
            Save ${saved}/mo
          </p>
        </div>
      </div>
    </div>
  );
}
