"use client";

import Link from "next/link";
import Image from "next/image";
import { BRAND } from "@/lib/brand-config";

export default function LandingFooter() {
  return (
    <footer
      className="py-12 px-6"
      style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <Image
                src={BRAND.logo_svg}
                alt={BRAND.product_name}
                width={28}
                height={28}
                className="w-7 h-7"
              />
              <div className="leading-tight">
                <div className="text-white font-bold text-sm">
                  {BRAND.product_name}
                </div>
                <div className="text-[10px] text-gray-500 font-medium">
                  by {BRAND.company_name}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              The AI operating system for modern digital marketing agencies.
              Built by operators at {BRAND.company_name} Digital.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Product
            </p>
            <ul className="space-y-2">
              {[
                { label: "Features", href: "#features" },
                { label: "Why we built this", href: "#why" },
                { label: "How it works", href: "#how-it-works" },
                { label: "Pricing", href: "/pricing" },
                { label: "Changelog", href: "/changelog" },
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

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Company
            </p>
            <ul className="space-y-2">
              {[
                { label: "Book a demo", href: "/book" },
                { label: "Login", href: "/login" },
                { label: "Terms of Service", href: "/terms" },
                { label: "Privacy Policy", href: "/privacy" },
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

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Contact
            </p>
            <a
              href="mailto:growth@shortstack.work"
              className="text-xs text-gray-600 hover:text-gray-300 transition-colors block mb-2"
            >
              growth@shortstack.work
            </a>
            <p className="text-xs text-gray-600 leading-relaxed">
              Real humans. Usually reply within a few hours on weekdays.
            </p>
          </div>
        </div>

        <div
          className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          <p className="text-[10px] text-gray-700">
            &copy; {new Date().getFullYear()} {BRAND.company_name} Digital.
            {" "}
            {BRAND.product_name} is a product of {BRAND.company_name}. All
            rights reserved.
          </p>
          <p className="text-[10px] text-gray-700">
            Built by agency operators. Designed for agency operators.
          </p>
        </div>
      </div>
    </footer>
  );
}
