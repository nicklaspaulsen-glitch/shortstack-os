"use client";

/**
 * Full-featured sidebar customizer used in Settings > Sidebar.
 *
 * Features:
 *  - Three-column layout: library | layout | preview
 *  - Show/hide toggle per nav item
 *  - Custom groups (with optional nested sub-groups, 1 level deep)
 *  - Per-item controls: pin, rename, custom icon
 *  - Bulk actions: select all/none, AI Recommended, reset, presets (Minimal,
 *    Content Creator, Agency Power, Sales Only, Finance Ops, Custom)
 *  - Search bar across all nav items
 *  - Live preview mirrors the real sidebar visuals
 *  - Save / Discard Changes sticky bottom bar
 *
 * Data model expected at /api/user/sidebar-preferences:
 *  {
 *    enabled_items: string[],
 *    custom_groups: CustomGroup[],
 *    order_overrides: Record<string, number>,
 *    pins: string[],
 *    renames: Record<string, string>,
 *    icon_overrides: Record<string, string>,
 *    sidebar_position?: "left" | "right"
 *  }
 *
 * We include the newer fields (pins, renames, icon_overrides, sidebar_position)
 * in the payload. The existing API route validates/persists enabled_items,
 * custom_groups, order_overrides, business_type; unknown extra fields are
 * ignored silently so we stay backwards-compatible.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Sparkles, CheckSquare, Square, RotateCcw, Save, X, Plus, Pin,
  Eye, EyeOff, GripVertical, ChevronDown, ChevronRight, Trash2,
  Loader2, Layers, Settings2, Check, ArrowUp, ArrowDown, Wand2, PencilLine,
  Palette, PanelLeft, Home, Film, Users, Phone, DollarSign, BarChart3,
  Briefcase, Mail, Globe, Bot, Zap, Target, Crown, LayoutDashboard, Inbox,
  MessageSquare, Star, Calendar, FileText, Image as ImageIcon, Send, Gift,
  Heart, Calculator, Award, Bell,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import toast from "react-hot-toast";
import { SIDEBAR_CATEGORIES, ALL_SIDEBAR_ITEMS } from "@/lib/user-types";

/* ═══════════════════════════════════════════════════════════════════ */
/* Types                                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export interface CustomSubGroup {
  id: string;
  name: string;
  items: string[];
}

export interface CustomGroup {
  id: string;
  name: string;
  label?: string; // legacy alias for name
  icon: string;
  color: string;
  order: number;
  items: string[];
  subgroups: CustomSubGroup[];
}

export interface SidebarPrefs {
  enabled_items: string[];
  custom_groups: CustomGroup[];
  order_overrides: Record<string, number>;
  pins: string[];
  renames: Record<string, string>;
  icon_overrides: Record<string, string>;
  sidebar_position?: "left" | "right";
}

interface NavItemDef {
  href: string;
  label: string;
  section: string;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Flatten the sidebar category catalog to a simple list                */
/* ═══════════════════════════════════════════════════════════════════ */

const FLAT_NAV: NavItemDef[] = SIDEBAR_CATEGORIES.flatMap(cat =>
  cat.items.map(i => ({ href: i.href, label: i.label, section: cat.category }))
);

function labelForHref(href: string): string {
  return FLAT_NAV.find(i => i.href === href)?.label || href;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Icon picker — curated set of lucide icons                            */
/* ═══════════════════════════════════════════════════════════════════ */

const ICON_SET: Record<string, LucideIcon> = {
  Home, Film, Users, Phone, DollarSign, BarChart3, Briefcase, Mail,
  Globe, Bot, Zap, Target, Crown, LayoutDashboard, Inbox, MessageSquare,
  Star, Calendar, FileText, ImageIcon, Send, Gift, Heart, Calculator,
  Award, Bell, Layers, Sparkles, Settings2, Palette, PanelLeft,
};

const ICON_NAMES = Object.keys(ICON_SET);

/** Render a lucide icon by name (falls back to Layers). */
function IconByName({ name, size = 14, className }: { name: string; size?: number; className?: string }) {
  const Cmp = ICON_SET[name] || Layers;
  return <Cmp size={size} className={className} />;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Presets                                                              */
/* ═══════════════════════════════════════════════════════════════════ */

const PRESETS: { key: string; label: string; items: string[] }[] = [
  {
    key: "minimal",
    label: "Minimal",
    items: [
      "/dashboard",
      "/dashboard/inbox",
      "/dashboard/analytics",
      "/dashboard/settings",
    ],
  },
  {
    key: "creator",
    label: "Content Creator",
    items: [
      "/dashboard",
      "/dashboard/generations",
      "/dashboard/analytics",
      "/dashboard/script-lab",
      "/dashboard/video-editor",
      "/dashboard/ai-video",
      "/dashboard/thumbnail-generator",
      "/dashboard/carousel-generator",
      "/dashboard/design",
      "/dashboard/content-library",
      "/dashboard/brand-kit",
      "/dashboard/social-manager",
      "/dashboard/content-plan",
      "/dashboard/calendar",
      "/dashboard/community",
      "/dashboard/integrations",
      "/dashboard/settings",
    ],
  },
  {
    key: "agency",
    label: "Agency Power",
    items: [
      "/dashboard",
      "/dashboard/inbox",
      "/dashboard/generations",
      "/dashboard/analytics",
      "/dashboard/outreach-hub",
      "/dashboard/scraper",
      "/dashboard/crm",
      "/dashboard/deals",
      "/dashboard/proposals",
      "/dashboard/calendar",
      "/dashboard/clients",
      "/dashboard/copywriter",
      "/dashboard/email-composer",
      "/dashboard/social-manager",
      "/dashboard/content-plan",
      "/dashboard/workflows",
      "/dashboard/team",
      "/dashboard/financials",
      "/dashboard/invoices",
      "/dashboard/client-health",
      "/dashboard/integrations",
      "/dashboard/settings",
    ],
  },
  {
    key: "sales",
    label: "Sales Only",
    items: [
      "/dashboard",
      "/dashboard/inbox",
      "/dashboard/outreach-hub",
      "/dashboard/scraper",
      "/dashboard/eleven-agents",
      "/dashboard/dm-controller",
      "/dashboard/conversations",
      "/dashboard/outreach-logs",
      "/dashboard/sequences",
      "/dashboard/crm",
      "/dashboard/deals",
      "/dashboard/proposals",
      "/dashboard/forecast",
      "/dashboard/commission-tracker",
      "/dashboard/calendar",
      "/dashboard/settings",
    ],
  },
  {
    key: "finance",
    label: "Finance Ops",
    items: [
      "/dashboard",
      "/dashboard/analytics",
      "/dashboard/reports",
      "/dashboard/forecast",
      "/dashboard/financials",
      "/dashboard/invoices",
      "/dashboard/pricing",
      "/dashboard/usage",
      "/dashboard/commission-tracker",
      "/dashboard/deals",
      "/dashboard/roi-calculator",
      "/dashboard/settings",
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════ */
/* Utility: generate short ids                                          */
/* ═══════════════════════════════════════════════════════════════════ */

function newId(prefix = "grp"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Component                                                            */
/* ═══════════════════════════════════════════════════════════════════ */

interface Props {
  /** Business type — passed to AI recommender. */
  businessType?: string | null;
}

const GROUP_COLOR_PALETTE = ["#C9A84C", "#3B82F6", "#10B981", "#EF4444", "#A855F7", "#F59E0B", "#EC4899"];

export default function SidebarCustomizerFull({ businessType }: Props) {
  /* ── Loaded prefs (saved baseline, used for dirty comparison) ──── */
  const [loaded, setLoaded] = useState(false);
  const [baseline, setBaseline] = useState<SidebarPrefs | null>(null);

  /* ── Working state (what the user is editing) ──────────────────── */
  const [prefs, setPrefs] = useState<SidebarPrefs>({
    enabled_items: [],
    custom_groups: [],
    order_overrides: {},
    pins: [],
    renames: {},
    icon_overrides: {},
    sidebar_position: "left",
  });

  const [search, setSearch] = useState("");
  const [filterSection, setFilterSection] = useState<string>("All");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ── Modal state ───────────────────────────────────────────────── */
  const [newGroupOpen, setNewGroupOpen] = useState<false | { parentGroupId?: string }>(false);
  const [renameItemHref, setRenameItemHref] = useState<string | null>(null);
  const [iconPickerFor, setIconPickerFor] = useState<
    | { kind: "item"; href: string }
    | { kind: "group"; groupId: string }
    | null
  >(null);
  const [iconSearch, setIconSearch] = useState("");

  /* ── Load saved prefs on mount ─────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/sidebar-preferences", { cache: "no-store" });
        if (!res.ok) throw new Error("not ok");
        const data = await res.json();
        const raw = data?.preferences || {};
        const loadedPrefs: SidebarPrefs = {
          enabled_items: Array.isArray(raw.enabled_items) ? raw.enabled_items : [],
          custom_groups: Array.isArray(raw.custom_groups)
            ? raw.custom_groups.map((g: Record<string, unknown>): CustomGroup => ({
                id: String(g.id || newId()),
                name: String(g.name || g.label || "Group"),
                label: String(g.label || g.name || "Group"),
                icon: String(g.icon || "Layers"),
                color: String(g.color || "#C9A84C"),
                order: typeof g.order === "number" ? g.order : 0,
                items: Array.isArray(g.items) ? (g.items as unknown[]).filter((x): x is string => typeof x === "string") : [],
                subgroups: Array.isArray(g.subgroups)
                  ? (g.subgroups as Array<Record<string, unknown>>).map((s): CustomSubGroup => ({
                      id: String(s.id || newId("sgrp")),
                      name: String(s.name || "Subgroup"),
                      items: Array.isArray(s.items) ? (s.items as unknown[]).filter((x): x is string => typeof x === "string") : [],
                    }))
                  : [],
              }))
            : [],
          order_overrides: raw.order_overrides && typeof raw.order_overrides === "object" ? raw.order_overrides : {},
          pins: Array.isArray(raw.pins) ? raw.pins.filter((x: unknown): x is string => typeof x === "string") : [],
          renames: raw.renames && typeof raw.renames === "object" ? raw.renames : {},
          icon_overrides: raw.icon_overrides && typeof raw.icon_overrides === "object" ? raw.icon_overrides : {},
          sidebar_position: raw.sidebar_position === "right" ? "right" : "left",
        };
        if (cancelled) return;
        setBaseline(loadedPrefs);
        setPrefs(loadedPrefs);
      } catch {
        // Fall back to defaults.
        const empty: SidebarPrefs = {
          enabled_items: [],
          custom_groups: [],
          order_overrides: {},
          pins: [],
          renames: {},
          icon_overrides: {},
          sidebar_position: "left",
        };
        if (!cancelled) {
          setBaseline(empty);
          setPrefs(empty);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Dirty detection ───────────────────────────────────────────── */
  const isDirty = useMemo(() => {
    if (!baseline) return false;
    return JSON.stringify(baseline) !== JSON.stringify(prefs);
  }, [baseline, prefs]);

  /* ── Helpers: enable / disable / toggle items ──────────────────── */
  const enabledSet = useMemo(() => new Set(prefs.enabled_items), [prefs.enabled_items]);

  const isEnabled = useCallback((href: string) => {
    // Empty enabled_items = everything visible by default.
    if (prefs.enabled_items.length === 0) return true;
    return enabledSet.has(href);
  }, [prefs.enabled_items.length, enabledSet]);

  const toggleItem = useCallback((href: string) => {
    setPrefs(p => {
      const hasAny = p.enabled_items.length > 0;
      if (!hasAny) {
        // First toggle: initialize with all items then remove this one
        const next = ALL_SIDEBAR_ITEMS.filter(h => h !== href);
        return { ...p, enabled_items: next };
      }
      const cur = new Set(p.enabled_items);
      if (cur.has(href)) cur.delete(href); else cur.add(href);
      return { ...p, enabled_items: Array.from(cur) };
    });
  }, []);

  const selectAll = () => setPrefs(p => ({ ...p, enabled_items: [...ALL_SIDEBAR_ITEMS] }));
  const selectNone = () => setPrefs(p => ({ ...p, enabled_items: [] })); // empty array = hide all if non-empty... we use a separate flag
  const hideAll = () => setPrefs(p => ({
    ...p,
    enabled_items: ["/dashboard", "/dashboard/settings"], // keep core nav reachable
  }));

  const applyPreset = useCallback((presetKey: string) => {
    if (presetKey === "custom") {
      toast.success("Arrange items and groups however you like — this is your canvas.");
      return;
    }
    const preset = PRESETS.find(p => p.key === presetKey);
    if (!preset) return;
    setPrefs(p => ({ ...p, enabled_items: [...preset.items] }));
    toast.success(`Applied preset: ${preset.label}`);
  }, []);

  const resetAll = useCallback(() => {
    if (!confirm("Reset sidebar to defaults? This clears all custom groups, pins, renames, and icon overrides.")) return;
    setPrefs({
      enabled_items: [],
      custom_groups: [],
      order_overrides: {},
      pins: [],
      renames: {},
      icon_overrides: {},
      sidebar_position: "left",
    });
    toast.success("Reset to defaults");
  }, []);

  /* ── AI recommend ──────────────────────────────────────────────── */
  async function runAiRecommend() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/onboarding/recommend-sidebar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_type: businessType || "agency",
          business_info: { business_type: businessType },
        }),
      });
      const data = await res.json();
      if (data?.success && Array.isArray(data.enabled_items)) {
        setPrefs(p => ({ ...p, enabled_items: data.enabled_items as string[] }));
        toast.success("AI applied a recommended sidebar");
      } else {
        toast.error("AI couldn't generate a recommendation");
      }
    } catch {
      toast.error("AI request failed");
    }
    setAiLoading(false);
  }

  /* ── Pin / unpin ───────────────────────────────────────────────── */
  const togglePin = useCallback((href: string) => {
    setPrefs(p => {
      const pinned = new Set(p.pins);
      if (pinned.has(href)) pinned.delete(href); else pinned.add(href);
      return { ...p, pins: Array.from(pinned) };
    });
  }, []);

  /* ── Rename / icon override ────────────────────────────────────── */
  const setRename = useCallback((href: string, name: string) => {
    setPrefs(p => {
      const next = { ...p.renames };
      if (!name || name === labelForHref(href)) delete next[href]; else next[href] = name;
      return { ...p, renames: next };
    });
  }, []);

  const setIconOverride = useCallback((href: string, icon: string) => {
    setPrefs(p => {
      const next = { ...p.icon_overrides };
      if (!icon) delete next[href]; else next[href] = icon;
      return { ...p, icon_overrides: next };
    });
  }, []);

  const setGroupIcon = useCallback((groupId: string, icon: string) => {
    setPrefs(p => ({
      ...p,
      custom_groups: p.custom_groups.map(g => g.id === groupId ? { ...g, icon } : g),
    }));
  }, []);

  /* ── Group CRUD ────────────────────────────────────────────────── */
  const createGroup = useCallback((data: { name: string; icon: string; color: string; parentGroupId?: string }) => {
    const { name, icon, color, parentGroupId } = data;
    if (!name.trim()) {
      toast.error("Group needs a name");
      return;
    }
    setPrefs(p => {
      if (parentGroupId) {
        // Create a subgroup under parent
        return {
          ...p,
          custom_groups: p.custom_groups.map(g =>
            g.id === parentGroupId
              ? { ...g, subgroups: [...g.subgroups, { id: newId("sgrp"), name: name.trim(), items: [] }] }
              : g
          ),
        };
      }
      const nextOrder = p.custom_groups.length;
      const group: CustomGroup = {
        id: newId("grp"),
        name: name.trim(),
        label: name.trim(),
        icon: icon || "Layers",
        color: color || "#C9A84C",
        order: nextOrder,
        items: [],
        subgroups: [],
      };
      return { ...p, custom_groups: [...p.custom_groups, group] };
    });
    toast.success(parentGroupId ? "Subgroup added" : "Group created");
  }, []);

  const deleteGroup = useCallback((groupId: string, subGroupId?: string) => {
    setPrefs(p => {
      if (subGroupId) {
        return {
          ...p,
          custom_groups: p.custom_groups.map(g =>
            g.id === groupId ? { ...g, subgroups: g.subgroups.filter(s => s.id !== subGroupId) } : g
          ),
        };
      }
      return { ...p, custom_groups: p.custom_groups.filter(g => g.id !== groupId) };
    });
  }, []);

  const renameGroup = useCallback((groupId: string, name: string, subGroupId?: string) => {
    setPrefs(p => ({
      ...p,
      custom_groups: p.custom_groups.map(g => {
        if (g.id !== groupId) return g;
        if (subGroupId) {
          return { ...g, subgroups: g.subgroups.map(s => s.id === subGroupId ? { ...s, name } : s) };
        }
        return { ...g, name, label: name };
      }),
    }));
  }, []);

  const moveGroup = useCallback((groupId: string, direction: -1 | 1) => {
    setPrefs(p => {
      const idx = p.custom_groups.findIndex(g => g.id === groupId);
      if (idx < 0) return p;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= p.custom_groups.length) return p;
      const next = arrayMove(p.custom_groups, idx, newIdx).map((g, i) => ({ ...g, order: i }));
      return { ...p, custom_groups: next };
    });
  }, []);

  /* ── Drag & drop: items between groups ─────────────────────────── */
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);

  const onDragStart = (href: string) => (e: React.DragEvent) => {
    // Set BOTH text/plain and a custom type. Some browsers (Firefox in
    // particular) require text/plain data for the drag to even start.
    e.dataTransfer.setData("text/plain", href);
    try { e.dataTransfer.setData("application/x-ss-nav-href", href); } catch { /* IE fallback */ }
    e.dataTransfer.effectAllowed = "move";
    setDraggedItem(href);
  };
  const onDragEnd = () => {
    setDraggedItem(null);
    setDragTarget(null);
  };
  const onDragOverTarget = (targetId: string) => (e: React.DragEvent) => {
    // CRITICAL: preventDefault is what tells the browser a drop is allowed.
    // Without it the onDrop handler will never fire.
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragTarget(targetId);
  };
  const onDropIntoGroup = (groupId: string, subGroupId?: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Fall back to our custom type if the browser scrubbed text/plain (some
    // drag sources on Chrome/Safari do this between frames).
    const href =
      e.dataTransfer.getData("text/plain") ||
      e.dataTransfer.getData("application/x-ss-nav-href") ||
      draggedItem ||
      "";
    if (!href) return;
    setPrefs(p => {
      // Remove from every group's items/subgroup items first.
      const cleaned = p.custom_groups.map(g => ({
        ...g,
        items: g.items.filter(i => i !== href),
        subgroups: g.subgroups.map(s => ({ ...s, items: s.items.filter(i => i !== href) })),
      }));
      const next = cleaned.map(g => {
        if (g.id !== groupId) return g;
        if (subGroupId) {
          return {
            ...g,
            subgroups: g.subgroups.map(s => s.id === subGroupId ? { ...s, items: [...s.items, href] } : s),
          };
        }
        return { ...g, items: [...g.items, href] };
      });
      return { ...p, custom_groups: next };
    });
    setDraggedItem(null);
    setDragTarget(null);
  };
  const onDropUnassign = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const href =
      e.dataTransfer.getData("text/plain") ||
      e.dataTransfer.getData("application/x-ss-nav-href") ||
      draggedItem ||
      "";
    if (!href) return;
    setPrefs(p => ({
      ...p,
      custom_groups: p.custom_groups.map(g => ({
        ...g,
        items: g.items.filter(i => i !== href),
        subgroups: g.subgroups.map(s => ({ ...s, items: s.items.filter(i => i !== href) })),
      })),
    }));
    setDraggedItem(null);
    setDragTarget(null);
  };

  /* ── Item helpers for layout/preview ───────────────────────────── */
  const itemsByGroup = useMemo(() => {
    const map: Record<string, true> = {};
    prefs.custom_groups.forEach(g => {
      g.items.forEach(i => { map[i] = true; });
      g.subgroups.forEach(s => s.items.forEach(i => { map[i] = true; }));
    });
    return map;
  }, [prefs.custom_groups]);

  const unassignedItems = useMemo(() => {
    return ALL_SIDEBAR_ITEMS.filter(h => !itemsByGroup[h] && isEnabled(h) && !prefs.pins.includes(h));
  }, [itemsByGroup, isEnabled, prefs.pins]);

  const pinnedItems = prefs.pins.filter(h => isEnabled(h));

  /* ── Save / Discard ────────────────────────────────────────────── */
  async function save() {
    if (!isDirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/sidebar-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error("save failed");
      setBaseline(prefs);
      toast.success("Sidebar saved");
    } catch {
      toast.error("Save failed — check your connection");
    }
    setSaving(false);
  }

  function discard() {
    if (!baseline) return;
    if (!confirm("Discard unsaved changes?")) return;
    setPrefs(baseline);
  }

  /* ── Library: filtered search results ──────────────────────────── */
  const sections = ["All", ...Array.from(new Set(FLAT_NAV.map(i => i.section)))];
  const filteredLibrary = FLAT_NAV.filter(i => {
    if (filterSection !== "All" && i.section !== filterSection) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return i.label.toLowerCase().includes(q) || i.href.toLowerCase().includes(q);
  });

  /* ════════════════════════════════════════════════════════════════ */
  /* Render                                                           */
  /* ════════════════════════════════════════════════════════════════ */

  if (!loaded) {
    return (
      <div className="card flex items-center gap-2 text-muted text-sm">
        <Loader2 size={14} className="animate-spin" /> Loading your sidebar preferences...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Bulk actions / presets ──────────────────────────────── */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={runAiRecommend}
            disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-gold/20 to-amber-400/15 border border-gold/30 text-gold text-xs font-semibold hover:from-gold/30 hover:to-amber-400/20 transition-all disabled:opacity-50"
          >
            {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {aiLoading ? "Thinking..." : "AI Recommended"}
          </button>
          <button onClick={selectAll} className="btn-secondary text-xs flex items-center gap-1.5"><CheckSquare size={12} /> Select All</button>
          <button onClick={selectNone} className="btn-secondary text-xs flex items-center gap-1.5"><Square size={12} /> Select None</button>
          <button onClick={hideAll} className="btn-secondary text-xs flex items-center gap-1.5"><EyeOff size={12} /> Hide All</button>
          <button onClick={resetAll} className="btn-secondary text-xs flex items-center gap-1.5"><RotateCcw size={12} /> Reset</button>
          <div className="w-px h-6 bg-border mx-1" />
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:border-gold/40 text-muted hover:text-foreground transition-colors"
              title={`Preset: ${p.label}`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => applyPreset("custom")}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:border-gold/40 text-muted hover:text-foreground transition-colors"
            title="Custom — use your own arrangement"
          >
            Custom
          </button>
          <div className="flex-1" />
          <span className="text-[11px] text-muted">
            <span className="text-gold font-semibold">
              {prefs.enabled_items.length === 0 ? ALL_SIDEBAR_ITEMS.length : prefs.enabled_items.length}
            </span>
            {" / "}{ALL_SIDEBAR_ITEMS.length} visible
          </span>
        </div>
      </div>

      {/* ── Three-column layout ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* ─── LEFT: library ─── */}
        <div className="lg:col-span-4 card space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="section-header !mb-0 flex items-center gap-1.5 flex-1">
              <Layers size={14} className="text-gold" /> Library
            </h3>
            <span className="text-[10px] text-muted">{filteredLibrary.length}</span>
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search nav items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input w-full pl-7 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {sections.map(s => (
              <button
                key={s}
                onClick={() => setFilterSection(s)}
                className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                  filterSection === s ? "bg-gold text-black font-semibold" : "text-muted hover:text-foreground bg-surface-light/50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="max-h-[520px] overflow-y-auto scrollbar-none space-y-1 pr-1">
            {filteredLibrary.map(item => {
              const enabled = isEnabled(item.href);
              const pinned = prefs.pins.includes(item.href);
              const assigned = !!itemsByGroup[item.href];
              return (
                <div
                  key={item.href}
                  draggable
                  onDragStart={onDragStart(item.href)}
                  onDragEnd={onDragEnd}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs group transition-all cursor-grab active:cursor-grabbing ${
                    enabled ? "bg-surface-light/40 border-border" : "bg-transparent border-dashed border-border/50 opacity-60"
                  } ${draggedItem === item.href ? "opacity-30" : ""}`}
                  title={item.href}
                >
                  <GripVertical size={11} className="text-muted/50 shrink-0" />
                  <IconByName name={prefs.icon_overrides[item.href] || "Layers"} size={12} className="text-muted shrink-0" />
                  <span className="truncate flex-1">
                    <span className="text-foreground">{prefs.renames[item.href] || item.label}</span>
                    <span className="ml-1 text-[9px] text-muted/60">· {item.section}</span>
                  </span>
                  {pinned && <Pin size={10} className="text-gold shrink-0" />}
                  {assigned && <Layers size={10} className="text-blue-400 shrink-0" />}
                  <button
                    onClick={() => toggleItem(item.href)}
                    className="p-0.5 rounded text-muted hover:text-foreground transition-colors shrink-0"
                    title={enabled ? "Hide from sidebar" : "Show in sidebar"}
                  >
                    {enabled ? <Eye size={11} /> : <EyeOff size={11} />}
                  </button>
                  <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => togglePin(item.href)}
                      className="p-0.5 rounded text-muted hover:text-gold transition-colors"
                      title={pinned ? "Unpin" : "Pin to top"}
                    >
                      <Pin size={11} className={pinned ? "text-gold" : ""} />
                    </button>
                    <button
                      onClick={() => setRenameItemHref(item.href)}
                      className="p-0.5 rounded text-muted hover:text-foreground transition-colors"
                      title="Rename"
                    >
                      <PencilLine size={11} />
                    </button>
                    <button
                      onClick={() => { setIconPickerFor({ kind: "item", href: item.href }); setIconSearch(""); }}
                      className="p-0.5 rounded text-muted hover:text-foreground transition-colors"
                      title="Change icon"
                    >
                      <Wand2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredLibrary.length === 0 && (
              <div className="text-center text-muted text-xs py-8">No items match your search.</div>
            )}
          </div>
          <p className="text-[10px] text-muted/70 pt-1 border-t border-border/30 leading-relaxed">
            Drag items to the right column to put them in groups. Use the icons to pin, rename, or change each item&apos;s icon.
          </p>
        </div>

        {/* ─── MIDDLE: current layout ─── */}
        <div className="lg:col-span-5 card space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="section-header !mb-0 flex items-center gap-1.5 flex-1">
              <Settings2 size={14} className="text-gold" /> Your Layout
            </h3>
            <button
              onClick={() => setNewGroupOpen({})}
              className="btn-secondary text-[10px] flex items-center gap-1 px-2 py-1"
            >
              <Plus size={10} /> New Group
            </button>
          </div>

          {/* Pinned rail */}
          {pinnedItems.length > 0 && (
            <div className="rounded-xl border border-gold/20 bg-gold/[0.04] p-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Pin size={10} className="text-gold" />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-gold">Pinned</span>
              </div>
              <div className="space-y-0.5">
                {pinnedItems.map(href => (
                  <LayoutItemRow
                    key={href}
                    href={href}
                    prefs={prefs}
                    onTogglePin={() => togglePin(href)}
                    onRename={() => setRenameItemHref(href)}
                    onChangeIcon={() => { setIconPickerFor({ kind: "item", href }); setIconSearch(""); }}
                    onToggleVisibility={() => toggleItem(href)}
                    onDragStart={onDragStart(href)}
                    onDragEnd={onDragEnd}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Custom groups */}
          {prefs.custom_groups.length === 0 ? (
            <div
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragTarget("_newgroup"); }}
              onDragLeave={() => setDragTarget(null)}
              onDrop={(e) => {
                // If the user drags an item onto the empty state, auto-create a
                // starter group so they don't have to click "+ New Group" first.
                e.preventDefault();
                const href = e.dataTransfer.getData("text/plain");
                if (!href) return;
                const groupId = newId("grp");
                setPrefs(p => ({
                  ...p,
                  custom_groups: [
                    ...p.custom_groups,
                    {
                      id: groupId,
                      name: "My Group",
                      label: "My Group",
                      icon: "Layers",
                      color: "#C9A84C",
                      order: p.custom_groups.length,
                      items: [href],
                      subgroups: [],
                    },
                  ],
                }));
                setDraggedItem(null);
                setDragTarget(null);
                toast.success("Created your first group — drop more items in, or rename it.");
              }}
              className={`text-[11px] text-center py-6 border border-dashed rounded-xl transition-colors ${
                dragTarget === "_newgroup" ? "border-gold bg-gold/[0.06] text-foreground" : "border-border/50 text-muted"
              }`}
            >
              {dragTarget === "_newgroup"
                ? "Release to create your first group"
                : <>No custom groups yet. Drop an item here or click <span className="text-gold font-medium">+ New Group</span>.</>}
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 scrollbar-none">
              {prefs.custom_groups
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((g, idx) => (
                  <GroupCard
                    key={g.id}
                    group={g}
                    isFirst={idx === 0}
                    isLast={idx === prefs.custom_groups.length - 1}
                    prefs={prefs}
                    dragTarget={dragTarget}
                    onDragOver={onDragOverTarget}
                    onDropItems={onDropIntoGroup}
                    onMoveUp={() => moveGroup(g.id, -1)}
                    onMoveDown={() => moveGroup(g.id, 1)}
                    onDelete={() => deleteGroup(g.id)}
                    onRename={(name) => renameGroup(g.id, name)}
                    onChangeIcon={() => { setIconPickerFor({ kind: "group", groupId: g.id }); setIconSearch(""); }}
                    onAddSubgroup={() => setNewGroupOpen({ parentGroupId: g.id })}
                    onDeleteSubgroup={(sid) => deleteGroup(g.id, sid)}
                    onRenameSubgroup={(sid, name) => renameGroup(g.id, name, sid)}
                    onItemTogglePin={togglePin}
                    onItemRename={(href) => setRenameItemHref(href)}
                    onItemChangeIcon={(href) => { setIconPickerFor({ kind: "item", href }); setIconSearch(""); }}
                    onItemToggleVisibility={toggleItem}
                    onDragItemStart={onDragStart}
                    onDragItemEnd={onDragEnd}
                  />
                ))}
            </div>
          )}

          {/* Unassigned drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragTarget("_unassigned"); }}
            onDrop={onDropUnassign}
            className={`rounded-xl p-2 border border-dashed ${
              dragTarget === "_unassigned" ? "border-gold bg-gold/[0.06]" : "border-border/60 bg-surface-light/30"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <ChevronRight size={10} className="text-muted" />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted">Unassigned (will appear in &quot;Other&quot;)</span>
              <span className="ml-auto text-[10px] text-muted">{unassignedItems.length}</span>
            </div>
            <div className="space-y-0.5">
              {unassignedItems.slice(0, 12).map(href => (
                <LayoutItemRow
                  key={href}
                  href={href}
                  prefs={prefs}
                  compact
                  onTogglePin={() => togglePin(href)}
                  onRename={() => setRenameItemHref(href)}
                  onChangeIcon={() => { setIconPickerFor({ kind: "item", href }); setIconSearch(""); }}
                  onToggleVisibility={() => toggleItem(href)}
                  onDragStart={onDragStart(href)}
                  onDragEnd={onDragEnd}
                />
              ))}
              {unassignedItems.length > 12 && (
                <div className="text-[10px] text-muted pt-1">...and {unassignedItems.length - 12} more</div>
              )}
            </div>
          </div>
        </div>

        {/* ─── RIGHT: live preview ─── */}
        <div className="lg:col-span-3">
          <LivePreview prefs={prefs} />
        </div>
      </div>

      {/* ── Save/Discard sticky bar ─────────────────────────────── */}
      {isDirty && (
        <div className="sticky bottom-2 z-30">
          <div className="card flex items-center gap-3 shadow-2xl border-gold/30">
            <span className="text-xs text-muted">You have unsaved changes.</span>
            <div className="flex-1" />
            <button onClick={discard} className="btn-secondary text-xs flex items-center gap-1.5"><X size={12} /> Discard</button>
            <button
              onClick={save}
              disabled={saving}
              className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* ── New-group modal ─────────────────────────────────────── */}
      {newGroupOpen !== false && (
        <NewGroupModal
          parentGroupId={newGroupOpen && typeof newGroupOpen === "object" ? newGroupOpen.parentGroupId : undefined}
          onClose={() => setNewGroupOpen(false)}
          onCreate={(data) => { createGroup(data); setNewGroupOpen(false); }}
        />
      )}

      {/* ── Rename modal ────────────────────────────────────────── */}
      {renameItemHref && (
        <RenameModal
          currentName={prefs.renames[renameItemHref] || labelForHref(renameItemHref)}
          defaultName={labelForHref(renameItemHref)}
          onClose={() => setRenameItemHref(null)}
          onSave={(name) => { setRename(renameItemHref, name); setRenameItemHref(null); }}
        />
      )}

      {/* ── Icon picker modal ───────────────────────────────────── */}
      {iconPickerFor && (
        <IconPickerModal
          currentIcon={
            iconPickerFor.kind === "item"
              ? (prefs.icon_overrides[iconPickerFor.href] || "Layers")
              : (prefs.custom_groups.find(g => g.id === iconPickerFor.groupId)?.icon || "Layers")
          }
          search={iconSearch}
          onSearch={setIconSearch}
          onClose={() => setIconPickerFor(null)}
          onPick={(icon) => {
            if (iconPickerFor.kind === "item") setIconOverride(iconPickerFor.href, icon);
            else setGroupIcon(iconPickerFor.groupId, icon);
            setIconPickerFor(null);
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Layout row                                                           */
/* ═══════════════════════════════════════════════════════════════════ */

interface LayoutItemRowProps {
  href: string;
  prefs: SidebarPrefs;
  compact?: boolean;
  onTogglePin: () => void;
  onRename: () => void;
  onChangeIcon: () => void;
  onToggleVisibility: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function LayoutItemRow({
  href, prefs, compact, onTogglePin, onRename, onChangeIcon, onToggleVisibility, onDragStart, onDragEnd,
}: LayoutItemRowProps) {
  const label = prefs.renames[href] || labelForHref(href);
  const iconName = prefs.icon_overrides[href] || "Layers";
  const pinned = prefs.pins.includes(href);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs group hover:bg-surface-light/70 transition-colors cursor-grab ${compact ? "" : ""}`}
    >
      <GripVertical size={10} className="text-muted/50 shrink-0" />
      <IconByName name={iconName} size={11} className="text-muted shrink-0" />
      <span className="truncate flex-1 text-foreground">{label}</span>
      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
        <button onClick={onTogglePin} title={pinned ? "Unpin" : "Pin to top"} className="p-0.5 rounded text-muted hover:text-gold">
          <Pin size={10} className={pinned ? "text-gold" : ""} />
        </button>
        <button onClick={onRename} title="Rename" className="p-0.5 rounded text-muted hover:text-foreground">
          <PencilLine size={10} />
        </button>
        <button onClick={onChangeIcon} title="Change icon" className="p-0.5 rounded text-muted hover:text-foreground">
          <Wand2 size={10} />
        </button>
        <button onClick={onToggleVisibility} title="Hide" className="p-0.5 rounded text-muted hover:text-danger">
          <EyeOff size={10} />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* GroupCard                                                            */
/* ═══════════════════════════════════════════════════════════════════ */

interface GroupCardProps {
  group: CustomGroup;
  isFirst: boolean;
  isLast: boolean;
  prefs: SidebarPrefs;
  dragTarget: string | null;
  onDragOver: (targetId: string) => (e: React.DragEvent) => void;
  onDropItems: (groupId: string, subGroupId?: string) => (e: React.DragEvent) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onChangeIcon: () => void;
  onAddSubgroup: () => void;
  onDeleteSubgroup: (sid: string) => void;
  onRenameSubgroup: (sid: string, name: string) => void;
  onItemTogglePin: (href: string) => void;
  onItemRename: (href: string) => void;
  onItemChangeIcon: (href: string) => void;
  onItemToggleVisibility: (href: string) => void;
  onDragItemStart: (href: string) => (e: React.DragEvent) => void;
  onDragItemEnd: () => void;
}

function GroupCard({
  group, isFirst, isLast, prefs, dragTarget,
  onDragOver, onDropItems, onMoveUp, onMoveDown, onDelete, onRename,
  onChangeIcon, onAddSubgroup, onDeleteSubgroup, onRenameSubgroup,
  onItemTogglePin, onItemRename, onItemChangeIcon, onItemToggleVisibility,
  onDragItemStart, onDragItemEnd,
}: GroupCardProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(group.name);
  const [open, setOpen] = useState(true);
  const [subOpen, setSubOpen] = useState<Record<string, boolean>>({});

  useEffect(() => { setNameDraft(group.name); }, [group.name]);

  return (
    <div className="rounded-xl border border-border bg-surface-light/30 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-2 py-1.5"
        style={{ borderLeft: `3px solid ${group.color}` }}
      >
        <button onClick={() => setOpen(o => !o)} className="p-0.5 text-muted hover:text-foreground">
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
        <button onClick={onChangeIcon} className="p-0.5 rounded hover:bg-surface-light transition-colors" title="Change icon">
          <IconByName name={group.icon} size={13} className="text-gold" />
        </button>
        {editingName ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => { onRename(nameDraft.trim() || group.name); setEditingName(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onRename(nameDraft.trim() || group.name); setEditingName(false); } if (e.key === "Escape") { setNameDraft(group.name); setEditingName(false); } }}
            className="input text-xs flex-1 py-0.5"
          />
        ) : (
          <button onClick={() => setEditingName(true)} className="text-xs font-semibold text-foreground hover:text-gold transition-colors flex-1 text-left truncate">
            {group.name}
          </button>
        )}
        <span className="text-[10px] text-muted">{group.items.length}</span>
        <div className="flex items-center gap-0.5">
          <button onClick={onMoveUp} disabled={isFirst} className="p-0.5 rounded text-muted hover:text-foreground disabled:opacity-30" title="Move up"><ArrowUp size={10} /></button>
          <button onClick={onMoveDown} disabled={isLast} className="p-0.5 rounded text-muted hover:text-foreground disabled:opacity-30" title="Move down"><ArrowDown size={10} /></button>
          <button onClick={onAddSubgroup} className="p-0.5 rounded text-muted hover:text-gold" title="Add subgroup"><Plus size={10} /></button>
          <button onClick={onDelete} className="p-0.5 rounded text-muted hover:text-danger" title="Delete group"><Trash2 size={10} /></button>
        </div>
      </div>

      {open && (
        <div
          onDragOver={onDragOver(`group:${group.id}`)}
          onDrop={onDropItems(group.id)}
          className={`p-1.5 space-y-0.5 transition-colors ${dragTarget === `group:${group.id}` ? "bg-gold/[0.06]" : ""}`}
        >
          {group.items.length === 0 && group.subgroups.length === 0 && (
            <div className="text-[10px] text-muted text-center py-3 border border-dashed border-border/40 rounded-md">
              Drop items here
            </div>
          )}
          {group.items.map(href => (
            <LayoutItemRow
              key={href}
              href={href}
              prefs={prefs}
              onTogglePin={() => onItemTogglePin(href)}
              onRename={() => onItemRename(href)}
              onChangeIcon={() => onItemChangeIcon(href)}
              onToggleVisibility={() => onItemToggleVisibility(href)}
              onDragStart={onDragItemStart(href)}
              onDragEnd={onDragItemEnd}
            />
          ))}

          {group.subgroups.map(sg => {
            const sOpen = subOpen[sg.id] ?? true;
            return (
              <div key={sg.id} className="mt-1 ml-2 rounded-lg border border-border/60 bg-surface/50">
                <div className="flex items-center gap-1.5 px-1.5 py-1">
                  <button onClick={() => setSubOpen(p => ({ ...p, [sg.id]: !sOpen }))} className="p-0.5 text-muted">
                    {sOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  </button>
                  <SubgroupNameEditor
                    name={sg.name}
                    onSave={(n) => onRenameSubgroup(sg.id, n)}
                  />
                  <span className="text-[10px] text-muted">{sg.items.length}</span>
                  <button onClick={() => onDeleteSubgroup(sg.id)} className="p-0.5 rounded text-muted hover:text-danger ml-auto" title="Delete subgroup">
                    <Trash2 size={10} />
                  </button>
                </div>
                {sOpen && (
                  <div
                    onDragOver={onDragOver(`sub:${sg.id}`)}
                    onDrop={onDropItems(group.id, sg.id)}
                    className={`p-1 space-y-0.5 min-h-[24px] transition-colors ${dragTarget === `sub:${sg.id}` ? "bg-gold/[0.08]" : ""}`}
                  >
                    {sg.items.length === 0 ? (
                      <div className="text-[10px] text-muted text-center py-2 border border-dashed border-border/30 rounded-md">
                        Drop items
                      </div>
                    ) : (
                      sg.items.map(href => (
                        <LayoutItemRow
                          key={href}
                          href={href}
                          prefs={prefs}
                          compact
                          onTogglePin={() => onItemTogglePin(href)}
                          onRename={() => onItemRename(href)}
                          onChangeIcon={() => onItemChangeIcon(href)}
                          onToggleVisibility={() => onItemToggleVisibility(href)}
                          onDragStart={onDragItemStart(href)}
                          onDragEnd={onDragItemEnd}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubgroupNameEditor({ name, onSave }: { name: string; onSave: (n: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(name);
  useEffect(() => { setDraft(name); }, [name]);
  if (edit) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onSave(draft.trim() || name); setEdit(false); }}
        onKeyDown={(e) => { if (e.key === "Enter") { onSave(draft.trim() || name); setEdit(false); } if (e.key === "Escape") { setDraft(name); setEdit(false); } }}
        className="input text-[10px] py-0.5 flex-1"
      />
    );
  }
  return (
    <button onClick={() => setEdit(true)} className="text-[10px] text-muted font-medium hover:text-foreground flex-1 text-left truncate">
      {name}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* LivePreview                                                          */
/* ═══════════════════════════════════════════════════════════════════ */

function LivePreview({ prefs }: { prefs: SidebarPrefs }) {
  const assignedSet = useMemo(() => {
    const s = new Set<string>();
    prefs.custom_groups.forEach(g => {
      g.items.forEach(i => s.add(i));
      g.subgroups.forEach(sg => sg.items.forEach(i => s.add(i)));
    });
    prefs.pins.forEach(i => s.add(i));
    return s;
  }, [prefs.custom_groups, prefs.pins]);

  const isEnabled = useCallback((href: string) => {
    if (prefs.enabled_items.length === 0) return true;
    return prefs.enabled_items.includes(href);
  }, [prefs.enabled_items]);

  const otherItems = ALL_SIDEBAR_ITEMS.filter(h => !assignedSet.has(h) && isEnabled(h));

  return (
    <div className="card !p-2 sticky top-2">
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <Eye size={12} className="text-gold" />
        <span className="text-[10px] uppercase tracking-wider text-muted font-semibold">Live Preview</span>
      </div>
      <div className="rounded-xl border border-border bg-surface p-1.5 max-h-[640px] overflow-y-auto scrollbar-none">
        {/* Pinned */}
        {prefs.pins.length > 0 && (
          <div className="mb-1.5">
            <div className="flex items-center gap-1 px-2 pt-1 pb-0.5">
              <Pin size={8} className="text-gold" />
              <span className="text-[8px] uppercase tracking-[0.2em] font-semibold text-gold">Pinned</span>
            </div>
            {prefs.pins.filter(isEnabled).map(href => (
              <PreviewRow key={href} href={href} prefs={prefs} />
            ))}
          </div>
        )}

        {/* Custom groups */}
        {prefs.custom_groups
          .slice()
          .sort((a, b) => a.order - b.order)
          .map(g => {
            const items = g.items.filter(isEnabled);
            const subs = g.subgroups
              .map(sg => ({ ...sg, items: sg.items.filter(isEnabled) }))
              .filter(sg => sg.items.length > 0);
            if (items.length === 0 && subs.length === 0) return null;
            return (
              <div key={g.id} className="mb-1">
                <div className="flex items-center gap-1 px-2 pt-1.5 pb-0.5">
                  <IconByName name={g.icon} size={9} className="shrink-0" />
                  <span className="text-[8px] uppercase tracking-[0.2em] font-semibold" style={{ color: g.color }}>
                    {g.name}
                  </span>
                </div>
                {items.map(href => <PreviewRow key={href} href={href} prefs={prefs} />)}
                {subs.map(sg => (
                  <div key={sg.id}>
                    <div className="flex items-center gap-1 px-3 pt-1 pb-0.5">
                      <span className="text-[7px] text-muted/60">•</span>
                      <span className="text-[8px] text-muted/70 font-medium">{sg.name}</span>
                    </div>
                    {sg.items.map(href => <PreviewRow key={href} href={href} prefs={prefs} indent />)}
                  </div>
                ))}
              </div>
            );
          })}

        {/* Other */}
        {otherItems.length > 0 && (
          <div>
            <div className="flex items-center gap-1 px-2 pt-1.5 pb-0.5">
              <span className="text-[8px] uppercase tracking-[0.2em] font-semibold text-muted">Other</span>
            </div>
            {otherItems.map(href => <PreviewRow key={href} href={href} prefs={prefs} />)}
          </div>
        )}
      </div>
      <p className="text-[9px] text-muted mt-2 px-1 leading-relaxed">
        Showing{" "}
        <span className="text-gold">
          {prefs.enabled_items.length === 0 ? ALL_SIDEBAR_ITEMS.length : prefs.enabled_items.length}
        </span>
        {" "}items in {prefs.custom_groups.length} groups
      </p>
    </div>
  );
}

function PreviewRow({ href, prefs, indent }: { href: string; prefs: SidebarPrefs; indent?: boolean }) {
  const label = prefs.renames[href] || labelForHref(href);
  const iconName = prefs.icon_overrides[href] || "Layers";
  return (
    <div className={`flex items-center gap-1.5 py-0.5 text-[10px] text-muted rounded-md hover:bg-surface-light/70 ${indent ? "pl-4 pr-2" : "px-2"}`}>
      <IconByName name={iconName} size={10} className="shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Modals                                                               */
/* ═══════════════════════════════════════════════════════════════════ */

function NewGroupModal({
  parentGroupId, onClose, onCreate,
}: {
  parentGroupId?: string;
  onClose: () => void;
  onCreate: (data: { name: string; icon: string; color: string; parentGroupId?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Layers");
  const [color, setColor] = useState("#C9A84C");
  const [iconSearch, setIconSearch] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const iconsFiltered = iconSearch.trim()
    ? ICON_NAMES.filter(n => n.toLowerCase().includes(iconSearch.toLowerCase()))
    : ICON_NAMES;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-surface border border-border/50 rounded-xl shadow-2xl shadow-black/50 fade-in">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30">
          <h3 className="text-sm font-semibold">{parentGroupId ? "New Subgroup" : "New Group"}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-surface-light text-muted hover:text-foreground">
            <X size={14} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Name</label>
            <input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={parentGroupId ? "e.g. Social" : "e.g. Content Tools"}
              className="input w-full text-xs"
              onKeyDown={(e) => { if (e.key === "Enter") onCreate({ name, icon, color, parentGroupId }); }}
            />
          </div>
          {!parentGroupId && (
            <>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Color</label>
                <div className="flex flex-wrap gap-1.5">
                  {GROUP_COLOR_PALETTE.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  <label className="w-6 h-6 rounded-full border border-border/60 overflow-hidden cursor-pointer relative">
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <div className="w-full h-full flex items-center justify-center text-[9px] text-muted">
                      <Palette size={10} />
                    </div>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Icon</label>
                <input
                  value={iconSearch}
                  onChange={e => setIconSearch(e.target.value)}
                  placeholder="Search icons..."
                  className="input w-full text-xs mb-2"
                />
                <div className="grid grid-cols-8 gap-1 max-h-36 overflow-y-auto scrollbar-none">
                  {iconsFiltered.map(n => (
                    <button
                      key={n}
                      onClick={() => setIcon(n)}
                      className={`p-1.5 rounded-md flex items-center justify-center transition-all ${
                        icon === n ? "bg-gold text-black" : "bg-surface-light/50 text-muted hover:text-foreground hover:bg-surface-light"
                      }`}
                      title={n}
                    >
                      <IconByName name={n} size={12} />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border/30">
          <button onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button
            onClick={() => onCreate({ name: name.trim(), icon, color, parentGroupId })}
            disabled={!name.trim()}
            className="btn-primary text-xs flex items-center gap-1 disabled:opacity-50"
          >
            <Plus size={12} /> Create
          </button>
        </div>
      </div>
    </div>
  );
}

function RenameModal({
  currentName, defaultName, onClose, onSave,
}: {
  currentName: string;
  defaultName: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 bg-surface border border-border/50 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30">
          <h3 className="text-sm font-semibold">Rename Item</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-surface-light text-muted">
            <X size={14} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <label className="block text-[10px] uppercase tracking-wider text-muted">Custom label</label>
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={defaultName}
            className="input w-full text-xs"
            onKeyDown={(e) => { if (e.key === "Enter") onSave(name); }}
          />
          <p className="text-[10px] text-muted">Leave blank or set back to &quot;{defaultName}&quot; to restore the default label.</p>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border/30">
          <button onClick={() => onSave("")} className="btn-secondary text-xs">Reset</button>
          <button onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button onClick={() => onSave(name)} className="btn-primary text-xs flex items-center gap-1">
            <Check size={12} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

function IconPickerModal({
  currentIcon, search, onSearch, onClose, onPick,
}: {
  currentIcon: string;
  search: string;
  onSearch: (s: string) => void;
  onClose: () => void;
  onPick: (icon: string) => void;
}) {
  const filtered = search.trim()
    ? ICON_NAMES.filter(n => n.toLowerCase().includes(search.toLowerCase()))
    : ICON_NAMES;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-surface border border-border/50 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30">
          <h3 className="text-sm font-semibold">Choose Icon</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-surface-light text-muted">
            <X size={14} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <input
            autoFocus
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search icons..."
            className="input w-full text-xs"
          />
          <div className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto scrollbar-none">
            {filtered.map(n => (
              <button
                key={n}
                onClick={() => onPick(n)}
                className={`p-2 rounded-md flex items-center justify-center transition-all ${
                  currentIcon === n ? "bg-gold text-black" : "bg-surface-light/50 text-muted hover:text-foreground hover:bg-surface-light"
                }`}
                title={n}
              >
                <IconByName name={n} size={14} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border/30">
          <button onClick={() => onPick("")} className="btn-secondary text-xs">Reset</button>
          <button onClick={onClose} className="btn-secondary text-xs">Close</button>
        </div>
      </div>
    </div>
  );
}
