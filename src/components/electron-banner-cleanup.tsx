"use client";

import { useEffect } from "react";

/**
 * Electron injects DOM banners (ss-update-banner, ss-deploy-banner) for
 * update/download status via executeJavaScript(). If a download fails or
 * the URL is empty, these banners get permanently stuck.
 *
 * This component runs in the web content (renderer process) and
 * aggressively removes stale banners. Works even with old packaged
 * Electron builds that have the buggy update code.
 */
export default function ElectronBannerCleanup() {
  useEffect(() => {
    // Only run in Electron (navigator.userAgent contains "Electron")
    const isElectron =
      typeof navigator !== "undefined" &&
      navigator.userAgent.toLowerCase().includes("electron");
    if (!isElectron) return;

    const cleanStaleBanners = () => {
      const ids = ["ss-update-banner", "ss-deploy-banner"];
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
    };

    // Aggressive cleanup schedule — Electron injects banners at various
    // times after page load (checkForUpdates runs on did-finish-load)
    const timers = [300, 1000, 2000, 4000, 8000].map((ms) =>
      setTimeout(cleanStaleBanners, ms)
    );

    // Keep watching — the web deploy checker polls every 5 minutes
    const interval = setInterval(cleanStaleBanners, 15000);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, []);

  return null;
}
