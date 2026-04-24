"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const GOLD = "#c8a855";
const GOLD_LIGHT = "#e4c876";

const milestones = [
  {
    date: "Q4 2025",
    title: "The pain",
    body: "Stack of 15 SaaS tools, 5-figure monthly bill, still doing data entry by hand.",
  },
  {
    date: "Jan 2026",
    title: "First prototype",
    body: "Lead scraper + AI outreach in a single app. Shipped to 5 beta agencies.",
  },
  {
    date: "Feb 2026",
    title: "Trinity takes shape",
    body: "CRM, content studio, and portal launched. Feedback loop tightened to weekly.",
  },
  {
    date: "Mar 2026",
    title: "30+ modules",
    body: "Ad manager, voice agents, showcase, courses, messaging — all in one.",
  },
  {
    date: "Apr 2026",
    title: "Public launch",
    body: "Public pricing, self-serve signup, white-label portals for every plan.",
  },
  {
    date: "What's next",
    title: "You",
    body: "Every week we ship what our operators tell us they need. This is the next milestone.",
  },
];

function Milestone({ m, i }: { m: (typeof milestones)[number]; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const isLast = i === milestones.length - 1;

  return (
    <div ref={ref} className="relative flex gap-6 pb-10">
      {/* Timeline spine + node */}
      <div className="relative flex flex-col items-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={inView ? { scale: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="w-4 h-4 rounded-full flex-shrink-0 z-10"
          style={{
            background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
            boxShadow: `0 0 0 4px rgba(200,168,85,0.1)`,
          }}
        />
        {!isLast && (
          <motion.div
            initial={{ scaleY: 0 }}
            animate={inView ? { scaleY: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{ originY: 0 }}
            className="flex-1 w-px mt-2"
          >
            <div
              className="w-px h-full"
              style={{
                background: `linear-gradient(180deg, ${GOLD}, transparent)`,
                minHeight: "40px",
              }}
            />
          </motion.div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="flex-1 pb-4"
      >
        <div className="text-xs font-medium mb-1" style={{ color: GOLD }}>
          {m.date}
        </div>
        <h3 className="text-white text-xl font-semibold mb-1.5 tracking-tight">
          {m.title}
        </h3>
        <p className="text-gray-400 leading-relaxed">{m.body}</p>
      </motion.div>
    </div>
  );
}

export default function Milestones() {
  return (
    <section className="py-16 md:py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-14 text-center"
        >
          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-white"
            style={{ letterSpacing: "-0.02em" }}
          >
            The story so far.
          </h2>
          <p className="text-gray-400 mt-3">Six months, zero slowdowns.</p>
        </motion.div>

        <div>
          {milestones.map((m, i) => (
            <Milestone key={m.title} m={m} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
