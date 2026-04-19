"use client";

import { FileBarChart, Plug, Wand2 } from "lucide-react";
import Reveal from "./reveal";
import SectionHeading from "./section-heading";

const STEPS = [
  {
    num: "01",
    title: "Connect your accounts",
    description:
      "Plug in Stripe, Meta, Google, TikTok, LinkedIn, Calendly, your email, and anything else you already use. Takes ~10 minutes, most of which is clicking OAuth buttons.",
    icon: Plug,
  },
  {
    num: "02",
    title: "AI handles the busywork",
    description:
      "Outreach sequences send themselves. Content gets drafted and queued. Leads flow into your CRM. Proposals get sent. Invoices get paid. You're the strategist, not the assembly line.",
    icon: Wand2,
  },
  {
    num: "03",
    title: "Clients see clean reports",
    description:
      "Each client gets a branded portal with live KPIs, deliverables, and a weekly report they can forward. No more \"what did you do this week?\" emails on Friday.",
    icon: FileBarChart,
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-20 md:py-28 px-6"
      style={{
        background:
          "linear-gradient(180deg, rgba(200,168,85,0.02) 0%, transparent 100%)",
      }}
    >
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <SectionHeading
            eyebrow="Simple setup"
            title="Up and running in an afternoon"
            subtitle="No month-long implementation. No 6-figure onboarding fee. Connect your accounts, pick your automations, and the system starts earning its keep same week."
            className="mb-16"
          />
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <Reveal key={step.num} delay={0.15 * i}>
              <div className="relative text-center">
                {i < STEPS.length - 1 && (
                  <div
                    className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(200,168,85,0.2), rgba(200,168,85,0.05))",
                    }}
                  />
                )}

                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 relative"
                  style={{
                    background: "rgba(200,168,85,0.06)",
                    border: "1px solid rgba(200,168,85,0.12)",
                  }}
                >
                  <step.icon size={28} style={{ color: "#c8a855" }} />
                  <span
                    className="absolute -top-2 -right-2 text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center"
                    style={{
                      background: "#c8a855",
                      color: "#0b0d12",
                    }}
                  >
                    {step.num}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
