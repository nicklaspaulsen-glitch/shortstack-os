"use client";

import { useState, useEffect } from "react";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  function accept() {
    localStorage.setItem("cookie-consent", "accepted");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-surface border border-border/40 rounded-lg p-4 shadow-xl backdrop-blur-sm">
        <p className="text-xs text-muted leading-relaxed mb-3">
          We use essential cookies for authentication and preferences. No tracking cookies.{" "}
          <a href="/privacy" className="text-gold hover:text-gold/80 underline underline-offset-2">
            Privacy Policy
          </a>
        </p>
        <div className="flex gap-2">
          <button
            onClick={accept}
            className="flex-1 px-3 py-1.5 bg-gold/10 text-gold text-xs font-medium rounded border border-gold/20 hover:bg-gold/20 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
