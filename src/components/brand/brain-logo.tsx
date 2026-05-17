"use client"

import React from "react"

interface BrainLogoProps {
  size?: number
  className?: string
}

/**
 * Trinity OS split-brain logo.
 * Left hemisphere: blue → violet gradient
 * Right hemisphere: orange → pink gradient
 * Center fissure with white highlight line
 */
export default function BrainLogo({ size = 32, className = "" }: BrainLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Left hemisphere: blue → violet */}
        <linearGradient id="grad-left" x1="0" y1="0" x2="20" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="55%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>

        {/* Right hemisphere: amber → rose */}
        <linearGradient id="grad-right" x1="40" y1="0" x2="20" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FB923C" />
          <stop offset="50%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#F472B6" />
        </linearGradient>

        {/* Glow under brain */}
        <filter id="brain-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Clip left half */}
        <clipPath id="clip-left">
          <rect x="0" y="0" width="20" height="40" />
        </clipPath>

        {/* Clip right half */}
        <clipPath id="clip-right">
          <rect x="20" y="0" width="20" height="40" />
        </clipPath>
      </defs>

      {/* ─── Full brain silhouette, clipped to left then right ─── */}

      {/* Left hemisphere fill */}
      <g clipPath="url(#clip-left)">
        {/* Outer left lobe */}
        <path
          d="M20 7
             C20 7 15.5 5 11 6.5
             C7 7.8 4.5 11 4 14.5
             C3.3 18.5 4.5 21.5 6 24
             C7.5 26.5 8 28 8.5 30
             C9 32.5 10 34.5 12 35.5
             C14.5 36.8 17 36 20 35.5
             L20 7Z"
          fill="url(#grad-left)"
        />
        {/* Inner cortex fold lines — left */}
        <path
          d="M14 11 C13 13.5 12.5 15 14 17"
          stroke="rgba(255,255,255,0.30)"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M8 18 C9.5 19.5 10 21 9 23"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M11 27 C12.5 28 13 30 12 32"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* Right hemisphere fill */}
      <g clipPath="url(#clip-right)">
        {/* Outer right lobe */}
        <path
          d="M20 7
             C20 7 24.5 5 29 6.5
             C33 7.8 35.5 11 36 14.5
             C36.7 18.5 35.5 21.5 34 24
             C32.5 26.5 32 28 31.5 30
             C31 32.5 30 34.5 28 35.5
             C25.5 36.8 23 36 20 35.5
             L20 7Z"
          fill="url(#grad-right)"
        />
        {/* Inner cortex fold lines — right */}
        <path
          d="M26 11 C27 13.5 27.5 15 26 17"
          stroke="rgba(255,255,255,0.30)"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M32 18 C30.5 19.5 30 21 31 23"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M29 27 C27.5 28 27 30 28 32"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* ─── Brain stem ─── */}
      <path
        d="M17.5 35.5 C17.5 37.5 19 38.5 20 38.5 C21 38.5 22.5 37.5 22.5 35.5"
        stroke="rgba(255,255,255,0.40)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* ─── Center fissure highlight ─── */}
      <line
        x1="20"
        y1="7"
        x2="20"
        y2="35.5"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeDasharray="1.5 2"
      />
    </svg>
  )
}
