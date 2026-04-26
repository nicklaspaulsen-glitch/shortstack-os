"use client";

import {
  FileBarChart,
  Plug,
  Wand2,
  Phone,
  Sparkles,
  Zap,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import {
  SiStripe,
  SiMeta,
  SiGoogleads,
  SiTiktok,
  SiOpenai,
} from "react-icons/si";
import Reveal from "./reveal";
import SectionHeading from "./section-heading";

interface Step {
  num: string;
  title: string;
  description: string;
  icon: typeof Plug;
}

const STEPS: Step[] = [
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
      className="py-20 md:py-28 px-6 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, rgba(200,168,85,0.02) 0%, transparent 100%)",
      }}
    >
      {/* Ambient glow blob */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-30 pointer-events-none blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(200,168,85,0.15) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-6xl mx-auto relative">
        <Reveal>
          <SectionHeading
            eyebrow="Simple setup"
            title="Up and running in an afternoon"
            subtitle="No month-long implementation. No 6-figure onboarding fee. Connect your accounts, pick your automations, and the system starts earning its keep same week."
            className="mb-16"
          />
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-5">
          {STEPS.map((step, i) => (
            <Reveal key={step.num} delay={0.15 * i}>
              <StepCard step={step} idx={i} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepCard({ step, idx }: { step: Step; idx: number }) {
  return (
    <div
      className="relative h-full flex flex-col rounded-2xl p-6 md:p-7 transition-all duration-500 hover:-translate-y-1 group"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Number bubble */}
      <div className="flex items-center justify-between mb-5">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            background: "rgba(200,168,85,0.08)",
            border: "1px solid rgba(200,168,85,0.18)",
          }}
        >
          <step.icon size={20} style={{ color: "#c8a855" }} />
        </div>
        <span
          className="text-3xl font-extrabold opacity-30 group-hover:opacity-60 transition-opacity"
          style={{ color: "#c8a855" }}
        >
          {step.num}
        </span>
      </div>

      <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed mb-5 flex-1">
        {step.description}
      </p>

      {/* Step-specific visual mock */}
      <StepVisual idx={idx} />
    </div>
  );
}

function StepVisual({ idx }: { idx: number }) {
  if (idx === 0) {
    // Step 1: integration logos lighting up one by one
    return (
      <div
        className="rounded-xl p-3 mt-auto"
        style={{
          background: "rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 px-1">
          Connecting…
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {[
            { Icon: SiStripe, color: "#635BFF", delay: 0 },
            { Icon: SiMeta, color: "#0866FF", delay: 0.4 },
            { Icon: SiGoogleads, color: "#4285F4", delay: 0.8 },
            { Icon: SiTiktok, color: "#FFFFFF", delay: 1.2 },
            { Icon: SiOpenai, color: "#FFFFFF", delay: 1.6 },
          ].map((item, i) => (
            <div
              key={i}
              className="aspect-square rounded-md flex items-center justify-center"
              style={{
                background: `${item.color}10`,
                border: `1px solid ${item.color}28`,
                animation: `oauth-pulse 4s ease-in-out infinite`,
                animationDelay: `${item.delay}s`,
              }}
            >
              <item.Icon size={14} style={{ color: item.color }} />
            </div>
          ))}
        </div>
        <style jsx>{`
          @keyframes oauth-pulse {
            0%,
            100% {
              opacity: 0.3;
              transform: scale(0.95);
            }
            20%,
            70% {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
      </div>
    );
  }

  if (idx === 1) {
    // Step 2: a simulated agent pipeline ticking through tasks
    return (
      <div
        className="rounded-xl p-3 mt-auto space-y-1.5"
        style={{
          background: "rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {[
          { Icon: Sparkles, label: "AI drafted 12 cold emails", color: "#c8a855", delay: 0 },
          { Icon: Phone, label: "AI booked 3 meetings", color: "#10b981", delay: 0.5 },
          { Icon: Zap, label: "Lead enriched + scored", color: "#3b82f6", delay: 1 },
        ].map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-[10.5px] text-gray-300 px-2 py-1.5 rounded-md"
            style={{
              background: "rgba(255,255,255,0.02)",
              animation: "task-fade-in 4s ease-in-out infinite",
              animationDelay: `${item.delay}s`,
            }}
          >
            <item.Icon size={11} style={{ color: item.color }} />
            <span className="flex-1 truncate">{item.label}</span>
            <CheckCircle2 size={10} style={{ color: "#10b981" }} />
          </div>
        ))}
        <style jsx>{`
          @keyframes task-fade-in {
            0%,
            100% {
              opacity: 0.4;
            }
            25%,
            65% {
              opacity: 1;
            }
          }
        `}</style>
      </div>
    );
  }

  // Step 3: mini KPI dashboard with sparkline-ish bars
  return (
    <div
      className="rounded-xl p-3 mt-auto"
      style={{
        background: "rgba(0,0,0,0.3)",
        border: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-gray-500">
          Client weekly
        </p>
        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
          <TrendingUp size={9} /> +18%
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1 h-8 items-end">
        {[40, 55, 35, 70, 50, 85, 95].map((h, i) => (
          <div
            key={i}
            className="rounded-t-sm"
            style={{
              height: `${h}%`,
              background:
                i === 6
                  ? "linear-gradient(180deg, #c8a855, #a08642)"
                  : "rgba(200,168,85,0.25)",
              animation: "bar-grow 1.4s ease-out forwards",
              animationDelay: `${i * 0.08}s`,
              transformOrigin: "bottom",
              transform: "scaleY(0)",
            }}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5 mt-2.5">
        {[
          { label: "Leads", value: "84" },
          { label: "Booked", value: "12" },
          { label: "Posts", value: "37" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="text-center px-1 py-1 rounded"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <p className="text-xs font-bold text-white">{stat.value}</p>
            <p className="text-[9px] text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes bar-grow {
          to {
            transform: scaleY(1);
          }
        }
      `}</style>
    </div>
  );
}
