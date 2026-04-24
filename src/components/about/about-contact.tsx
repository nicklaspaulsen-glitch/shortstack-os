"use client";

import { motion } from "framer-motion";
import { Mail, MessageCircle } from "lucide-react";

const GOLD = "#c8a855";
const GOLD_LIGHT = "#e4c876";

export default function AboutContact() {
  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-white"
            style={{ letterSpacing: "-0.02em" }}
          >
            Say hello.
          </h2>
          <p className="text-gray-400 mt-3 max-w-xl mx-auto">
            The fastest way to influence the roadmap is to tell us what&apos;s
            broken or missing.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.a
            href="mailto:hello@shortstack.os"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            whileHover={{ y: -3 }}
            className="group rounded-xl p-6 flex items-center gap-4"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{
                background: "rgba(200,168,85,0.1)",
                border: "1px solid rgba(200,168,85,0.2)",
                color: GOLD,
              }}
            >
              <Mail size={18} strokeWidth={1.8} />
            </div>
            <div>
              <div className="text-white font-semibold">Email</div>
              <div className="text-sm text-gray-500 group-hover:text-gray-300 transition-colors">
                hello@shortstack.os
              </div>
            </div>
          </motion.a>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.08 }}
            whileHover={{ y: -3 }}
            className="rounded-xl p-6 flex items-center gap-4"
            style={{
              background: `linear-gradient(135deg, rgba(200,168,85,0.08), rgba(228,200,118,0.02))`,
              border: "1px solid rgba(200,168,85,0.2)",
            }}
          >
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
                color: "#0b0d12",
              }}
            >
              <MessageCircle size={18} strokeWidth={2} />
            </div>
            <div>
              <div className="text-white font-semibold">In-app feedback</div>
              <div className="text-sm text-gray-500">
                Tap the{" "}
                <span style={{ color: GOLD }} className="font-semibold">
                  gold button
                </span>{" "}
                bottom-right
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
