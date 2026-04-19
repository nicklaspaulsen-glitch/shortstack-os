"use client";

import { useEffect, useState, useCallback } from "react";
import { X, ArrowRight, Sparkles, LayoutDashboard, Bot, Search, Share2, MessageCircle } from "lucide-react";

interface TourStep {
  title: string;
  description: string;
  target: string;
  position: "bottom" | "right" | "left" | "top";
}

const STEPS: TourStep[] = [
  {
    title: "Welcome to Trinity",
    description: "Your all-in-one agency operating system. Let us show you around so you can hit the ground running.",
    target: "[data-tour='welcome']",
    position: "bottom",
  },
  {
    title: "Your Dashboard",
    description: "Track MRR, active clients, leads, and key performance metrics at a glance.",
    target: "[data-tour='stats']",
    position: "bottom",
  },
  {
    title: "AI Agents",
    description: "Automate outreach, content creation, and client management with intelligent AI agents.",
    target: "[data-tour='ai-agents']",
    position: "right",
  },
  {
    title: "Lead Finder",
    description: "Discover and qualify new prospects automatically using our scraping and enrichment tools.",
    target: "[data-tour='leads']",
    position: "right",
  },
  {
    title: "Social Manager",
    description: "Schedule posts, manage content calendars, and track engagement across all platforms.",
    target: "[data-tour='social']",
    position: "right",
  },
  {
    title: "Get Help",
    description: "Ask Trinity AI anything about your agency. She can pull reports, send messages, and run automations.",
    target: "[data-tour='trinity']",
    position: "top",
  },
];

const ICONS = [Sparkles, LayoutDashboard, Bot, Search, Share2, MessageCircle];

interface OnboardingTourProps {
  onComplete: () => void;
}

export default function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const completed = localStorage.getItem("tour_completed");
    if (completed) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const updateSpotlight = useCallback(() => {
    const step = STEPS[currentStep];
    const el = document.querySelector(step.target);
    if (el) {
      setSpotlightRect(el.getBoundingClientRect());
    } else {
      setSpotlightRect(null);
    }
  }, [currentStep]);

  useEffect(() => {
    if (!visible) return;
    updateSpotlight();
    window.addEventListener("resize", updateSpotlight);
    return () => window.removeEventListener("resize", updateSpotlight);
  }, [visible, currentStep, updateSpotlight]);

  const completeTour = useCallback(() => {
    localStorage.setItem("tour_completed", "true");
    setVisible(false);
    onComplete();
  }, [onComplete]);

  const handleNext = () => {
    if (currentStep >= STEPS.length - 1) {
      completeTour();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  if (!visible) return null;

  const step = STEPS[currentStep];
  const Icon = ICONS[currentStep];
  const padding = 8;

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!spotlightRect) {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }
    const gap = 12;
    switch (step.position) {
      case "bottom":
        return { top: spotlightRect.bottom + gap, left: spotlightRect.left + spotlightRect.width / 2, transform: "translateX(-50%)" };
      case "top":
        return { bottom: window.innerHeight - spotlightRect.top + gap, left: spotlightRect.left + spotlightRect.width / 2, transform: "translateX(-50%)" };
      case "right":
        return { top: spotlightRect.top + spotlightRect.height / 2, left: spotlightRect.right + gap, transform: "translateY(-50%)" };
      case "left":
        return { top: spotlightRect.top + spotlightRect.height / 2, right: window.innerWidth - spotlightRect.left + gap, transform: "translateY(-50%)" };
    }
  };

  // Spotlight clip path (dark overlay with cutout)
  const getClipPath = () => {
    if (!spotlightRect) return "none";
    const x = spotlightRect.x - padding;
    const y = spotlightRect.y - padding;
    const w = spotlightRect.width + padding * 2;
    const h = spotlightRect.height + padding * 2;
    const r = 12;
    return `polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
      ${x + r}px ${y}px,
      ${x + w - r}px ${y}px,
      ${x + w}px ${y + r}px,
      ${x + w}px ${y + h - r}px,
      ${x + w - r}px ${y + h}px,
      ${x + r}px ${y + h}px,
      ${x}px ${y + h - r}px,
      ${x}px ${y + r}px,
      ${x + r}px ${y}px
    )`;
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
      {/* Dark overlay with spotlight cutout */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.7)",
          clipPath: getClipPath(),
          transition: "clip-path 0.3s ease",
        }}
      />

      {/* Spotlight glow ring */}
      {spotlightRect && (
        <div
          style={{
            position: "fixed",
            top: spotlightRect.y - padding,
            left: spotlightRect.x - padding,
            width: spotlightRect.width + padding * 2,
            height: spotlightRect.height + padding * 2,
            borderRadius: 12,
            boxShadow: "0 0 0 4px rgba(139,92,246,0.5), 0 0 24px rgba(139,92,246,0.3)",
            pointerEvents: "none",
            transition: "all 0.3s ease",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        style={{
          position: "fixed",
          ...getTooltipStyle(),
          maxWidth: 320,
          zIndex: 10000,
        }}
        className="bg-[#1a1a2e] border border-purple-500/30 rounded-xl p-4 shadow-2xl"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Icon className="w-4 h-4 text-purple-400" />
            </div>
            <h3 className="text-xs font-bold text-foreground">{step.title}</h3>
          </div>
          <button
            onClick={completeTour}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-[10px] text-zinc-400 leading-relaxed mb-3">
          {step.description}
        </p>

        <div className="flex items-center justify-between">
          <button
            onClick={completeTour}
            className="text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-3">
            <span className="text-[9px] text-zinc-500">
              {currentStep + 1}/{STEPS.length}
            </span>
            <button
              onClick={handleNext}
              className="btn-primary flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg"
            >
              {currentStep === STEPS.length - 1 ? "Finish" : "Next"}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1 mt-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === currentStep ? "bg-purple-400" : i < currentStep ? "bg-purple-400/40" : "bg-zinc-600"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
