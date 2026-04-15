"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface WhiteLabelConfig {
  company_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  favicon_url: string | null;
  login_text: string | null;
  show_powered_by: boolean;
}

const DEFAULTS: WhiteLabelConfig = {
  company_name: "ShortStack",
  logo_url: "/icons/shortstack-logo.png",
  primary_color: "#C9A84C",
  accent_color: "#B8942F",
  favicon_url: null,
  login_text: null,
  show_powered_by: true,
};

interface WhiteLabelContextType {
  config: WhiteLabelConfig;
  loading: boolean;
  /** Re-fetch config from the server */
  refresh: () => Promise<void>;
}

const WhiteLabelContext = createContext<WhiteLabelContextType>({
  config: DEFAULTS,
  loading: true,
  refresh: async () => {},
});

export function WhiteLabelProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<WhiteLabelConfig>(() => {
    // Hydrate from localStorage for instant display
    if (typeof window === "undefined") return DEFAULTS;
    try {
      const cached = localStorage.getItem("ss_white_label");
      return cached ? { ...DEFAULTS, ...JSON.parse(cached) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });
  const [loading, setLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`/api/white-label?t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.config) {
          const merged: WhiteLabelConfig = {
            company_name: json.config.company_name || DEFAULTS.company_name,
            logo_url: json.config.logo_url || DEFAULTS.logo_url,
            primary_color: json.config.primary_color || DEFAULTS.primary_color,
            accent_color: json.config.accent_color || DEFAULTS.accent_color,
            favicon_url: json.config.favicon_url || DEFAULTS.favicon_url,
            login_text: json.config.login_text || DEFAULTS.login_text,
            show_powered_by: json.config.show_powered_by ?? DEFAULTS.show_powered_by,
          };
          setConfig(merged);
          localStorage.setItem("ss_white_label", JSON.stringify(merged));

          // Apply primary color as CSS variable override
          if (merged.primary_color && merged.primary_color !== DEFAULTS.primary_color) {
            document.documentElement.style.setProperty("--color-accent", merged.primary_color);
            document.documentElement.style.setProperty("--wl-primary", merged.primary_color);
          }
          if (merged.accent_color && merged.accent_color !== DEFAULTS.accent_color) {
            document.documentElement.style.setProperty("--wl-accent", merged.accent_color);
          }
        }
      }
    } catch {
      // Silently fall back to defaults / cached
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply CSS overrides on config change (e.g. after save in settings)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (config.primary_color && config.primary_color !== DEFAULTS.primary_color) {
      document.documentElement.style.setProperty("--color-accent", config.primary_color);
      document.documentElement.style.setProperty("--wl-primary", config.primary_color);
    }
    if (config.accent_color && config.accent_color !== DEFAULTS.accent_color) {
      document.documentElement.style.setProperty("--wl-accent", config.accent_color);
    }
  }, [config.primary_color, config.accent_color]);

  return (
    <WhiteLabelContext.Provider value={{ config, loading, refresh: fetchConfig }}>
      {children}
    </WhiteLabelContext.Provider>
  );
}

export function useWhiteLabel() {
  return useContext(WhiteLabelContext);
}
