"use client";

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { BRAND } from "@/lib/brand-config";
import Reveal from "./reveal";

/**
 * Intentionally quiet "case studies coming" section — we don't fabricate
 * testimonials. Until real agency founders send us quotes with names,
 * faces, and logos, we show an honest invitation instead of placeholders.
 *
 * When real testimonials land, swap this component for a proper grid
 * keyed off (name, role, quote, logo_url, agency_name).
 */
export default function Testimonials() {
  return (
    <section className="py-16 md:py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <Reveal>
          <div
            className="rounded-3xl p-10 md:p-14 text-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(200,168,85,0.05), rgba(200,168,85,0.02))",
              border: "1px solid rgba(200,168,85,0.15)",
            }}
          >
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest mb-5"
              style={{
                background: "rgba(200,168,85,0.1)",
                color: "#c8a855",
                border: "1px solid rgba(200,168,85,0.2)",
              }}
            >
              <Sparkles size={11} />
              Real testimonials coming
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              We don&rsquo;t fake social proof.
            </h2>
            <p className="text-sm md:text-base text-gray-400 leading-relaxed max-w-xl mx-auto mb-6">
              {BRAND.product_name} is brand-new, and we&rsquo;d rather show you no
              testimonials than make them up. Case studies with real agency
              founders, real numbers, and real logos will land here as the
              first wave of users publishes their results.
            </p>
            <p className="text-xs text-gray-500 mb-8">
              Want to be one of the first? Try the free trial and we&rsquo;ll
              feature your story (with your permission) when you get a win.
            </p>

            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, #c8a855, #b89840)",
                color: "#0b0d12",
              }}
            >
              Start your free trial
              <ArrowRight size={14} />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
