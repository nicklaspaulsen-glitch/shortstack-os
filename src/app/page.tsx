"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Zap,
  Users,
  Mail,
  BarChart3,
  Layers,
  PenTool,
  Target,
  Sparkles,
  ChevronRight,
  Star,
  TrendingUp,
  Globe,
  Shield,
  Monitor,
  Download,
  Lock,
} from "lucide-react";

/* ─── Stats ────────────────────────────────────────────────────────── */
const STATS = [
  { value: "2.4M+", label: "Leads Scraped" },
  { value: "850K+", label: "Emails Sent" },
  { value: "$18M+", label: "Revenue Managed" },
  { value: "50+", label: "Agencies Trust Us" },
];

/* ─── Features ─────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Target,
    title: "Lead Generation",
    description:
      "Scrape and enrich leads from any niche. AI scoring identifies your best prospects before you even reach out.",
    color: "#c8a855",
  },
  {
    icon: Mail,
    title: "AI Outreach",
    description:
      "Automated DMs, cold emails, and AI-powered calls. Personalized sequences that run on autopilot 24/7.",
    color: "#3b82f6",
  },
  {
    icon: Users,
    title: "Client Management",
    description:
      "Full CRM with pipeline views, proposals, invoicing, and a client portal they'll actually love using.",
    color: "#10b981",
  },
  {
    icon: PenTool,
    title: "Content Creation",
    description:
      "AI-generated scripts, social posts, ad copy, and design assets. Create a week of content in minutes.",
    color: "#a855f7",
  },
  {
    icon: Layers,
    title: "Workflow Automation",
    description:
      "20+ AI agents that chain together. Build automations that handle everything from lead to close.",
    color: "#f59e0b",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    description:
      "Real-time dashboards, revenue forecasting, and white-label reports your clients will brag about.",
    color: "#ec4899",
  },
];

/* ─── Steps ────────────────────────────────────────────────────────── */
const STEPS = [
  {
    num: "01",
    title: "Connect",
    description:
      "Plug in your socials, email accounts, and ad platforms. We integrate with Meta, Google, TikTok, and more.",
    icon: Globe,
  },
  {
    num: "02",
    title: "Automate",
    description:
      "Set up AI agents, outreach sequences, and content pipelines. Toggle on Autopilot and let the system work.",
    icon: Zap,
  },
  {
    num: "03",
    title: "Scale",
    description:
      "Watch leads flow in, clients onboard themselves, and revenue climb. Focus on strategy, not grunt work.",
    icon: TrendingUp,
  },
];

/* ─── Testimonials ─────────────────────────────────────────────────── */
const TESTIMONIALS = [
  {
    quote:
      "ShortStack replaced five different tools for us. Our team went from managing 8 clients to 22 without hiring anyone new.",
    name: "Marcus Chen",
    role: "Founder, Apex Digital",
    rating: 5,
  },
  {
    quote:
      "The AI outreach alone paid for itself in the first week. We booked 14 calls from a single campaign. Unreal.",
    name: "Sarah Mitchell",
    role: "CEO, GrowthLab Agency",
    rating: 5,
  },
  {
    quote:
      "I was skeptical about 'agency OS' tools. But this is different. It actually works. Our revenue tripled in 3 months.",
    name: "Jake Rivera",
    role: "Director, Nomad Media",
    rating: 5,
  },
];

/* ─── Scroll Reveal ───────────────────────────────────────────────── */
function ScrollReveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.7s ease-out ${delay}s, transform 0.7s ease-out ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(!open)}
      className="w-full text-left rounded-xl p-5 transition-all"
      style={{
        background: open ? "rgba(200,168,85,0.04)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${open ? "rgba(200,168,85,0.12)" : "rgba(255,255,255,0.05)"}`,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-white">{question}</p>
        <ChevronRight
          size={16}
          className="shrink-0 transition-transform text-gray-500"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
      </div>
      {open && (
        <p className="text-sm text-gray-400 mt-3 leading-relaxed">{answer}</p>
      )}
    </button>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#0b0d12" }}>
      {/* ─── GLOBAL CSS for animations ─────────────────────────────── */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-fade-up {
          animation: fade-up 0.7s ease-out forwards;
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }
        .delay-500 { animation-delay: 0.5s; }
        .delay-600 { animation-delay: 0.6s; }
        .delay-700 { animation-delay: 0.7s; }
      `}</style>

      {/* ─── NAV ───────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(11,13,18,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled
            ? "1px solid rgba(255,255,255,0.05)"
            : "1px solid transparent",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/icons/shortstack-logo.png"
              alt="ShortStack"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <span className="text-white font-bold tracking-tight">
              ShortStack
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link
              href="#features"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/changelog"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Changelog
            </Link>
            <Link
              href="#desktop"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Desktop App
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:block"
            >
              Login
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-semibold px-5 py-2 rounded-lg transition-all hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, #c8a855, #b89840)",
                color: "#0b0d12",
              }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── HERO ──────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6 overflow-hidden">
        {/* Background glow effects */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(200,168,85,0.08) 0%, transparent 70%)",
            animation: "glow-pulse 4s ease-in-out infinite",
          }}
        />
        <div
          className="absolute top-20 right-0 w-[400px] h-[400px] pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-40 left-0 w-[300px] h-[300px] pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(168,137,61,0.05) 0%, transparent 70%)",
          }}
        />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 ${
              visible
                ? "animate-fade-up"
                : "opacity-0"
            }`}
            style={{
              background: "rgba(200,168,85,0.08)",
              border: "1px solid rgba(200,168,85,0.15)",
              color: "#c8a855",
            }}
          >
            <Sparkles size={12} />
            AI-Powered Agency Management
          </div>

          {/* Headline */}
          <h1
            className={`text-5xl md:text-7xl font-extrabold mb-6 leading-[1.05] tracking-tight ${
              visible
                ? "animate-fade-up delay-100"
                : "opacity-0"
            }`}
            style={{
              background:
                "linear-gradient(135deg, #ffffff 0%, #c8a855 50%, #ffffff 100%)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: visible
                ? "fade-up 0.7s ease-out 0.1s forwards, gradient-shift 6s ease-in-out infinite"
                : "none",
              opacity: 0,
              letterSpacing: "-0.03em",
            }}
          >
            Run Your Agency
            <br />
            on Autopilot
          </h1>

          {/* Subtitle */}
          <p
            className={`text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed ${
              visible
                ? "animate-fade-up delay-200"
                : "opacity-0"
            }`}
            style={{ opacity: 0 }}
          >
            The all-in-one operating system for digital marketing agencies.
            Scrape leads, automate outreach, manage clients, create content, and
            scale your revenue — all powered by AI.
          </p>

          {/* CTAs */}
          <div
            className={`flex flex-col sm:flex-row items-center justify-center gap-4 ${
              visible
                ? "animate-fade-up delay-300"
                : "opacity-0"
            }`}
            style={{ opacity: 0 }}
          >
            <Link
              href="/pricing"
              className="group flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg, #c8a855, #b89840)",
                color: "#0b0d12",
                boxShadow: "0 0 30px rgba(200,168,85,0.15)",
              }}
            >
              Get Started Free
              <ArrowRight
                size={16}
                className="group-hover:translate-x-0.5 transition-transform"
              />
            </Link>
            <Link
              href="/pricing"
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm text-white transition-all hover:border-white/20"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              See Pricing
              <ChevronRight size={16} className="text-gray-500" />
            </Link>
          </div>

          {/* Hero visual — abstract grid/glow */}
          <div
            className={`relative mt-16 md:mt-24 mx-auto max-w-4xl ${
              visible
                ? "animate-fade-up delay-500"
                : "opacity-0"
            }`}
            style={{ opacity: 0 }}
          >
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                padding: "1px",
              }}
            >
              <div
                className="rounded-2xl px-8 py-10"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(200,168,85,0.03) 0%, rgba(11,13,18,1) 100%)",
                }}
              >
                {/* Mock dashboard preview */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/50" />
                  <span className="text-[10px] text-gray-600 ml-2">
                    ShortStack OS — Dashboard
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-6">
                  {[
                    { label: "Active Leads", val: "1,284", change: "+12%" },
                    { label: "Emails Sent", val: "8,432", change: "+28%" },
                    { label: "Deals Won", val: "47", change: "+8%" },
                    { label: "Revenue", val: "$124K", change: "+18%" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-lg p-3"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <p className="text-[9px] text-gray-600 mb-1">
                        {s.label}
                      </p>
                      <p className="text-lg font-bold text-white">{s.val}</p>
                      <p className="text-[9px] text-emerald-400">{s.change}</p>
                    </div>
                  ))}
                </div>

                {/* Mock chart bars */}
                <div className="flex items-end gap-1.5 h-24">
                  {[40, 55, 35, 65, 80, 60, 75, 90, 70, 85, 95, 78].map(
                    (h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t transition-all"
                        style={{
                          height: `${h}%`,
                          background: `linear-gradient(180deg, rgba(200,168,85,${
                            0.3 + (h / 100) * 0.5
                          }) 0%, rgba(200,168,85,0.05) 100%)`,
                        }}
                      />
                    )
                  )}
                </div>
              </div>

              {/* Shimmer effect */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(200,168,85,0.03), transparent)",
                  animation: "shimmer 3s ease-in-out infinite",
                }}
              />
            </div>

            {/* Glow under the card */}
            <div
              className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse, rgba(200,168,85,0.1) 0%, transparent 70%)",
                filter: "blur(20px)",
              }}
            />
          </div>
        </div>
      </section>

      {/* ─── TRUST BAR ─────────────────────────────────────────────── */}
      <section className="py-16 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <p className="text-center text-xs text-gray-600 uppercase tracking-widest mb-10">
              Trusted by growing agencies worldwide
            </p>
          </ScrollReveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((stat, i) => (
              <ScrollReveal key={stat.label} delay={0.1 * i}>
                <div className="text-center">
                  <p
                    className="text-3xl md:text-4xl font-extrabold mb-1"
                    style={{
                      background:
                        "linear-gradient(135deg, #c8a855, #e2c878)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ──────────────────────────────────────────────── */}
      <section id="features" className="py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "#c8a855" }}
            >
              Everything You Need
            </p>
            <h2
              className="text-3xl md:text-5xl font-extrabold text-white mb-4"
              style={{ letterSpacing: "-0.03em" }}
            >
              One platform. Zero excuses.
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Replace your entire tool stack with ShortStack OS. Every feature
              your agency needs, integrated and AI-powered.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature, i) => (
              <ScrollReveal key={feature.title} delay={0.08 * i}>
              <div
                className="group rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 h-full"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${feature.color}22`;
                  e.currentTarget.style.background = `${feature.color}06`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: `${feature.color}12`,
                  }}
                >
                  <feature.icon size={20} style={{ color: feature.color }} />
                </div>
                <h3 className="text-base font-bold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ──────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="py-20 md:py-28 px-6"
        style={{
          background:
            "linear-gradient(180deg, rgba(200,168,85,0.02) 0%, transparent 100%)",
        }}
      >
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "#c8a855" }}
            >
              Simple Setup
            </p>
            <h2
              className="text-3xl md:text-5xl font-extrabold text-white mb-4"
              style={{ letterSpacing: "-0.03em" }}
            >
              Up and running in minutes
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              No steep learning curve. No month-long onboarding. Connect your
              accounts and let the AI handle the rest.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <ScrollReveal key={step.num} delay={0.15 * i}>
              <div className="relative text-center">
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div
                    className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(200,168,85,0.2), rgba(200,168,85,0.05))",
                    }}
                  />
                )}

                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 relative"
                  style={{
                    background: "rgba(200,168,85,0.06)",
                    border: "1px solid rgba(200,168,85,0.12)",
                  }}
                >
                  <step.icon size={28} style={{ color: "#c8a855" }} />
                  <span
                    className="absolute -top-2 -right-2 text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center"
                    style={{
                      background: "#c8a855",
                      color: "#0b0d12",
                    }}
                  >
                    {step.num}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ──────────────────────────────────────────── */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "#c8a855" }}
            >
              Social Proof
            </p>
            <h2
              className="text-3xl md:text-5xl font-extrabold text-white mb-4"
              style={{ letterSpacing: "-0.03em" }}
            >
              Loved by agency owners
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              Don&apos;t take our word for it. Here&apos;s what real agency
              founders say about ShortStack OS.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <ScrollReveal key={t.name} delay={0.1 * i}>
              <div
                className="rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      fill="#c8a855"
                      style={{ color: "#c8a855" }}
                    />
                  ))}
                </div>

                <p className="text-sm text-gray-300 leading-relaxed mb-6">
                  &ldquo;{t.quote}&rdquo;
                </p>

                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: "rgba(200,168,85,0.1)",
                      color: "#c8a855",
                    }}
                  >
                    {t.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {t.name}
                    </p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
              </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── REPLACE YOUR STACK ──────────────────────────────────── */}
      <section className="py-20 md:py-28 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#c8a855" }}>
              One Platform, Not Ten
            </p>
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4" style={{ letterSpacing: "-0.03em" }}>
              Replace your entire tool stack
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto">
              Stop paying for a dozen subscriptions. ShortStack OS combines everything into one.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { tool: "GoHighLevel", for: "CRM & Automation", saved: "$97/mo" },
              { tool: "Apollo / ZoomInfo", for: "Lead Scraping", saved: "$99/mo" },
              { tool: "Mailchimp / SendGrid", for: "Email Outreach", saved: "$50/mo" },
              { tool: "HubSpot", for: "Client Management", saved: "$45/mo" },
              { tool: "Canva Pro", for: "Design Assets", saved: "$13/mo" },
              { tool: "Later / Buffer", for: "Social Scheduling", saved: "$25/mo" },
              { tool: "PandaDoc", for: "Contracts", saved: "$35/mo" },
              { tool: "Stripe Billing", for: "Invoicing", saved: "Free" },
            ].map((item, i) => (
              <ScrollReveal key={item.tool} delay={0.05 * i}>
                <div className="rounded-xl p-4 text-center transition-all hover:-translate-y-0.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-xs font-semibold text-white line-through opacity-50">{item.tool}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{item.for}</p>
                  <p className="text-[10px] font-bold mt-1.5" style={{ color: "#10b981" }}>Save {item.saved}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={0.4}>
            <div className="text-center mt-10 py-5 rounded-xl" style={{ background: "rgba(200,168,85,0.04)", border: "1px solid rgba(200,168,85,0.1)" }}>
              <p className="text-sm text-gray-300">Total savings: <span className="text-gold font-bold">$364+/mo</span> compared to using separate tools</p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── FAQ ───────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#c8a855" }}>FAQ</p>
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4" style={{ letterSpacing: "-0.03em" }}>
              Common questions
            </h2>
          </ScrollReveal>

          <div className="space-y-3">
            {[
              { q: "Who is ShortStack OS for?", a: "Digital marketing agencies, freelance marketers, and consultants who want to automate lead generation, client management, outreach, and content creation in one platform." },
              { q: "Do I need technical skills to use it?", a: "No. ShortStack is designed for agency owners, not developers. Everything is point-and-click with AI assistance built in." },
              { q: "Can my clients log in and see their own portal?", a: "Yes. Each client gets their own portal with deliverables, invoices, contracts, tasks, and real-time progress updates." },
              { q: "What integrations are included?", a: "Stripe for billing, Google for leads and ads, Meta for social and ads, TikTok, LinkedIn, Telegram for notifications, and more. We add new integrations regularly." },
              { q: "Is there a free trial?", a: "We offer a Starter plan so you can explore the platform. You can upgrade anytime as your agency grows." },
              { q: "Can I white-label ShortStack for my clients?", a: "White-label options are available on Growth and Enterprise plans, including custom domains and branding." },
            ].map((faq, i) => (
              <ScrollReveal key={i} delay={0.06 * i}>
                <FAQItem question={faq.q} answer={faq.a} />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── DESKTOP APP DOWNLOAD ────────────────────────────────── */}
      <section className="py-20 md:py-28 px-6" id="desktop" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <ScrollReveal>
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-medium mb-4"
                style={{
                  background: "rgba(59,130,246,0.08)",
                  border: "1px solid rgba(59,130,246,0.15)",
                  color: "#3b82f6",
                }}
              >
                <Monitor size={10} />
                Desktop App
              </div>

              <h2
                className="text-3xl md:text-4xl font-extrabold text-white mb-4"
                style={{ letterSpacing: "-0.03em" }}
              >
                Your AI{" "}
                <span
                  style={{
                    background: "linear-gradient(135deg, #c8a855, #e2c878)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  creative partner
                </span>
                , on your desktop
              </h2>

              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                ShortStack Agent lives on your computer. It can create websites, scaffold campaigns,
                organize your files, build brand kits, write email sequences, and automate your workflow —
                all with natural language. Just tell it what you need.
              </p>

              <div className="space-y-3 mb-8">
                {[
                  { text: "14 AI-powered tools for file management and content creation", icon: Zap },
                  { text: "Project templates: websites, campaigns, brand kits, calendars", icon: Layers },
                  { text: "Syncs with your ShortStack OS dashboard automatically", icon: Globe },
                  { text: "Works offline — your files never leave your machine", icon: Lock },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: "rgba(200,168,85,0.08)" }}
                    >
                      <item.icon size={12} style={{ color: "#c8a855" }} />
                    </div>
                    <p className="text-sm text-gray-300">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="/downloads/ShortStack-Setup.exe"
                  className="group flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:shadow-lg"
                  style={{
                    background: "linear-gradient(135deg, #c8a855, #b89840)",
                    color: "#0b0d12",
                    boxShadow: "0 0 20px rgba(200,168,85,0.1)",
                  }}
                >
                  <Download size={15} />
                  Download for Windows
                </a>
                <a
                  href="/downloads/ShortStack.dmg"
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:border-white/20"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <Download size={15} className="text-gray-500" />
                  Download for Mac
                </a>
              </div>

              <p className="text-[10px] text-gray-600 mt-3">
                Free to download. Requires a ShortStack account to use.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.15}>
              <div
                className="rounded-2xl p-6 relative overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {/* Mock agent window */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#C9A84C" }} />
                  <span className="text-[10px] font-semibold" style={{ color: "#C9A84C" }}>ShortStack Agent</span>
                  <span className="text-[8px] text-gray-600 ml-auto">Chat</span>
                  <span className="text-[8px] text-gray-600">Workspace</span>
                  <span className="text-[8px] text-gray-600">Tasks</span>
                </div>

                {/* Mock conversation */}
                <div className="space-y-3">
                  <div className="ml-auto max-w-[75%] rounded-xl px-3 py-2 text-xs" style={{ background: "#C9A84C", color: "#000" }}>
                    Create a social media campaign for my new product launch
                  </div>
                  <div
                    className="max-w-[85%] rounded-xl px-3 py-2 text-xs text-gray-300"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="text-[9px] font-semibold mb-1" style={{ color: "#C9A84C" }}>create_project</div>
                    <div className="text-[9px] text-emerald-400">Created &quot;product-launch&quot; — 4 folders, 5 files</div>
                  </div>
                  <div
                    className="max-w-[85%] rounded-xl px-3 py-2 text-xs text-gray-300"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    Done! I scaffolded your campaign at <code className="text-[10px] px-1 rounded" style={{ background: "rgba(255,255,255,0.04)" }}>product-launch/</code> with briefs, caption templates, a posting calendar, and hashtag strategy. Want me to fill in the captions for Instagram and TikTok?
                  </div>
                </div>

                {/* Mock input */}
                <div className="mt-4 flex gap-2">
                  <div
                    className="flex-1 rounded-xl px-3 py-2.5 text-[11px] text-gray-600"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    Ask your agent anything...
                  </div>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "#C9A84C" }}
                  >
                    <ArrowRight size={12} style={{ color: "#0b0d12" }} />
                  </div>
                </div>

                {/* Glow */}
                <div
                  className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-2/3 h-8 pointer-events-none"
                  style={{
                    background: "radial-gradient(ellipse, rgba(200,168,85,0.08) 0%, transparent 70%)",
                    filter: "blur(12px)",
                  }}
                />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-3xl mx-auto text-center relative">
          {/* Background glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse, rgba(200,168,85,0.06) 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />

          <ScrollReveal className="relative z-10">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-medium mb-6"
              style={{
                background: "rgba(200,168,85,0.08)",
                border: "1px solid rgba(200,168,85,0.15)",
                color: "#c8a855",
              }}
            >
              <Shield size={10} />
              Start Today — No Obligation
            </div>

            <h2
              className="text-3xl md:text-5xl font-extrabold text-white mb-5"
              style={{ letterSpacing: "-0.03em" }}
            >
              Ready to{" "}
              <span
                style={{
                  background:
                    "linear-gradient(135deg, #c8a855, #e2c878)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                10x
              </span>{" "}
              your agency?
            </h2>

            <p className="text-gray-400 text-lg max-w-lg mx-auto mb-10">
              Pick a plan, sign up in 60 seconds, and start automating your
              agency today. No meetings required — but we&apos;re here if you
              want a walkthrough.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/pricing"
                className="group flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all hover:shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #c8a855, #b89840)",
                  color: "#0b0d12",
                  boxShadow: "0 0 40px rgba(200,168,85,0.15)",
                }}
              >
                See Plans &amp; Start Now
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </Link>
              <Link
                href="/book"
                className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
              >
                Or book a free call
                <ChevronRight size={14} />
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────────────── */}
      <footer
        className="py-12 px-6"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <Image
                  src="/icons/shortstack-logo.png"
                  alt="ShortStack"
                  width={28}
                  height={28}
                  className="w-7 h-7"
                />
                <span className="text-white font-bold text-sm">
                  ShortStack OS
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                The operating system for modern digital marketing agencies.
              </p>
            </div>

            {/* Product */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Product
              </p>
              <ul className="space-y-2">
                {[
                  { label: "Features", href: "#features" },
                  { label: "Pricing", href: "/pricing" },
                  { label: "Desktop App", href: "#desktop" },
                  { label: "Changelog", href: "/changelog" },
                  { label: "Book a Call", href: "/book" },
                ].map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Company
              </p>
              <ul className="space-y-2">
                {[
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Login", href: "/login" },
                ].map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Contact
              </p>
              <a
                href="mailto:growth@shortstack.work"
                className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
              >
                growth@shortstack.work
              </a>
            </div>
          </div>

          <div
            className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
          >
            <p className="text-[10px] text-gray-700">
              &copy; {new Date().getFullYear()} ShortStack OS. All rights
              reserved.
            </p>
            <p className="text-[10px] text-gray-700">
              Built with AI. Designed for agencies.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
