"use client";

import Sidebar from "@/components/sidebar";
import GlobalSearch from "@/components/global-search";
import ClientChatWidget from "@/components/client-chat-widget";
import VoiceAssistant from "@/components/voice-assistant";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Always show sidebar + layout immediately — never show blank loading screen
  // The sidebar defaults to admin links, content area shows loading if needed
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64">
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border/50 px-6 lg:px-8 py-3 flex items-center justify-end">
          <GlobalSearch />
        </div>
        <div className="p-6 lg:p-8">
          {loading ? (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
                <span className="text-sm text-muted">Loading ShortStack OS...</span>
              </div>
            </div>
          ) : !user ? null : children}
        </div>
      </main>
      {/* Voice assistant + Chat widget */}
      <VoiceAssistant />
      <ClientChatWidget />
    </div>
  );
}
