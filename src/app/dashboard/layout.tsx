"use client";

import Sidebar from "@/components/sidebar";
import GlobalSearch from "@/components/global-search";
import ClientSwitcher from "@/components/client-switcher";
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

  // Show everything immediately — profile loads from cache, no spinner needed
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-60">
        <div className="sticky top-0 z-30 bg-gradient-header backdrop-blur-xl border-b border-border/30 px-5 lg:px-6 py-2.5 flex items-center justify-end gap-3 electron-drag">
          <div className="electron-no-drag flex items-center gap-3">
            <ClientSwitcher />
            <GlobalSearch />
          </div>
        </div>
        <div className="p-5 lg:p-6">
          {children}
        </div>
      </main>
      <VoiceAssistant />
      <ClientChatWidget />
    </div>
  );
}
