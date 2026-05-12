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
              background: "rgba(37,99,235,0.10)",
              border: "1px solid rgba(37,99,235,0.25)",
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
            <span className="text-blue-500">
              {BRAND.product_name}.
            </span>
          </h2>

          <p className="text-text-muted text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Start your 7-day free trial. If it doesn&apos;t replace at least
            three of your current tools in the first week, keep your old stack
            and we&apos;ll refund whatever you paid.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/pricing"
              className="group flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 text-white bg-blue-600 hover:bg-blue-500 shadow-[0_0_28px_rgba(37,99,235,0.45)] hover:shadow-[0_0_52px_rgba(37,99,235,0.65)]"
            >
              Start your 7-day free trial
              <ArrowRight
                size={16}
                className="group-hover:translate-x-0.5 transition-transform"
              />
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
