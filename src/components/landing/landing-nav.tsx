"use client";

/**
 * LandingNav — Aave-style floating pill navbar with scroll-spy.
 *
 * Enhancements over the original:
 *   - Shared layoutId="nav-active-pill" indicator that slides between
 *     the active anchor link using Framer Motion's layout animation.
 *   - IntersectionObserver scroll-spy: whichever section is most in view
 *     gets highlighted in the navbar.
 *   - Animated burger icon (three bars → X morphing).
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { BRAND } from "@/lib/brand-config";

// ---------------------------------------------------------------------------
// Nav links definition
// ---------------------------------------------------------------------------

interface NavLink {
  label: string;
  href: string;
  /** Matching section id for scroll-spy (without #). null = external page. */
  sectionId: string | null;
}

const NAV_LINKS: NavLink[] = [
  { label: `Why ${BRAND.product_name}`, href: "#why", sectionId: "why" },
  { label: "Features", href: "#features", sectionId: "features" },
  { label: "How it works", href: "#how-it-works", sectionId: "how-it-works" },
  { label: "Pricing", href: "/pricing", sectionId: null },
  { label: "FAQ", href: "#faq", sectionId: "faq" },
];

// ---------------------------------------------------------------------------
// Animated burger icon
// ---------------------------------------------------------------------------

function BurgerIcon({ open }: { open: boolean }) {
  const barBase =
    "block h-[1.5px] bg-current rounded-full transition-all duration-200 origin-center";

  return (
    <div className="flex flex-col items-center justify-center gap-[5px] w-5 h-5">
      <span
        className={barBase}
        style={{
          width: open ? "18px" : "16px",
          transform: open ? "translateY(6.5px) rotate(45deg)" : "none",
        }}
      />
      <span
        className={barBase}
        style={{ width: "18px", opacity: open ? 0 : 1 }}
      />
      <span
        className={barBase}
        style={{
          width: open ? "18px" : "12px",
          transform: open ? "translateY(-6.5px) rotate(-45deg)" : "none",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LandingNav() {
  const [scrolled, setScrolled]       = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [activeSection, setActive]    = useState<string | null>(null);

  // Scroll shadow trigger
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close drawer on desktop resize
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => { if (mq.matches) setMenuOpen(false); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Scroll-spy via IntersectionObserver
  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.sectionId).filter(Boolean) as string[];
    if (!ids.length) return;

    const observers: IntersectionObserver[] = [];
    const ratios: Record<string, number> = {};

    const pick = () => {
      const best = ids.reduce<string | null>((prev, id) =>
        (ratios[id] ?? 0) >= (ratios[prev ?? ""] ?? 0) ? id : prev, null);
      setActive((ratios[best ?? ""] ?? 0) > 0.1 ? best : null);
    };

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { ratios[id] = entry.intersectionRatio; pick(); },
        { threshold: [0, 0.1, 0.3, 0.5, 0.75, 1.0] },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const close = useCallback(() => setMenuOpen(false), []);

  return (
    <nav
      className="fixed top-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[min(900px,calc(100vw-2rem))] z-50 transition-all duration-300 rounded-2xl"
      style={{
        background: scrolled || menuOpen
          ? "rgba(7,7,8,0.88)"
          : "rgba(7,7,8,0.62)",
        backdropFilter: "blur(20px) saturate(1.6)",
        WebkitBackdropFilter: "blur(20px) saturate(1.6)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: scrolled
          ? "0 8px 32px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.06) inset"
          : "0 2px 16px rgba(0,0,0,0.2), 0 1px 0 rgba(255,255,255,0.04) inset",
      }}
    >
      <div className="px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5" onClick={close}>
          <Image
            src={BRAND.logo_svg}
            alt={BRAND.product_name}
            width={32}
            height={32}
            className="w-8 h-8"
          />
          <span className="text-white font-bold tracking-tight leading-tight flex flex-col">
            <span>{BRAND.product_name}</span>
            <span className="text-[9px] font-medium text-text-muted tracking-wide">
              by {BRAND.company_name}
            </span>
          </span>
        </Link>

        {/* Desktop nav — Aave-style with layoutId sliding pill */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = link.sectionId
              ? activeSection === link.sectionId
              : false;

            return (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-3.5 py-1.5 rounded-lg text-sm transition-colors duration-150"
                style={{
                  color: isActive ? "#ffffff" : "#6B6B7B",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.color = "#A8A8B2";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.color = "#6B6B7B";
                  }
                }}
              >
                {/* Sliding active pill */}
                {isActive && (
                  <motion.span
                    layoutId="nav-active-pill"
                    className="absolute inset-0 rounded-lg"
                    style={{
                      background: "rgba(59,130,246,0.16)",
                      border: "1px solid rgba(59,130,246,0.28)",
                    }}
                    initial={false}
                    transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  />
                )}
                <span className="relative z-10">{link.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right CTAs */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-text-muted hover:text-white transition-colors hidden sm:block"
          >
            Login
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-semibold px-5 py-2 rounded-lg transition-all duration-200 hidden sm:inline-block bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_16px_rgba(59,130,246,0.35)] hover:shadow-[0_0_24px_rgba(59,130,246,0.55)]"
          >
            Start free trial
          </Link>

          {/* Mobile burger */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <BurgerIcon open={menuOpen} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="drawer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden overflow-hidden border-t border-white/[0.06] rounded-b-2xl"
            style={{ background: "rgba(7,7,8,0.92)" }}
          >
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, delay: 0.05 }}
              className="px-6 py-4 flex flex-col gap-1"
            >
              {NAV_LINKS.map((link) => {
                const isActive = link.sectionId
                  ? activeSection === link.sectionId
                  : false;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={close}
                    className="relative px-3 py-2.5 rounded-lg text-sm transition-colors duration-150"
                    style={{ color: isActive ? "#ffffff" : "#6B6B7B" }}
                  >
                    {isActive && (
                      <span
                        className="absolute inset-0 rounded-lg"
                        style={{
                          background: "rgba(59,130,246,0.14)",
                          border: "1px solid rgba(59,130,246,0.24)",
                        }}
                      />
                    )}
                    <span className="relative z-10">{link.label}</span>
                  </Link>
                );
              })}

              <div className="pt-3 mt-2 border-t border-white/[0.06] flex flex-col gap-2">
                <Link
                  href="/login"
                  className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-2"
                  onClick={close}
                >
                  Login
                </Link>
                <Link
                  href="/pricing"
                  className="text-sm font-semibold px-5 py-2.5 rounded-lg transition-all text-center bg-blue-600 hover:bg-blue-500 text-white"
                  onClick={close}
                >
                  Start free trial
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
