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

  // Show everything immediately — profile loads from cache, no spinner needed
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64">
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border/50 px-6 lg:px-8 py-3 flex items-center justify-end">
          <GlobalSearch />
        </div>
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
      <VoiceAssistant />
      <ClientChatWidget />
    </div>
  );
}
