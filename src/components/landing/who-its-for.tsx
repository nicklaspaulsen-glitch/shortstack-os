"use client";

import {
  Briefcase,
  Building2,
  MapPin,
  User,
  Users,
} from "lucide-react";
import { BRAND } from "@/lib/brand-config";
import Reveal from "./reveal";
import SectionHeading from "./section-heading";

const AUDIENCES = [
  {
    icon: Users,
    title: "Agency owners (1–50 people)",
    body:
      "You run a full-service, SEO, paid-ads, social, or content agency and you're tired of maintaining 15 logins for your team.",
  },
  {
    icon: User,
    title: "Solo marketers & consultants",
    body:
      "You're a one-person show billing 5–20 clients and the only way to scale without hiring is automation you can trust.",
  },
  {
    icon: Building2,
    title: "Franchise marketing teams",
    body:
      "Central brand, dozens of locations. White-label sub-portals, location-specific reporting, and shared content libraries.",
  },
  {
    icon: Briefcase,
    title: "In-house B2B marketing",
    body:
      "Small marketing team inside a bigger company — you need lead gen, outreach, content, and reporting without a 6-figure stack.",
  },
  {
    icon: MapPin,
    title: "Local-business marketers",
    body:
      "Dentists, roofers, med spas, real estate, home services. GBP posts, review requests, lead scraping, and local SEO in one place.",
  },
];

export default function WhoItsFor() {
  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <SectionHeading
            eyebrow="Who it's for"
            title={
              <>
                Built for teams of{" "}
                <span
                  style={{
                    background:
                      "linear-gradient(135deg, #c8a855, #e2c878)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  1 to 50.
                </span>
              </>
            }
            subtitle={`${BRAND.product_name} flexes from a solo operator running 5 retainers to a 40-person agency with dozens of client portals. Same platform, different shapes.`}
            className="mb-16"
          />
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {AUDIENCES.map((a, i) => (
            <Reveal key={a.title} delay={0.06 * i}>
              <div
                className="rounded-2xl p-5 h-full transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(200,168,85,0.08)" }}
                >
                  <a.icon size={18} style={{ color: "#c8a855" }} />
                </div>
                <h3 className="text-sm font-bold text-white mb-2">
                  {a.title}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {a.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
