"use client";

import Sidebar from "@/components/sidebar";
import GlobalSearch from "@/components/global-search";
import ClientSwitcher from "@/components/client-switcher";
import Notifications from "@/components/notifications";
import ClientChatWidget from "@/components/client-chat-widget";
import VoiceAssistant from "@/components/voice-assistant";
import OnboardingTour from "@/components/onboarding-tour";
import ErrorBoundary from "@/components/ui/error-boundary";
import CommandPalette from "@/components/command-palette";
import FloatingParticles from "@/components/ui/particles";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Menu, X } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Ctrl+scroll zoom — applies CSS transform instead of zoom to not break fixed positioning
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      setZoom(prev => {
        const next = prev + (e.deltaY > 0 ? -5 : 5);
        return Math.max(60, Math.min(140, next));
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Apply zoom via CSS variable on body so fixed elements scale properly
  useEffect(() => {
    document.documentElement.style.fontSize = `${zoom}%`;
    return () => { document.documentElement.style.fontSize = "100%"; };
  }, [zoom]);

  return (
    <>
      {/* Top accent bar — OUTSIDE everything, truly fixed full-width */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 3,
        background: "linear-gradient(90deg, #C9A84C 0%, #38bdf8 50%, #C9A84C 100%)",
        zIndex: 100000, pointerEvents: "none",
      }} />

      <div className="flex min-h-screen">
        {/* Floating particles background */}
        <FloatingParticles count={15} />

        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Mobile sidebar overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-56 h-full">
              <Sidebar />
              <button onClick={() => setMobileMenuOpen(false)}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-surface-light text-muted hover:text-white z-50">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 lg:ml-56">
          {/* Header */}
          <div className="sticky top-[3px] z-30 border-b border-white/[0.04] electron-drag"
            style={{ background: "rgba(6,8,12,0.92)", backdropFilter: "blur(24px) saturate(1.8)" }}>
            <div className="flex items-center justify-between px-5 lg:px-6 h-11">
              {/* Left — mobile menu */}
              <div className="electron-no-drag flex items-center gap-2 lg:hidden">
                <button onClick={() => setMobileMenuOpen(true)} className="p-1.5 rounded-md text-muted hover:text-white hover:bg-white/5 transition-colors">
                  <Menu size={16} />
                </button>
              </div>

              <div className="flex-1" />

              {/* Right — actions */}
              <div className="electron-no-drag flex items-center gap-1.5">
                {zoom !== 100 && (
                  <button onClick={() => setZoom(100)} className="text-[9px] text-muted/60 bg-white/[0.04] px-2 py-0.5 rounded hover:text-white transition-colors font-mono">
                    {zoom}%
                  </button>
                )}
                <ClientSwitcher />
                <Notifications />
                <GlobalSearch />
              </div>
            </div>
          </div>

          {/* Page content */}
          <div className="p-4 lg:p-6">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>
        <VoiceAssistant />
        <ClientChatWidget />
        <OnboardingTour onComplete={() => {}} />
        <CommandPalette />
      </div>
    </>
  );
}
