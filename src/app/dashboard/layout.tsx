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
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen">
      {/* Floating particles background */}
      <FloatingParticles count={15} />

      {/* Top border accent */}
      <div className="top-border-bar" />

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-60 h-full">
            <Sidebar />
            <button onClick={() => setMobileMenuOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-surface-light text-muted hover:text-white z-50">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 lg:ml-60">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-gradient-header backdrop-blur-xl border-b border-border/30 px-4 lg:px-6 py-2.5 flex items-center justify-between electron-drag">
          {/* Left — mobile menu + brand */}
          <div className="electron-no-drag flex items-center gap-2 lg:hidden">
            <button onClick={() => setMobileMenuOpen(true)} className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-surface-light/50 transition-colors">
              <Menu size={18} />
            </button>
          </div>

          {/* Right — actions */}
          <div className="electron-no-drag flex items-center gap-2 ml-auto">
            <ClientSwitcher />
            <Notifications />
            <GlobalSearch />
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
  );
}
