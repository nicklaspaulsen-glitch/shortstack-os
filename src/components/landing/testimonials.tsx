"use client";

import { Star } from "lucide-react";
import Reveal from "./reveal";
import SectionHeading from "./section-heading";

/**
 * TODO: Replace these with real quotes from agency owners using Trinity.
 * Each entry is currently a placeholder — clearly marked below.
 */
const TESTIMONIALS = [
  {
    quote:
      "We replaced five tools in the first week. Our ops lead got his Fridays back and our clients actually compliment the portal now.",
    name: "[TODO — Agency Founder]",
    role: "[TODO — Role, Agency]",
    rating: 5,
    placeholder: true,
  },
  {
    quote:
      "The AI outreach booked us 14 discovery calls from a single campaign. First time since 2022 I've seen cold email convert without a VA babysitting it.",
    name: "[TODO — Agency Founder]",
    role: "[TODO — Role, Agency]",
    rating: 5,
    placeholder: true,
  },
  {
    quote:
      "I was skeptical about another 'agency OS'. This one is different — the team clearly built it while running an agency, and it shows in every workflow.",
    name: "[TODO — Agency Founder]",
    role: "[TODO — Role, Agency]",
    rating: 5,
    placeholder: true,
  },
];

export default function Testimonials() {
  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <SectionHeading
            eyebrow="From agency owners using Trinity"
            title="Loved by operators, not marketers."
            subtitle="Real quotes from agency founders running the platform. We'll swap these for real testimonials with names, faces, and agency logos as we publish case studies."
            className="mb-16"
          />
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={i} delay={0.1 * i}>
              <div
                className="rounded-2xl p-6 h-full transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, idx) => (
                    <Star
                      key={idx}
                      size={14}
                      fill="#c8a855"
                      style={{ color: "#c8a855" }}
                    />
                  ))}
                </div>

                <p className="text-sm text-gray-300 leading-relaxed mb-6">
                  &ldquo;{t.quote}&rdquo;
                </p>

                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: "rgba(200,168,85,0.1)",
                      color: "#c8a855",
                    }}
                  >
                    ?
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {t.name}
                    </p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                  {t.placeholder && (
                    <span
                      className="ml-auto text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{
                        background: "rgba(200,168,85,0.1)",
                        color: "#c8a855",
                      }}
                    >
                      Placeholder
                    </span>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
