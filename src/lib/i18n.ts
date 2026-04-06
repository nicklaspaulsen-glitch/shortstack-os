import { useState, useEffect } from "react";

const translations: Record<string, Record<string, string>> = {
  // Navigation & Layout
  dashboard: { en: "Dashboard", da: "Kontrolpanel" },
  settings: { en: "Settings", da: "Indstillinger" },
  clients: { en: "Clients", da: "Kunder" },
  leads: { en: "Leads", da: "Leads" },
  content: { en: "Content", da: "Indhold" },
  analytics: { en: "Analytics", da: "Analyser" },
  search: { en: "Search", da: "Soeg" },
  save: { en: "Save", da: "Gem" },
  cancel: { en: "Cancel", da: "Annuller" },
  delete: { en: "Delete", da: "Slet" },
  loading: { en: "Loading...", da: "Indlaeser..." },
  error: { en: "Error", da: "Fejl" },
  success: { en: "Success", da: "Succes" },

  // Common phrases
  welcome_back: { en: "Welcome back", da: "Velkommen tilbage" },
  command_center: { en: "Command Center", da: "Kommandocentral" },
  ai_agents: { en: "AI Agents", da: "AI Agenter" },
  lead_finder: { en: "Lead Finder", da: "Lead Finder" },
  no_data_yet: { en: "No data yet", da: "Ingen data endnu" },

  // Actions
  create: { en: "Create", da: "Opret" },
  edit: { en: "Edit", da: "Rediger" },
  update: { en: "Update", da: "Opdater" },
  confirm: { en: "Confirm", da: "Bekraeft" },
  export: { en: "Export", da: "Eksporter" },
  import: { en: "Import", da: "Importer" },
  refresh: { en: "Refresh", da: "Opdater" },
  submit: { en: "Submit", da: "Indsend" },
  close: { en: "Close", da: "Luk" },
  back: { en: "Back", da: "Tilbage" },
  next: { en: "Next", da: "Naeste" },
  previous: { en: "Previous", da: "Forrige" },

  // Status
  active: { en: "Active", da: "Aktiv" },
  inactive: { en: "Inactive", da: "Inaktiv" },
  pending: { en: "Pending", da: "Afventer" },
  completed: { en: "Completed", da: "Faerdig" },
  failed: { en: "Failed", da: "Fejlet" },
  draft: { en: "Draft", da: "Kladde" },
  published: { en: "Published", da: "Publiceret" },

  // Features
  outreach: { en: "Outreach", da: "Raekkevidde" },
  automation: { en: "Automation", da: "Automatisering" },
  integrations: { en: "Integrations", da: "Integrationer" },
  notifications: { en: "Notifications", da: "Notifikationer" },
  billing: { en: "Billing", da: "Fakturering" },
  reports: { en: "Reports", da: "Rapporter" },
  team: { en: "Team", da: "Hold" },
  profile: { en: "Profile", da: "Profil" },
  help: { en: "Help", da: "Hjaelp" },
  logout: { en: "Log out", da: "Log ud" },
  login: { en: "Log in", da: "Log ind" },
  sign_up: { en: "Sign up", da: "Tilmeld" },
};

const STORAGE_KEY = "ss-lang";
const DEFAULT_LANG = "en";

export function t(key: string, lang?: string): string {
  const language = lang || (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG : DEFAULT_LANG);
  const entry = translations[key];
  if (!entry) return key;
  return entry[language] || entry[DEFAULT_LANG] || key;
}

export function useLanguage() {
  const [lang, setLang] = useState(DEFAULT_LANG);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === "en" || stored === "da")) {
      setLang(stored);
    }
  }, []);

  function changeLanguage(newLang: string) {
    setLang(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
  }

  return { lang, changeLanguage, t: (key: string) => t(key, lang) };
}
