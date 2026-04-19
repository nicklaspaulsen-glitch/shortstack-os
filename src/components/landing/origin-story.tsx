"use client";

import { Building2, Rocket, Wrench } from "lucide-react";
import { BRAND } from "@/lib/brand-config";
import Reveal from "./reveal";
import SectionHeading from "./section-heading";

const MILESTONES = [
  {
    year: "2021",
    title: "We started as an agency",
    body: `${BRAND.company_name} began as a boutique digital marketing agency — SEO, paid ads, content, and retainers for small and mid-sized businesses. We lived the grind our clients live.`,
    icon: Building2,
  },
  {
    year: "2023",
    title: "We built internal tools to survive",
    body: `Fifteen SaaS subscriptions were bleeding the P&L and nothing talked to anything else. So we started writing our own tools — a lead scraper here, a CRM there, a content pipeline, a client portal.`,
    icon: Wrench,
  },
  {
    year: "2025",
    title: "Other agencies asked to use it",
    body: `Agency friends kept seeing our internal dashboards and asking, "Can we license that?" At a certain point we realized we weren't running a marketing agency anymore — we were building the software agencies wished existed.`,
    icon: Rocket,
  },
];

export default function OriginStory() {
  return (
    <section
      className="py-20 md:py-28 px-6"
      style={{
        background:
          "linear-gradient(180deg, rgba(200,168,85,0.02) 0%, transparent 100%)",
        borderTop: "1px solid rgba(255,255,255,0.03)",
      }}
    >
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <SectionHeading
            eyebrow="Our origin"
            title={
              <>
                How {BRAND.product_name} started
              </>
            }
            subtitle={
              <>
                Not a pitch deck. An agency that got sick of its own tool
                stack and ended up productizing the thing that finally worked.
              </>
            }
            className="mb-16"
          />
        </Reveal>

        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Narrative */}
          <Reveal>
            <div className="space-y-5 text-gray-300 leading-relaxed text-[15px]">
              <p>
                <span className="text-white font-semibold">
                  {BRAND.company_name} started in 2021 as a small digital
                  marketing agency
                </span>{" "}
                — SEO, paid ads, and content retainers. Nothing exotic. Just
                trying to grow local businesses and B2B companies with the
                same tools every other agency used: GoHighLevel, Apollo,
                Mailchimp, HubSpot, Canva, Later, PandaDoc, Stripe,
                Calendly, Notion, and roughly a dozen Zapier zaps holding it
                together with tape.
              </p>
              <p>
                Within two years we were profitable but miserable. Our
                bookkeeping team counted 18 active software subscriptions
                across the agency. Our ops lead was spending a full day a
                week just reconciling data between the CRM and the billing
                tool. Every single client asked &ldquo;what did you do this
                week?&rdquo; and we never had a clean answer because the
                answer was scattered across 6 dashboards.
              </p>
              <p>
                So we started building. First a scraper. Then an AI outreach
                pipeline. Then a client portal. Then a deal tracker that
                actually synced with Stripe. Every time we replaced a tool
                with an internal one, margins got better and the team got
                calmer.
              </p>
              <p>
                Then other agency owners started seeing our dashboards on
                Loom calls and asking:{" "}
                <span className="text-white italic">
                  &ldquo;wait, can we use that?&rdquo;
                </span>{" "}
                We said no for a long time. Eventually we said yes. That
                &ldquo;yes&rdquo; is {BRAND.product_name} — the exact stack
                we run{" "}
                <span className="text-white font-semibold">
                  {BRAND.company_name}
                </span>{" "}
                on, packaged for agencies who want to skip the five years of
                duct tape and just ship.
              </p>
              <p className="text-sm text-gray-500 italic pt-2">
                — The {BRAND.company_name} team
              </p>
            </div>
          </Reveal>

          {/* Timeline */}
          <Reveal delay={0.15}>
            <div className="relative pl-8">
              <div
                className="absolute left-[18px] top-2 bottom-2 w-px"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(200,168,85,0.3) 0%, rgba(200,168,85,0.05) 100%)",
                }}
              />
              {MILESTONES.map((m) => (
                <div key={m.year} className="relative mb-8 last:mb-0">
                  <div
                    className="absolute -left-8 top-0 w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: "#0b0d12",
                      border: "1px solid rgba(200,168,85,0.25)",
                    }}
                  >
                    <m.icon size={16} style={{ color: "#c8a855" }} />
                  </div>
                  <div className="pl-4">
                    <p
                      className="text-[10px] uppercase tracking-widest font-semibold mb-1"
                      style={{ color: "#c8a855" }}
                    >
                      {m.year}
                    </p>
                    <h3 className="text-base font-bold text-white mb-1.5">
                      {m.title}
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {m.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
