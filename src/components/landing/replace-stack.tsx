"use client";

import { BRAND } from "@/lib/brand-config";
import Reveal from "./reveal";
import SectionHeading from "./section-heading";

const TOOLS = [
  { tool: "GoHighLevel", for: "CRM & Automation", saved: "$97/mo" },
  { tool: "Apollo / ZoomInfo", for: "Lead Scraping", saved: "$99/mo" },
  { tool: "Mailchimp / SendGrid", for: "Email Outreach", saved: "$50/mo" },
  { tool: "HubSpot", for: "Client Management", saved: "$45/mo" },
  { tool: "Canva Pro", for: "Design Assets", saved: "$13/mo" },
  { tool: "Later / Buffer", for: "Social Scheduling", saved: "$25/mo" },
  { tool: "PandaDoc", for: "Contracts & e-Sign", saved: "$35/mo" },
  { tool: "ClickUp / Asana", for: "Project Management", saved: "$12/mo" },
  { tool: "Calendly", for: "Scheduling", saved: "$12/mo" },
  { tool: "Loom", for: "Client Updates", saved: "$15/mo" },
  { tool: "Zapier", for: "Integrations", saved: "$29/mo" },
  { tool: "AgencyAnalytics", for: "Reporting", saved: "$59/mo" },
];

export default function ReplaceStack() {
  return (
    <section
      className="py-20 md:py-28 px-6"
      style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
    >
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <SectionHeading
            eyebrow="One platform, not twelve"
            title="Cancel these subscriptions."
            subtitle={`Here's the math most agencies run in a Saturday-morning panic. ${BRAND.product_name} replaces these with a single platform — and that's before counting the hours your team saves not re-keying data across 12 tabs.`}
            className="mb-14"
          />
        </Reveal>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {TOOLS.map((item, i) => (
            <Reveal key={item.tool} delay={0.04 * i}>
              <div
                className="rounded-xl p-4 text-center transition-all hover:-translate-y-0.5"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <p className="text-xs font-semibold text-white line-through opacity-60">
                  {item.tool}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">{item.for}</p>
                <p
                  className="text-[10px] font-bold mt-1.5"
                  style={{ color: "#10b981" }}
                >
                  Save {item.saved}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.4}>
          <div
            className="text-center mt-10 py-5 rounded-xl"
            style={{
              background: "rgba(200,168,85,0.04)",
              border: "1px solid rgba(200,168,85,0.1)",
            }}
          >
            <p className="text-sm text-gray-300">
              Typical savings:{" "}
              <span
                className="font-bold"
                style={{ color: "#c8a855" }}
              >
                $491+/mo
              </span>{" "}
              compared to running the same capabilities on separate tools.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
