"use client";

import { motion } from "framer-motion";

const GOLD = "#c8a855";

export default function FounderStory() {
  return (
    <section className="py-16 md:py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-4 mb-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
              style={{
                background: `linear-gradient(135deg, ${GOLD}, #e4c876)`,
                color: "#0b0d12",
              }}
            >
              N
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">Nicklas Paulsen</h3>
              <p className="text-sm text-gray-500">Founder, ShortStack</p>
            </div>
          </div>

          <div className="space-y-5 text-gray-300 leading-relaxed text-lg">
            <p>
              Hi, I&apos;m Nicklas. I run a creative agency — and like most agency
              operators, I spent years duct-taping a stack of 15+ SaaS tools
              together just to keep the lights on.
            </p>
            <p>
              CRM here. Content planner there. Email tool. Lead scraper. Invoicing.
              Contracts. Reporting. Every one of them ok in isolation — every one
              a little off when you wanted them to talk to each other.
            </p>
            <p>
              I built{" "}
              <span style={{ color: GOLD }} className="font-semibold">
                Trinity
              </span>{" "}
              because I wanted the operating system I&apos;d been paying $2k/month
              to stitch together by hand. AI agents that actually close. A CRM
              that auto-enriches. Content that publishes itself. White-label
              portals you&apos;d brag about handing to a client.
            </p>
            <p>
              One platform, built by operators, for operators. That&apos;s it.
              That&apos;s the whole pitch.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
