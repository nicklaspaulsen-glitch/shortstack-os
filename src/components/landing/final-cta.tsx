"use client";

import Link from "next/link";
import { ArrowRight, Shield } from "lucide-react";
import { BRAND } from "@/lib/brand-config";
import Reveal from "./reveal";

export default function FinalCTA() {
  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-4xl mx-auto text-center relative">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse, rgba(255,255,255,0.07) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />

        <Reveal className="relative z-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-medium mb-6"
            style={{
              background: "rgba(212,255,0,0.10)",
              border: "1px solid rgba(212,255,0,0.25)",
              color: "#93C5FD",
            }}
          >
            <Shield size={10} />
            No credit card required · Cancel anytime
          </div>

          <h2
            className="text-3xl md:text-5xl font-extrabold text-white mb-5"
            style={{ letterSpacing: "-0.03em" }}
          >
            Run your agency on{" "}
            <span className="text-indigo-500">
              {BRAND.product_name}.
            </span>
          </h2>

          <p className="text-text-muted text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Start your 7-day free trial. If it doesn&apos;t replace at least
            three of your current tools in the first week, keep your old stack
            and we&apos;ll refund whatever you paid.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* GlassButton glow variant (Link-compatible) */}
            <Link
              href="/pricing"
              className="relative inline-flex items-center justify-center select-none font-semibold leading-none cursor-pointer shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#D4FF00]/50 transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] h-11 px-6 text-[13px] gap-2.5 rounded-[14px] bg-[#D4FF00] text-[#020711] border border-[rgba(212, 255, 0,0.40)] shadow-[0_0_0_1px_rgba(212,255,0,0.30),0_4px_20px_rgba(212,255,0,0.55),0_0_60px_rgba(212,255,0,0.20)] hover:shadow-[0_0_0_1px_rgba(212,255,0,0.50),0_6px_28px_rgba(212,255,0,0.70),0_0_80px_rgba(212,255,0,0.30)] hover:bg-[#D4FF00] hover:-translate-y-0.5 active:translate-y-0"
            >
              Start your 7-day free trial
              <ArrowRight size={16} />
            </Link>
          </div>

          <p className="text-xs text-gray-500 mt-8">
            Built and run by {BRAND.company_name} Digital — agency operators
            shipping the product they wished existed.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
