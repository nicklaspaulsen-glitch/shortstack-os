"use client";

/**
 * Admin dashboard index — links to all admin-only sub-pages.
 * Only visible to users with role === "admin" / "founder".
 */

import { useRouter } from "next/navigation";
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
    <div className="space-y-8">
      <PageHero
        title="Admin"
        subtitle="Founder &amp; admin tools — usage, costs, traces, and system health."
        icon={<Zap className="w-5 h-5" />}
        gradient="gold"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
        {ADMIN_LINKS.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="card p-5 flex gap-4 items-start hover:border-border-strong transition-colors group"
          >
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
        ))}
      </div>
    </div>
  );
}
