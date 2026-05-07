"use client";

/**
 * Admin dashboard index — links to all admin-only sub-pages.
 * Only visible to users with role === "admin" / "founder".
 */

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";
import Link from "next/link";
import { Activity, DollarSign, Zap, FlaskConical, Shield } from "lucide-react";

const ADMIN_LINKS = [
  {
    href: "/dashboard/admin/agent-traces",
    icon: Activity,
    title: "Agent Traces",
    description: "LLM call history mirrored from Langfuse — filter by surface, status, and cost.",
  },
  {
    href: "/dashboard/admin/llm-costs",
    icon: DollarSign,
    title: "LLM Costs",
    description: "Per-model token usage and cost breakdown across all AI surfaces.",
  },
  {
    href: "/dashboard/admin/self-test",
    icon: FlaskConical,
    title: "Self-Test",
    description: "Run a full integration health check across all connected services.",
  },
  {
    href: "/dashboard/admin/status",
    icon: Shield,
    title: "Public Status",
    description: "Publicly visible system status page and uptime history.",
  },
];

export default function AdminIndexPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted text-sm">
        Loading…
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <PageHero
        title="Admin"
        subtitle="Founder &amp; admin tools — usage, costs, traces, and system health."
        icon={<Zap className="w-5 h-5" />}
        gradient="gold"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
        {ADMIN_LINKS.map(({ href, icon: Icon, title, description }, index) => (
          <motion.div
            key={href}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.4 }}
            whileHover={{ y: -4, scale: 1.01 }}
          >
            <Link
              href={href}
              className="glass rounded-xl p-5 flex gap-4 items-start relative overflow-hidden hover:border-border-strong transition-colors group block"
            >
              <div
                style={{
                  height: 3,
                  background:
                    "linear-gradient(90deg, #FF2D2D, #8b5cf6, #ec4899, #f97316, #FF2D2D)",
                }}
                className="absolute top-0 inset-x-0"
              />
              <span className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-brand-lime/10 flex items-center justify-center">
                <Icon className="w-4 h-4 text-brand-lime" />
              </span>
              <div>
                <p className="font-medium text-text-primary group-hover:text-brand-lime transition-colors">
                  {title}
                </p>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">{description}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
