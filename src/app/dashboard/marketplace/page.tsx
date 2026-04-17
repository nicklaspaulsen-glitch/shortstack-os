"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Store, Search, Star, Download, CheckCircle, Shield, X,
  ExternalLink, Settings, Trash2,
  Code2, BookOpen, Upload, Loader,
  Zap, MessageSquare, BarChart3, Brain,
  Link2, Megaphone,
  Users,
  Image, LayoutGrid, Filter,
  Clock, Tag, AlertCircle
} from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import PageAI from "@/components/page-ai";

// ── Types ──

type Category = "all" | "crm" | "marketing" | "analytics" | "ai" | "automation" | "communication" | "integrations";
type SortBy = "popular" | "newest" | "rating";
type ViewTab = "browse" | "installed";

interface Plugin {
  id: string;
  name: string;
  author: string;
  description: string;
  longDescription: string;
  icon: React.ReactNode;
  iconColor: string;
  category: Category;
  price: number;
  rating: number;
  installs: number;
  verified: boolean;
  tags: string[];
  features: string[];
  changelog: { version: string; date: string; notes: string }[];
  requirements: string[];
  screenshots: { label: string; color: string }[];
  reviews: { name: string; avatar: string; rating: number; comment: string; date: string }[];
  settings: { key: string; label: string; type: string; default?: string | boolean }[];
  version: string;
  updatedAt: string;
}

// ── Category config ──

const CATEGORIES: { key: Category; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: <LayoutGrid size={14} /> },
  { key: "crm", label: "CRM", icon: <Users size={14} /> },
  { key: "marketing", label: "Marketing", icon: <Megaphone size={14} /> },
  { key: "analytics", label: "Analytics", icon: <BarChart3 size={14} /> },
  { key: "ai", label: "AI", icon: <Brain size={14} /> },
  { key: "automation", label: "Automation", icon: <Zap size={14} /> },
  { key: "communication", label: "Communication", icon: <MessageSquare size={14} /> },
  { key: "integrations", label: "Integrations", icon: <Link2 size={14} /> },
];

// ── Plugin catalog ──

const PLUGIN_CATALOG: Plugin[] = [];

// ── Helper functions ──

function formatInstalls(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return n.toString();
}

function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= Math.round(rating) ? "text-gold fill-gold" : "text-muted/30"}
        />
      ))}
      <span className="ml-1 text-xs text-muted">{rating.toFixed(1)}</span>
    </div>
  );
}

// ── Main page ──

export default function MarketplacePage() {
  useAuth();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [sortBy, setSortBy] = useState<SortBy>("popular");
  const [viewTab, setViewTab] = useState<ViewTab>("browse");
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "reviews" | "changelog" | "settings">("overview");
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set(["slack-integration", "stripe-billing", "calendar-sync"]));
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set(["slack-integration", "stripe-billing", "calendar-sync"]));
  const [installing, setInstalling] = useState<string | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null);

  // ── Filtered and sorted plugins ──

  const filteredPlugins = useMemo(() => {
    let list = [...PLUGIN_CATALOG];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.author.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (category !== "all") {
      list = list.filter((p) => p.category === category);
    }

    if (viewTab === "installed") {
      list = list.filter((p) => installedIds.has(p.id));
    }

    switch (sortBy) {
      case "popular":
        list.sort((a, b) => b.installs - a.installs);
        break;
      case "newest":
        list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        break;
      case "rating":
        list.sort((a, b) => b.rating - a.rating);
        break;
    }

    return list;
  }, [search, category, sortBy, viewTab, installedIds]);

  // ── Actions ──

  const handleInstall = async (pluginId: string) => {
    setInstalling(pluginId);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      setInstalledIds((prev) => new Set([...Array.from(prev), pluginId]));
      setEnabledIds((prev) => new Set([...Array.from(prev), pluginId]));
      const plugin = PLUGIN_CATALOG.find((p) => p.id === pluginId);
      toast.success(`${plugin?.name ?? "Plugin"} installed successfully`);
    } catch {
      toast.error("Failed to install plugin");
    } finally {
      setInstalling(null);
    }
  };

  const handleUninstall = (pluginId: string) => {
    setInstalledIds((prev) => {
      const next = new Set(prev);
      next.delete(pluginId);
      return next;
    });
    setEnabledIds((prev) => {
      const next = new Set(prev);
      next.delete(pluginId);
      return next;
    });
    setConfirmUninstall(null);
    const plugin = PLUGIN_CATALOG.find((p) => p.id === pluginId);
    toast.success(`${plugin?.name ?? "Plugin"} uninstalled`);
  };

  const toggleEnabled = (pluginId: string) => {
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(pluginId)) {
        next.delete(pluginId);
        toast.success("Plugin disabled");
      } else {
        next.add(pluginId);
        toast.success("Plugin enabled");
      }
      return next;
    });
  };

  const getHealthStatus = (pluginId: string): "healthy" | "warning" | "error" => {
    if (pluginId === "calendar-sync") return "warning";
    if (!enabledIds.has(pluginId)) return "error";
    return "healthy";
  };

  // ── Render ──

  return (
    <div className="space-y-6 pb-32">
      <PageHero
        icon={<Store size={28} />}
        title="Marketplace"
        subtitle="Plugins to supercharge your workflow."
        gradient="gold"
        actions={
          <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 p-1">
            <button
              onClick={() => setViewTab("browse")}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                viewTab === "browse"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white"
              }`}
            >
              Browse
            </button>
            <button
              onClick={() => setViewTab("installed")}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                viewTab === "installed"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white"
              }`}
            >
              My Plugins
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {installedIds.size}
              </span>
            </button>
          </div>
        }
      />

      {/* ── Search + filters ── */}
      <div className="space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search plugins by name, author, or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Category pills + sort */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  category === cat.key
                    ? "bg-gold/10 text-gold ring-1 ring-gold/30"
                    : "bg-surface text-muted hover:bg-surface-light hover:text-white"
                }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-white focus:border-gold/50 focus:outline-none"
            >
              <option value="popular">Popular</option>
              <option value="newest">Newest</option>
              <option value="rating">Top Rated</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="flex items-center gap-6 border-b border-border pb-4">
        <div className="text-sm text-muted">
          <span className="font-semibold text-white">{filteredPlugins.length}</span> plugins found
        </div>
        <div className="text-sm text-muted">
          <span className="font-semibold text-white">{PLUGIN_CATALOG.filter((p) => p.price === 0).length}</span> free
        </div>
        <div className="text-sm text-muted">
          <span className="font-semibold text-white">{PLUGIN_CATALOG.filter((p) => p.verified).length}</span> verified
        </div>
      </div>

      {/* ── Plugin grid ── */}
      {viewTab === "browse" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPlugins.map((plugin) => {
            const isInstalled = installedIds.has(plugin.id);
            const isInstalling = installing === plugin.id;

            return (
              <div
                key={plugin.id}
                className="card group cursor-pointer transition-all hover:border-gold/30 hover:shadow-lg hover:shadow-gold/5"
                onClick={() => {
                  setSelectedPlugin(plugin);
                  setDetailTab("overview");
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: plugin.iconColor + "22", color: plugin.iconColor }}
                  >
                    {plugin.icon}
                  </div>

                  {/* Name + author */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-white group-hover:text-gold transition-colors">
                        {plugin.name}
                      </h3>
                      {plugin.verified && (
                        <div className="flex items-center gap-0.5 rounded-full bg-blue-500/10 px-1.5 py-0.5" title="Verified">
                          <Shield size={10} className="text-blue-400" />
                          <span className="text-[9px] font-bold text-blue-400">VERIFIED</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted">by {plugin.author}</p>
                  </div>

                  {/* Price */}
                  <div className="flex-shrink-0">
                    {plugin.price === 0 ? (
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                        Free
                      </span>
                    ) : (
                      <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-[11px] font-bold text-gold">
                        ${plugin.price}/mo
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted">
                  {plugin.description}
                </p>

                {/* Rating + installs */}
                <div className="mt-3 flex items-center justify-between">
                  <StarRating rating={plugin.rating} />
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <Download size={11} />
                    {formatInstalls(plugin.installs)}
                  </div>
                </div>

                {/* Tags */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {plugin.tags.map((tag) => (
                    <span key={tag} className="rounded-md bg-surface-light px-2 py-0.5 text-[10px] font-medium text-muted">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Install button */}
                <div className="mt-4 border-t border-border pt-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isInstalled && !isInstalling) handleInstall(plugin.id);
                    }}
                    disabled={isInstalling}
                    className={`w-full rounded-lg py-2 text-xs font-semibold transition-all ${
                      isInstalled
                        ? "bg-emerald-500/10 text-emerald-400 cursor-default"
                        : isInstalling
                        ? "bg-gold/10 text-gold cursor-wait"
                        : "bg-gold/10 text-gold hover:bg-gold/20"
                    }`}
                  >
                    {isInstalling ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader size={12} className="animate-spin" />
                        Installing...
                      </span>
                    ) : isInstalled ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <CheckCircle size={12} />
                        Installed
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <Download size={12} />
                        Install
                      </span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {filteredPlugins.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <Search size={40} className="mb-3 text-muted/30" />
              <p className="text-sm font-medium text-white">No plugins found</p>
              <p className="mt-1 text-xs text-muted">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      ) : (
        /* ── My Plugins Tab ── */
        <div className="space-y-3">
          {filteredPlugins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Store size={40} className="mb-3 text-muted/30" />
              <p className="text-sm font-medium text-white">No plugins installed yet</p>
              <p className="mt-1 text-xs text-muted">Browse the marketplace to discover plugins</p>
              <button
                onClick={() => setViewTab("browse")}
                className="mt-4 rounded-lg bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:bg-gold/20 transition-colors"
              >
                Browse Marketplace
              </button>
            </div>
          ) : (
            filteredPlugins.map((plugin) => {
              const isEnabled = enabledIds.has(plugin.id);
              const health = getHealthStatus(plugin.id);

              return (
                <div key={plugin.id} className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    {/* Health indicator */}
                    <div
                      className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                        health === "healthy"
                          ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                          : health === "warning"
                          ? "bg-amber-400 shadow-sm shadow-amber-400/50"
                          : "bg-red-400 shadow-sm shadow-red-400/50"
                      }`}
                      title={health === "healthy" ? "Healthy" : health === "warning" ? "Needs attention" : "Error"}
                    />

                    {/* Plugin icon */}
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: plugin.iconColor + "22", color: plugin.iconColor }}
                    >
                      {plugin.icon}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">{plugin.name}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isEnabled
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {isEnabled ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <p className="text-xs text-muted">
                        v{plugin.version} &middot; Updated {plugin.updatedAt}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Enable/Disable toggle */}
                    <button
                      onClick={() => toggleEnabled(plugin.id)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        isEnabled ? "bg-emerald-500" : "bg-surface-light"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          isEnabled ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </button>

                    {/* Settings */}
                    <button
                      onClick={() => {
                        setSelectedPlugin(plugin);
                        setDetailTab("settings");
                      }}
                      className="rounded-lg border border-border p-2 text-muted hover:border-gold/30 hover:text-gold transition-colors"
                      title="Settings"
                    >
                      <Settings size={14} />
                    </button>

                    {/* Uninstall */}
                    {confirmUninstall === plugin.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleUninstall(plugin.id)}
                          className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmUninstall(null)}
                          className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmUninstall(plugin.id)}
                        className="rounded-lg border border-red-500/20 p-2 text-red-400/60 hover:border-red-500/40 hover:text-red-400 transition-colors"
                        title="Uninstall"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Developer Section ── */}
      <div className="section-header mt-8">
        <h2 className="text-lg font-semibold text-white">For Developers</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Build CTA */}
        <div className="card border-dashed border-gold/20 bg-gradient-to-br from-gold/5 to-transparent">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10">
              <Code2 size={24} className="text-gold" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white">Build Your Own Plugin</h3>
              <p className="mt-1 text-sm text-muted">
                Extend ShortStack with custom plugins. Use our SDK to hook into CRM events,
                add UI panels, and connect external services.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="flex items-center gap-1.5 rounded-lg bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20 transition-colors">
                  <BookOpen size={12} />
                  API Docs
                </button>
                <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-gold/30 hover:text-white transition-colors">
                  <ExternalLink size={12} />
                  View Examples
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Manifest format */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-3">Plugin Manifest Format</h3>
          <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-[11px] leading-relaxed text-muted">
{`{
  "id": "my-plugin",
  "name": "My Custom Plugin",
  "author": "Your Name",
  "version": "1.0.0",
  "description": "What it does",
  "category": "crm",
  "price": 0,
  "permissions": ["read:contacts", "write:deals"],
  "hooks": ["deal.closed", "lead.created"],
  "settings": [
    { "key": "api_key", "label": "API Key", "type": "text" }
  ]
}`}
          </pre>
          <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gold/10 py-2 text-xs font-semibold text-gold hover:bg-gold/20 transition-colors">
            <Upload size={12} />
            Submit Your Plugin
          </button>
        </div>
      </div>

      {/* ── Plugin Detail Modal ── */}
      {selectedPlugin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedPlugin(null)}
        >
          <div
            className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-[#0f1117] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 z-10 border-b border-border bg-[#0f1117]/95 backdrop-blur-sm px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: selectedPlugin.iconColor + "22", color: selectedPlugin.iconColor }}
                  >
                    {selectedPlugin.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white">{selectedPlugin.name}</h2>
                      {selectedPlugin.verified && (
                        <div className="flex items-center gap-0.5 rounded-full bg-blue-500/10 px-2 py-0.5">
                          <Shield size={10} className="text-blue-400" />
                          <span className="text-[10px] font-bold text-blue-400">VERIFIED</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted">
                      by {selectedPlugin.author} &middot; v{selectedPlugin.version} &middot;{" "}
                      {selectedPlugin.price === 0 ? (
                        <span className="text-emerald-400">Free</span>
                      ) : (
                        <span className="text-gold">${selectedPlugin.price}/mo</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlugin(null)}
                  className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal tabs */}
              <div className="mt-4 flex gap-1">
                {(["overview", "reviews", "changelog", "settings"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      detailTab === tab
                        ? "bg-gold/10 text-gold"
                        : "text-muted hover:text-white"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal content */}
            <div className="px-6 py-5 space-y-6">
              {/* ── Overview tab ── */}
              {detailTab === "overview" && (
                <>
                  {/* Stats row */}
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <StarRating rating={selectedPlugin.rating} size={14} />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <Download size={13} />
                      {formatInstalls(selectedPlugin.installs)} installs
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <Clock size={13} />
                      Updated {selectedPlugin.updatedAt}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2">About</h3>
                    <p className="text-sm leading-relaxed text-muted">
                      {selectedPlugin.longDescription}
                    </p>
                  </div>

                  {/* Screenshots */}
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3">Screenshots</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {selectedPlugin.screenshots.map((ss, i) => (
                        <div
                          key={i}
                          className="flex h-36 w-56 flex-shrink-0 items-center justify-center rounded-lg border border-border"
                          style={{ backgroundColor: ss.color + "15" }}
                        >
                          <div className="text-center">
                            <Image size={24} className="mx-auto mb-2" style={{ color: ss.color }} />
                            <span className="text-[11px] font-medium" style={{ color: ss.color }}>
                              {ss.label}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3">Features</h3>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {selectedPlugin.features.map((f, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle size={14} className="mt-0.5 flex-shrink-0 text-emerald-400" />
                          <span className="text-xs text-muted">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Requirements */}
                  {selectedPlugin.requirements.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-2">Requirements</h3>
                      <ul className="space-y-1.5">
                        {selectedPlugin.requirements.map((r, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-muted">
                            <AlertCircle size={12} className="text-amber-400" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    {selectedPlugin.tags.map((tag) => (
                      <span key={tag} className="flex items-center gap-1 rounded-md bg-surface-light px-2.5 py-1 text-[11px] text-muted">
                        <Tag size={10} />
                        {tag}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {/* ── Reviews tab ── */}
              {detailTab === "reviews" && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="flex items-center gap-4 rounded-lg bg-surface p-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-white">{selectedPlugin.rating.toFixed(1)}</div>
                      <StarRating rating={selectedPlugin.rating} size={12} />
                      <div className="mt-1 text-[10px] text-muted">{selectedPlugin.reviews.length} reviews</div>
                    </div>
                    <div className="flex-1 space-y-1">
                      {[5, 4, 3, 2, 1].map((stars) => {
                        const count = selectedPlugin.reviews.filter((r) => Math.round(r.rating) === stars).length;
                        const pct = selectedPlugin.reviews.length > 0 ? (count / selectedPlugin.reviews.length) * 100 : 0;
                        return (
                          <div key={stars} className="flex items-center gap-2">
                            <span className="w-3 text-[10px] text-muted">{stars}</span>
                            <Star size={10} className="text-gold fill-gold" />
                            <div className="h-1.5 flex-1 rounded-full bg-surface-light overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gold"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-4 text-right text-[10px] text-muted">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Individual reviews */}
                  {selectedPlugin.reviews.map((review, i) => (
                    <div key={i} className="rounded-lg border border-border bg-surface p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/10 text-[11px] font-bold text-gold">
                            {review.avatar}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{review.name}</p>
                            <p className="text-[10px] text-muted">{review.date}</p>
                          </div>
                        </div>
                        <StarRating rating={review.rating} size={10} />
                      </div>
                      <p className="mt-2.5 text-xs leading-relaxed text-muted">{review.comment}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Changelog tab ── */}
              {detailTab === "changelog" && (
                <div className="space-y-4">
                  {selectedPlugin.changelog.map((entry, i) => (
                    <div key={i} className="relative pl-6">
                      {/* Timeline line */}
                      {i < selectedPlugin.changelog.length - 1 && (
                        <div className="absolute left-[7px] top-6 h-full w-px bg-border" />
                      )}
                      {/* Timeline dot */}
                      <div
                        className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 ${
                          i === 0
                            ? "border-gold bg-gold/20"
                            : "border-border bg-surface"
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">v{entry.version}</span>
                          <span className="text-xs text-muted">{entry.date}</span>
                          {i === 0 && (
                            <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[9px] font-bold text-gold">LATEST</span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted">{entry.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Settings tab ── */}
              {detailTab === "settings" && (
                <div className="space-y-4">
                  {!installedIds.has(selectedPlugin.id) ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Settings size={32} className="mb-3 text-muted/30" />
                      <p className="text-sm text-muted">Install this plugin to configure settings</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-muted">
                        Configure {selectedPlugin.name} settings below. Changes are saved automatically.
                      </p>
                      {selectedPlugin.settings.map((setting) => (
                        <div key={setting.key} className="space-y-1.5">
                          <label className="text-xs font-medium text-white">{setting.label}</label>
                          {setting.type === "toggle" ? (
                            <button
                              className={`relative h-6 w-11 rounded-full transition-colors ${
                                setting.default ? "bg-emerald-500" : "bg-surface-light"
                              }`}
                            >
                              <div
                                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                  setting.default ? "left-[22px]" : "left-0.5"
                                }`}
                              />
                            </button>
                          ) : setting.type === "select" ? (
                            <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-white focus:border-gold/50 focus:outline-none">
                              <option>{String(setting.default ?? "")}</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              defaultValue={String(setting.default ?? "")}
                              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30"
                            />
                          )}
                        </div>
                      ))}
                      <button className="mt-2 w-full rounded-lg bg-gold/10 py-2 text-xs font-semibold text-gold hover:bg-gold/20 transition-colors">
                        Save Configuration
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 border-t border-border bg-[#0f1117]/95 backdrop-blur-sm px-6 py-4">
              {installedIds.has(selectedPlugin.id) ? (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <CheckCircle size={14} />
                    Installed &middot; v{selectedPlugin.version}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setConfirmUninstall(selectedPlugin.id);
                      }}
                      className="rounded-lg border border-red-500/20 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Uninstall
                    </button>
                    <button
                      onClick={() => setSelectedPlugin(null)}
                      className="rounded-lg bg-surface px-4 py-2 text-xs font-medium text-white hover:bg-surface-light transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted">
                    {selectedPlugin.price === 0
                      ? "Free to install"
                      : `$${selectedPlugin.price}/mo after install`}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedPlugin(null)}
                      className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        handleInstall(selectedPlugin.id);
                        setSelectedPlugin(null);
                      }}
                      className="rounded-lg bg-gold px-4 py-2 text-xs font-bold text-black hover:bg-gold/90 transition-colors"
                    >
                      {selectedPlugin.price === 0 ? "Install Free" : `Install - $${selectedPlugin.price}/mo`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Uninstall confirmation modal (from My Plugins view) ── */}
      {confirmUninstall && viewTab === "browse" && selectedPlugin && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmUninstall(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-[#0f1117] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Uninstall Plugin</h3>
                <p className="text-xs text-muted">This will remove all plugin data</p>
              </div>
            </div>
            <p className="text-xs text-muted mb-4">
              Are you sure you want to uninstall <span className="text-white font-medium">{selectedPlugin.name}</span>?
              All configuration and data will be permanently deleted.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmUninstall(null)}
                className="rounded-lg border border-border px-4 py-2 text-xs text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleUninstall(confirmUninstall);
                  setSelectedPlugin(null);
                }}
                className="rounded-lg bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
              >
                Uninstall
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page AI ── */}
      <PageAI
        pageName="Marketplace"
        context="Plugin marketplace with 20+ plugins including Slack, Notion, Zapier, Google Ads, Meta Ads, AI Lead Scorer, WhatsApp, Stripe, HubSpot Importer, Email Verifier, SMS Auto-Responder, Calendar Sync, Proposal Templates, Voice Transcription, Social Scheduler, Client Feedback, Data Enrichment, Custom Reports Builder, Telegram Bot, and A/B Testing."
        suggestions={[
          "Which free plugins are most popular?",
          "What plugins work best for lead generation?",
          "How do I build a custom plugin?",
          "Which AI plugins are available?",
        ]}
      />
    </div>
  );
}
