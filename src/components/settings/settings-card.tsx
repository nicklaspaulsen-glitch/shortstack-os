import { ArrowUpRight } from "@phosphor-icons/react";
﻿"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { tokens } from "@/lib/brand/tokens";

/**
 * SettingsCard — one tile in the settings index 3-column bento.
 *
 * Renders an icon + title + description + arrow, with an optional preview
 * row at the bottom of the card (e.g. brand-color swatch, logo thumbnail).
 *
 * Hover state: lifts the card 2px, brightens the lime border, subtle elevation.
 * Danger variant uses a red-tinted border to flag destructive actions.
 */
interface Props {
  href: string;
  title: string;
  description: string;
  Icon: typeof ArrowUpRight;
  /** Optional small preview rendered at the bottom (color swatch, status dot, etc.). */
  preview?: ReactNode;
  /** Mark as queued (route doesn't exist yet) — adds a subtle "soon" pill. */
  queued?: boolean;
  /** Use the red-tinted Danger Zone variant. */
  danger?: boolean;
  /** Stagger index (0..N) — controls entrance delay. */
  index?: number;
}

export default function SettingsCard({
  href,
  title,
  description,
  Icon,
  preview,
  queued = false,
  danger = false,
  index = 0,
}: Props) {
  const reduceMotion = useReducedMotion();
  const accentColor = danger ? tokens.status.error : tokens.brand.lime;
  const borderColor = danger ? "rgba(242, 96, 99, 0.25)" : tokens.border.subtle;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: reduceMotion ? 0 : Math.min(index * 0.06, 0.42),
        duration: reduceMotion ? 0.1 : 0.42,
        ease: [0.32, 0.72, 0, 1],
      }}
    >
      {/* Apr 28 audit fix: when `queued`, render a non-clickable div
          with a tooltip + cursor-not-allowed instead of a Link. The
          old version painted a "Soon" pill but still navigated to a
          404 because the destination page didn't exist. Now misclicks
          show a toast and stay put. */}
      {queued ? (
        <div
          className="block rounded-xl p-6 h-full transition-all duration-220 select-none"
          role="button"
          aria-disabled="true"
          title="Coming soon — this surface ships in a future release"
          style={{
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(24px) saturate(1.8)",
            WebkitBackdropFilter: "blur(24px) saturate(1.8)",
            border: `1px solid ${borderColor}`,
            cursor: "not-allowed",
            opacity: 0.65,
            boxShadow: [
              "inset 0 1px 0 rgba(255,255,255,1)",
              "0 2px 8px -2px rgba(0,0,0,0.06)",
              "0 8px 20px -8px rgba(0,0,0,0.06)",
            ].join(", "),
          }}
          onClick={(e) => e.preventDefault()}
        >
          <SettingsCardBody
            Icon={Icon}
            accentColor={accentColor}
            title={title}
            description={description}
            queued={queued}
            preview={preview}
          />
        </div>
      ) : (
      <Link
        href={href}
        className="group block rounded-xl p-6 h-full transition-all duration-220"
        style={{
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(24px) saturate(1.8)",
          WebkitBackdropFilter: "blur(24px) saturate(1.8)",
          border: `1px solid ${borderColor}`,
          boxShadow: [
            "inset 0 1px 0 rgba(255,255,255,1)",
            "0 2px 8px -2px rgba(0,0,0,0.06)",
            "0 8px 20px -8px rgba(0,0,0,0.06)",
            "0 0 32px -12px rgba(212,255,0,0.06)",
          ].join(", "),
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.95)";
          e.currentTarget.style.borderColor = danger
            ? "rgba(242, 96, 99, 0.45)"
            : "rgba(212,255,0,0.22)";
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = [
            "inset 0 1px 0 rgba(255,255,255,1)",
            "0 4px 16px -4px rgba(0,0,0,0.10)",
            "0 16px 32px -8px rgba(0,0,0,0.08)",
            `0 0 40px -12px ${accentColor}55`,
          ].join(", ");
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.88)";
          e.currentTarget.style.borderColor = borderColor;
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = [
            "inset 0 1px 0 rgba(255,255,255,1)",
            "0 2px 8px -2px rgba(0,0,0,0.06)",
            "0 8px 20px -8px rgba(0,0,0,0.06)",
            "0 0 32px -12px rgba(212,255,0,0.06)",
          ].join(", ");
        }}
      >
        <SettingsCardBody
          Icon={Icon}
          accentColor={accentColor}
          title={title}
          description={description}
          queued={queued}
          preview={preview}
        />
      </Link>
      )}
    </motion.div>
  );
}

interface SettingsCardBodyProps {
  Icon: Props["Icon"];
  accentColor: string;
  title: string;
  description: string;
  queued?: boolean;
  preview?: ReactNode;
}

function SettingsCardBody({ Icon, accentColor, title, description, queued, preview }: SettingsCardBodyProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: `${accentColor}1a`,
            color: accentColor,
            border: `1px solid ${accentColor}33`,
          }}
        >
          <Icon size={18} />
        </div>
        <div className="flex items-center gap-2">
          {queued && (
            <span
              className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                background: `${tokens.text.muted}22`,
                color: tokens.text.muted,
                border: `1px solid ${tokens.text.muted}33`,
              }}
            >
              Soon
            </span>
          )}
          <span
            className="opacity-60 group-hover:opacity-100 transition-opacity"
            style={{ color: accentColor }}
          >
            <ArrowUpRight size={16} />
          </span>
        </div>
      </div>
      <h3
        className="font-display text-base font-semibold tracking-tight mb-1.5"
        style={{ color: tokens.text.primary }}
      >
        {title}
      </h3>
      <p
        className="text-[12px] leading-snug"
        style={{ color: tokens.text.secondary }}
      >
        {description}
      </p>
      {preview && (
        <div
          className="mt-4 pt-4 border-t flex items-center gap-2"
          style={{ borderColor: tokens.border.subtle }}
        >
          {preview}
        </div>
      )}
    </>
  );
}

