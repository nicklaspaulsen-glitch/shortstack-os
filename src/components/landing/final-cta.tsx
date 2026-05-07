"use client";

import Link from "next/link";
import { ArrowRight, Calendar, Shield } from "lucide-react";
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
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#FF6B6B",
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
            <span
              style={{
                background: "linear-gradient(135deg, #FF2D2D, #FF6B6B)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {BRAND.product_name}.
            </span>
          </h2>

          <p className="text-gray-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Start your 7-day free trial. If it doesn&apos;t replace at least
            three of your current tools in the first week, keep your old stack
            and we&apos;ll refund whatever you paid.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/pricing"
              className="group flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg, #FF2D2D, #CC2424)",
                color: "#fff",
                boxShadow: "0 0 40px rgba(255,255,255,0.12)",
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
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <Calendar size={15} className="text-gray-400" />
              Book a demo
            </Link>
          </div>

          <p className="text-xs text-gray-600 mt-8">
            Built and run by {BRAND.company_name} Digital — agency operators
            shipping the product they wished existed.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
