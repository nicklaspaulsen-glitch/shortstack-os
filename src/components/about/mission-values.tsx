"use client";

import { motion } from "framer-motion";
import { Compass, Zap, Heart } from "lucide-react";

const GOLD = "#c8a855";

const values = [
  {
    icon: Compass,
    title: "Operator-first",
    body: "Every feature starts with a real agency pain. If a user can't explain why a feature matters in one sentence, it doesn't ship.",
  },
  {
    icon: Zap,
    title: "Ship fast, fix faster",
    body: "We run on weekly cadences. Bugs in production are our most valuable signal — we want to be at the scene, not arguing about it.",
  },
  {
    icon: Heart,
    title: "Human, not hyped",
    body: "AI is a tool, not the product. The product is your agency running more smoothly tomorrow than it does today.",
  },
];

export default function MissionValues() {
  return (
    <section className="py-16 md:py-24 px-6" style={{ background: "rgba(200,168,85,0.02)" }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-white"
            style={{ letterSpacing: "-0.02em" }}
          >
            What we care about.
          </h2>
          <p className="text-gray-400 mt-3 max-w-xl mx-auto">
            Three principles, written on the wall, not in a deck.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.12 } },
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {values.map((v) => {
            const Icon = v.icon;
            return (
              <motion.div
                key={v.title}
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -4 }}
                className="rounded-xl p-7"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{
                    background: "rgba(200,168,85,0.1)",
                    border: "1px solid rgba(200,168,85,0.2)",
                    color: GOLD,
                  }}
                >
                  <Icon size={20} strokeWidth={1.8} />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{v.title}</h3>
                <p className="text-gray-400 leading-relaxed">{v.body}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
