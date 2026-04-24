"use client";

import { motion } from "framer-motion";

const GOLD = "#c8a855";

/**
 * Tech logos rendered as text badges so we don't ship 3rd-party marks.
 * Swap in real SVGs later if licensing is clear.
 */
const stack = [
  { name: "Next.js", tone: "#ffffff" },
  { name: "Supabase", tone: "#3ecf8e" },
  { name: "Claude", tone: "#d97757" },
  { name: "Stripe", tone: "#635bff" },
  { name: "OpenAI", tone: "#10a37f" },
  { name: "Tailwind", tone: "#38bdf8" },
  { name: "Vercel", tone: "#ffffff" },
  { name: "Resend", tone: "#ffffff" },
];

export default function StackRow() {
  return (
    <section className="py-16 md:py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">
            Built on
          </p>
          <h2 className="text-white text-xl md:text-2xl font-semibold">
            Boring, reliable, and fast by default.
          </h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.05 } },
          }}
          className="flex flex-wrap justify-center gap-3"
        >
          {stack.map((s) => (
            <motion.div
              key={s.name}
              variants={{
                hidden: { opacity: 0, scale: 0.9 },
                visible: { opacity: 1, scale: 1 },
              }}
              whileHover={{ y: -3, borderColor: GOLD }}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: s.tone,
                transition: "border-color 200ms ease-out",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: s.tone, boxShadow: `0 0 8px ${s.tone}60` }}
              />
              {s.name}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
