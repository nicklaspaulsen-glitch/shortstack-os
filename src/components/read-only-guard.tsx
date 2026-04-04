"use client";

import { useAuth } from "@/lib/auth-context";
import { ReactNode } from "react";
import { Download } from "lucide-react";

// Wraps action buttons — shows install prompt in browser, allows action in PWA
export default function ActionGuard({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { isPWA, profile } = useAuth();

  // Admins in PWA can do everything
  if (isPWA || profile?.role === "admin") {
    return <>{children}</>;
  }

  // Browser users see read-only notice or custom fallback
  if (fallback) return <>{fallback}</>;

  return (
    <div className="relative group">
      <div className="opacity-50 pointer-events-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="text-center px-3">
          <Download size={16} className="text-gold mx-auto mb-1" />
          <p className="text-xs text-white">Install the app to edit</p>
        </div>
      </div>
    </div>
  );
}

// Banner shown at top of dashboard in browser mode
export function BrowserModeBanner() {
  const { isPWA, profile } = useAuth();

  // Don't show for PWA users or admin override
  if (isPWA || !profile) return null;

  // Only show for non-admin client users in browser
  if (profile.role === "admin") return null;

  return (
    <div className="bg-gold/10 border border-gold/20 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Download size={16} className="text-gold" />
        <p className="text-sm">
          <span className="text-gold font-medium">View-only mode.</span>
          <span className="text-muted"> Install ShortStack OS as an app to make changes.</span>
        </p>
      </div>
      <button
        onClick={() => {
          // Trigger PWA install prompt if available
          const deferredPrompt = (window as unknown as Record<string, unknown>).__pwaInstallPrompt;
          if (deferredPrompt && typeof (deferredPrompt as Record<string, () => void>).prompt === "function") {
            (deferredPrompt as Record<string, () => void>).prompt();
          } else {
            alert("To install: click the install icon in your browser address bar, or use your browser menu > Install app");
          }
        }}
        className="btn-primary text-xs py-1 px-3"
      >
        Install App
      </button>
    </div>
  );
}
