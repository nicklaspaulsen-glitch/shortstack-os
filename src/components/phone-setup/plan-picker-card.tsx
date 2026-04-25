"use client";

/**
 * Plan Picker Card — sits at the top of /dashboard/phone-setup. Shows the
 * user's current plan tier, what's included, and the per-number cost so
 * they know exactly what they'll pay BEFORE running the buy wizard.
 *
 * GHL parity: GHL's number-purchase flow shows monthly cost, included
 * minutes, SMS cap, and overage rates upfront. This component matches.
 *
 * Loads usage from /api/usage/current (existing endpoint, no new backend).
 */

import { useEffect, useState } from "react";
import { Phone, MessageSquare, Mic, TrendingUp, Loader, Crown } from "lucide-react";

interface UsagePayload {
  plan_tier: string;
  usage: Record<string, number>;
  limits: Record<string, number | "unlimited">;
}

const TIER_FEATURES: Record<string, { numbers: string; minutes: string; sms: string; ai: string; perNumber: number }> = {
  Starter: {
    numbers: "1 number",
    minutes: "200 voice min/mo",
    sms: "500 SMS/mo",
    ai: "Standard AI receptionist",
    perNumber: 1,
  },
  Growth: {
    numbers: "3 numbers",
    minutes: "1,000 voice min/mo",
    sms: "2,500 SMS/mo",
    ai: "Premium AI receptionist + custom voice",
    perNumber: 1,
  },
  Pro: {
    numbers: "10 numbers",
    minutes: "5,000 voice min/mo",
    sms: "10,000 SMS/mo",
    ai: "Premium AI + voice cloning + multilingual",
    perNumber: 1,
  },
  Business: {
    numbers: "Unlimited numbers",
    minutes: "Unlimited voice min",
    sms: "Unlimited SMS",
    ai: "Enterprise AI + dedicated voices",
    perNumber: 1,
  },
};

export default function PlanPickerCard() {
  const [usage, setUsage] = useState<UsagePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/usage/current")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setUsage(data))
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl p-5 bg-card border border-border">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader size={14} className="animate-spin" /> Checking your plan…
        </div>
      </div>
    );
  }

  const tier = usage?.plan_tier || "Starter";
  const features = TIER_FEATURES[tier] || TIER_FEATURES.Starter;
  const numbersUsed = usage?.usage?.phone_numbers || 0;
  const numbersLimit = usage?.limits?.phone_numbers;
  const numbersDisplay =
    numbersLimit === "unlimited"
      ? `${numbersUsed} of unlimited`
      : `${numbersUsed} of ${numbersLimit ?? "?"}`;

  return (
    <section
      className="relative rounded-2xl p-5 md:p-6 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(168,85,247,0.06), rgba(168,85,247,0.02))",
        border: "1px solid rgba(168,85,247,0.2)",
      }}
    >
      {/* Ambient purple glow */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none blur-3xl opacity-30"
        style={{
          background:
            "radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%)",
        }}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, rgba(168,85,247,0.18), rgba(168,85,247,0.04))",
                border: "1px solid rgba(168,85,247,0.3)",
              }}
            >
              <Crown size={16} className="text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  Your {tier} plan
                </h2>
                <span
                  className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{
                    background: "rgba(168,85,247,0.14)",
                    color: "#d8b4fe",
                  }}
                >
                  Active
                </span>
              </div>
              <p className="text-[11.5px] text-muted">
                {numbersDisplay} numbers used
              </p>
            </div>
          </div>
          <a
            href="/dashboard/pricing"
            className="text-[11px] text-purple-300 hover:underline"
          >
            Upgrade →
          </a>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          {[
            { Icon: Phone, label: "Numbers", value: features.numbers },
            { Icon: Mic, label: "Voice", value: features.minutes },
            { Icon: MessageSquare, label: "SMS", value: features.sms },
            { Icon: TrendingUp, label: "AI", value: features.ai },
          ].map((row) => (
            <div
              key={row.label}
              className="rounded-lg p-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <row.Icon size={11} className="text-purple-300" />
                <p className="text-[9.5px] uppercase tracking-wider text-muted font-semibold">
                  {row.label}
                </p>
              </div>
              <p className="text-[12px] font-bold text-foreground leading-tight">
                {row.value}
              </p>
            </div>
          ))}
        </div>

        {/* Cost banner */}
        <div
          className="rounded-xl p-4 flex items-start gap-3"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex-1">
            <p className="text-[10.5px] uppercase tracking-wider text-muted font-semibold mb-1">
              Cost per new number
            </p>
            <p className="text-[12px] text-foreground">
              <span className="text-lg font-extrabold text-emerald-300">
                ${features.perNumber.toFixed(2)}/mo
              </span>{" "}
              billed by Twilio · included in your plan tier
            </p>
            <p className="text-[10.5px] text-muted mt-1">
              No setup fee · porting available · cancel any time
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
