"use client";

import Sidebar from "@/components/sidebar";
import GlobalSearch from "@/components/global-search";
import { useAuth } from "@/lib/auth-context";
import { PageLoading } from "@/components/ui/loading";
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

  if (loading) return <PageLoading />;
  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64">
        {/* Top bar with search */}
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border/50 px-6 lg:px-8 py-3 flex items-center justify-end">
          <GlobalSearch />
        </div>
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
