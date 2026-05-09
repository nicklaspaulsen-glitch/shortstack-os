"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BRAND } from "@/lib/brand-config";

/**
 * Sticky translucent top nav for the landing page.
 * Upgraded: Framer Motion AnimatePresence for mobile drawer.
 */
export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => setMenuOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const linkClass =
    "text-sm text-gray-400 hover:text-white transition-colors duration-150";

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background:
          scrolled || menuOpen
            ? "rgba(10, 10, 13, 0.88)"
            : "transparent",
        backdropFilter: scrolled || menuOpen ? "blur(16px) saturate(1.4)" : "none",
        WebkitBackdropFilter:
          scrolled || menuOpen ? "blur(16px) saturate(1.4)" : "none",
        borderBottom:
          scrolled || menuOpen
            ? "1px solid rgba(255,255,255,0.06)"
            : "1px solid transparent",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          onClick={() => setMenuOpen(false)}
        >
          <Image
            src={BRAND.logo_svg}
            alt={BRAND.product_name}
            width={32}
            height={32}
            className="w-8 h-8"
          />
          <span className="text-white font-bold tracking-tight leading-tight flex flex-col">
            <span>{BRAND.product_name}</span>
            <span className="text-[9px] font-medium text-gray-400 tracking-wide">
              by {BRAND.company_name}
            </span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <Link href="#why" className={linkClass}>
            Why {BRAND.product_name}
          </Link>
          <Link href="#features" className={linkClass}>
            Features
          </Link>
          <Link href="#how-it-works" className={linkClass}>
            How it works
          </Link>
          <Link href="/pricing" className={linkClass}>
            Pricing
          </Link>
          <Link href="#faq" className={linkClass}>
            FAQ
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
            className="text-sm font-semibold px-5 py-2 rounded-lg transition-all duration-200 hover:opacity-90 hidden sm:inline-block"
            style={{
              background: "linear-gradient(135deg, #FF2D2D, #CC2424)",
              color: "#fff",
            }}
          >
            Start free trial
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            <AnimatePresence mode="wait" initial={false}>
              {menuOpen ? (
                <motion.span
                  key="close"
                  initial={{ rotate: -45, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 45, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X size={18} />
                </motion.span>
              ) : (
                <motion.span
                  key="open"
                  initial={{ rotate: 45, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -45, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Menu size={18} />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* Mobile drawer — AnimatePresence slide-down */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="drawer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden overflow-hidden border-t border-white/5"
            style={{
              background: "rgba(10, 10, 13, 0.92)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, delay: 0.05 }}
              className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-3"
            >
              <Link
                href="#why"
                className={linkClass}
                onClick={() => setMenuOpen(false)}
              >
                Why {BRAND.product_name}
              </Link>
              <Link
                href="#features"
                className={linkClass}
                onClick={() => setMenuOpen(false)}
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
                className={linkClass}
                onClick={() => setMenuOpen(false)}
              >
                How it works
              </Link>
              <Link
                href="/pricing"
                className={linkClass}
                onClick={() => setMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="#faq"
                className={linkClass}
                onClick={() => setMenuOpen(false)}
              >
                FAQ
              </Link>
              <div className="pt-2 mt-2 border-t border-white/5 flex flex-col gap-2">
                <Link
                  href="/login"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  href="/pricing"
                  className="text-sm font-semibold px-5 py-2 rounded-lg transition-all hover:opacity-90 text-center"
                  style={{
                    background: "linear-gradient(135deg, #FF2D2D, #CC2424)",
                    color: "#fff",
                  }}
                  onClick={() => setMenuOpen(false)}
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
