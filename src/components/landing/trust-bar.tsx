"use client";

import Reveal from "./reveal";

const STATS = [
  { value: "2.4M+", label: "Leads Scraped" },
  { value: "850K+", label: "Outreach Messages Sent" },
  { value: "$18M+", label: "Revenue Managed" },
  { value: "50+", label: "Agencies on the platform" },
];

export default function TrustBar() {
  return (
    <section
      className="py-16 px-6"
      style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
    >
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <p className="text-center text-xs text-gray-600 uppercase tracking-widest mb-10">
            Trusted by growing agencies worldwide
          </p>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((stat, i) => (
            <Reveal key={stat.label} delay={0.1 * i}>
              <div className="text-center">
                <p
                  className="text-3xl md:text-4xl font-extrabold mb-1"
                  style={{
                    background:
                      "linear-gradient(135deg, #c8a855, #e2c878)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {stat.value}
                </p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
