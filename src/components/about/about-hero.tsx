"use client";

import { motion } from "framer-motion";

const GOLD = "#c8a855";

export default function AboutHero() {
  return (
    <section className="relative pt-32 pb-16 md:pt-44 md:pb-24 px-6 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(200,168,85,0.1) 0%, transparent 60%)",
        }}
      />

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-6"
          style={{
            background: "rgba(200,168,85,0.08)",
            border: "1px solid rgba(200,168,85,0.15)",
            color: GOLD,
          }}
        >
          The team behind Trinity
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05]"
          style={{
            background:
              "linear-gradient(135deg, #ffffff 0%, #c8a855 55%, #ffffff 100%)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.03em",
          }}
        >
          We build what we
          <br />
          wish existed.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mt-8 leading-relaxed"
        >
          Every tool in Trinity exists because an agency operator needed it and
          got tired of waiting. We still build that way — close to the work,
          close to the people using it.
        </motion.p>
      </div>
    </section>
  );
}
