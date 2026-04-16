// ── Plugin Manifest Types & Validation ──

export interface PluginManifest {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  longDescription?: string;
  icon: string;
  iconColor: string;
  category: "crm" | "marketing" | "analytics" | "ai" | "automation" | "communication" | "integrations";
  price: number; // 0 = free, else $/mo
  permissions: string[];
  hooks: string[];
  settingsSchema: PluginSetting[];
  tags: string[];
  rating: number;
  installs: number;
  verified: boolean;
  features?: string[];
  changelog?: { version: string; date: string; notes: string }[];
  requirements?: string[];
}

export interface PluginSetting {
  key: string;
  label: string;
  type: "text" | "toggle" | "select" | "number";
  default?: string | boolean | number;
  options?: string[];
  required?: boolean;
}

export interface PluginInstance {
  manifest: PluginManifest;
  enabled: boolean;
  config: Record<string, string | boolean | number>;
  installedAt: string;
  lastUpdated: string;
  health: "healthy" | "warning" | "error";
}

export function validateManifest(manifest: unknown): manifest is PluginManifest {
  if (!manifest || typeof manifest !== "object") return false;
  const m = manifest as Record<string, unknown>;
  const requiredStrings = ["id", "name", "author", "version", "description", "icon", "iconColor"];
  for (const key of requiredStrings) {
    if (typeof m[key] !== "string" || !(m[key] as string).length) return false;
  }
  if (typeof m.price !== "number" || m.price < 0) return false;
  if (!Array.isArray(m.permissions)) return false;
  if (!Array.isArray(m.hooks)) return false;
  if (!Array.isArray(m.settingsSchema)) return false;
  if (!Array.isArray(m.tags)) return false;
  if (typeof m.rating !== "number" || m.rating < 0 || m.rating > 5) return false;
  if (typeof m.installs !== "number") return false;
  const validCategories = ["crm", "marketing", "analytics", "ai", "automation", "communication", "integrations"];
  if (!validCategories.includes(m.category as string)) return false;
  return true;
}
