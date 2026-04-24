"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, ChevronRight, Shield, Sparkles } from "lucide-react";
import { BRAND } from "@/lib/brand-config";

// Heavy (R3F + three) — pulled in only on the client, off the critical path.
const Hero3DScene = dynamic(() => import("./hero-3d-scene"), { ssr: false });

/**
 * Hero section: badge, headline, subhead, CTAs, and mock dashboard preview.
 */
export default function Hero() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(true);
  }, []);

  return (
    <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6 overflow-hidden">
      {/* 3D R3F scene — sits behind everything, pointer-events disabled inside */}
      <Hero3DScene />

      {/* Background glow effects */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(200,168,85,0.08) 0%, transparent 70%)",
          animation: "glow-pulse 4s ease-in-out infinite",
        }}
      />
      <div
        className="absolute top-20 right-0 w-[400px] h-[400px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute top-40 left-0 w-[300px] h-[300px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(168,137,61,0.05) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-5xl mx-auto text-center relative z-10">
        <div
          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 ${
            visible ? "animate-fade-up" : "opacity-0"
          }`}
          style={{
            background: "rgba(200,168,85,0.08)",
            border: "1px solid rgba(200,168,85,0.15)",
            color: "#c8a855",
          }}
        >
          <Sparkles size={12} />
          Built by agency operators, for agency operators
        </div>

        <h1
          className={`text-5xl md:text-7xl font-extrabold mb-6 leading-[1.05] tracking-tight ${
            visible ? "animate-fade-up delay-100" : "opacity-0"
          }`}
          style={{
            background:
              "linear-gradient(135deg, #ffffff 0%, #c8a855 50%, #ffffff 100%)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: visible
              ? "fade-up 0.7s ease-out 0.1s forwards, gradient-shift 6s ease-in-out infinite"
              : "none",
            opacity: 0,
            letterSpacing: "-0.03em",
          }}
        >
          The operating system
          <br />
          that replaces 15 agency SaaS tools.
        </h1>

        <p
          className={`text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed ${
            visible ? "animate-fade-up delay-200" : "opacity-0"
          }`}
          style={{ opacity: 0 }}
        >
          {BRAND.product_name} is the all-in-one command center for digital
          marketing agencies. Lead scraping, AI outreach and calls, content
          generation and publishing, CRM, proposals, contracts, billing, and
          white-label client portals — in one platform your clients will
          actually brag about.
        </p>

        <div
          className={`flex flex-col sm:flex-row items-center justify-center gap-4 ${
            visible ? "animate-fade-up delay-300" : "opacity-0"
          }`}
          style={{ opacity: 0 }}
        >
          <Link
            href="/pricing"
            className="group flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all hover:shadow-lg"
            style={{
              background: "linear-gradient(135deg, #c8a855, #b89840)",
              color: "#0b0d12",
              boxShadow: "0 0 30px rgba(200,168,85,0.15)",
            }}
          >
            Start your 7-day free trial
            <ArrowRight
              size={16}
              className="group-hover:translate-x-0.5 transition-transform"
            />
          </Link>
          <Link
            href="/book"
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm text-white transition-all hover:border-white/20"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Book a demo
            <ChevronRight size={16} className="text-gray-500" />
          </Link>
        </div>

        <div
          className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-xs text-gray-500 ${
            visible ? "animate-fade-up delay-400" : "opacity-0"
          }`}
          style={{ opacity: 0 }}
        >
          <div className="flex items-center gap-1.5">
            <Shield size={12} style={{ color: "#c8a855" }} />
            No credit card required
          </div>
          <div className="flex items-center gap-1.5">
            <Shield size={12} style={{ color: "#c8a855" }} />
            Cancel anytime
          </div>
          <div className="flex items-center gap-1.5">
            <Shield size={12} style={{ color: "#c8a855" }} />
            You own your data
          </div>
        </div>

        {/* Hero visual — mock dashboard */}
        <div
          className={`relative mt-16 md:mt-24 mx-auto max-w-4xl ${
            visible ? "animate-fade-up delay-500" : "opacity-0"
          }`}
          style={{ opacity: 0 }}
        >
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              padding: "1px",
            }}
          >
            <div
              className="rounded-2xl px-8 py-10"
              style={{
                background:
                  "linear-gradient(180deg, rgba(200,168,85,0.03) 0%, rgba(11,13,18,1) 100%)",
              }}
            >
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
                <span className="text-[10px] text-gray-600 ml-2">
                  {BRAND.product_name} — Dashboard
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "Active Leads", val: "1,284", change: "+12%" },
                  { label: "Emails Sent", val: "8,432", change: "+28%" },
                  { label: "Deals Won", val: "47", change: "+8%" },
                  { label: "Revenue", val: "$124K", change: "+18%" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg p-3"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <p className="text-[9px] text-gray-600 mb-1">{s.label}</p>
                    <p className="text-lg font-bold text-white">{s.val}</p>
                    <p className="text-[9px] text-emerald-400">{s.change}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-end gap-1.5 h-24">
                {[40, 55, 35, 65, 80, 60, 75, 90, 70, 85, 95, 78].map(
                  (h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t transition-all"
                      style={{
                        height: `${h}%`,
                        background: `linear-gradient(180deg, rgba(200,168,85,${
                          0.3 + (h / 100) * 0.5
                        }) 0%, rgba(200,168,85,0.05) 100%)`,
                      }}
                    />
                  )
                )}
              </div>
            </div>

            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(200,168,85,0.03), transparent)",
                animation: "shimmer 3s ease-in-out infinite",
              }}
            />
          </div>

          <div
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse, rgba(200,168,85,0.1) 0%, transparent 70%)",
              filter: "blur(20px)",
            }}
          />
        </div>
      </div>
    </section>
  );
}
