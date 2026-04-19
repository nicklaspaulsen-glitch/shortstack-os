"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BRAND } from "@/lib/brand-config";

/**
 * Sticky translucent top nav for the landing page.
 */
export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
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
          <Link
            href="#why"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Why {BRAND.product_name}
          </Link>
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
            How it works
          </Link>
          <Link
            href="/pricing"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="#faq"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
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
            className="text-sm font-semibold px-5 py-2 rounded-lg transition-all hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #c8a855, #b89840)",
              color: "#0b0d12",
            }}
          >
            Start free trial
          </Link>
        </div>
      </div>
    </nav>
  );
}
